import { Router } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { ChatRoom, ChatMessage, User, Notification } from '../models/index.js';
import { authenticate } from '../middleware/auth.js';
import { requireHostelScope } from '../middleware/rbac.js';
import { emitToUser } from '../services/socketService.js';
import { sendPushToUser } from '../services/pushService.js';

const router = Router();
router.use(authenticate, requireHostelScope);

router.get('/rooms', async (req, res, next) => {
  try {
    const hostelId = req.auth!.hostelId!;
    const userId = req.auth!.userId;

    const rooms = await ChatRoom.find({ hostelId, memberIds: userId })
      .sort({ lastMessageAt: -1 })
      .lean();

    const allMemberIds = [...new Set(rooms.flatMap((r) => r.memberIds.map((id) => id.toString())))];
    const users = await User.find({ _id: { $in: allMemberIds } })
      .select('_id nickname avatar')
      .lean();
    const uMap = new Map(users.map((u) => [u._id.toString(), u]));

    const enriched = await Promise.all(
      rooms.map(async (r) => {
        const members = r.memberIds.map((id) => {
          const u = uMap.get(id.toString());
          return {
            userId: id.toString(),
            nickname: u?.nickname ?? 'Traveller',
            avatar: u?.avatar ?? null,
          };
        });
        const other = members.find((m) => m.userId !== userId.toString());
        const readMap = (r.lastReadAt ?? {}) as unknown as Record<string, Date>;
        const lastRead = readMap[userId.toString()] ? new Date(readMap[userId.toString()]) : new Date(0);
        const unreadCount = await ChatMessage.countDocuments({
          roomId: r._id,
          senderId: { $ne: userId },
          createdAt: { $gt: lastRead },
        });
        return {
          _id: r._id,
          type: r.type,
          name: r.type === 'GROUP' ? r.name : (other?.nickname ?? 'Traveller'),
          avatar: r.type === 'DIRECT' ? (other?.avatar ?? null) : null,
          createdBy: r.createdBy.toString(),
          members,
          lastMessageText: r.lastMessageText,
          lastMessageAt: r.lastMessageAt,
          unreadCount,
        };
      })
    );

    const totalUnread = enriched.reduce((sum, r) => sum + r.unreadCount, 0);
    res.json({ rooms: enriched, totalUnread });
  } catch (err) {
    next(err);
  }
});

router.post('/rooms/direct', async (req, res, next) => {
  try {
    const { targetUserId } = z.object({ targetUserId: z.string().min(1) }).parse(req.body);
    const hostelId = req.auth!.hostelId!;
    const myId = req.auth!.userId;

    if (targetUserId === myId.toString()) {
      res.status(400).json({ error: 'Cannot start a chat with yourself' });
      return;
    }

    const [me, target] = await Promise.all([
      User.findById(myId).lean(),
      User.findOne({ _id: targetUserId, hostelId, status: 'ACTIVE' }).lean(),
    ]);

    if (!target) {
      res.status(404).json({ error: 'Traveller not found in your hostel' });
      return;
    }

    const blocked =
      (me?.blockedUserIds ?? []).some((id) => id.toString() === targetUserId) ||
      (target.blockedUserIds ?? []).some((id) => id.toString() === myId.toString());
    if (blocked) {
      res.status(403).json({ error: 'Cannot chat with this traveller' });
      return;
    }

    const targetObjId = new Types.ObjectId(targetUserId);
    const existing = await ChatRoom.findOne({
      hostelId,
      type: 'DIRECT',
      memberIds: { $all: [myId, targetObjId], $size: 2 },
    }).lean();

    if (existing) {
      res.status(200).json({ roomId: existing._id });
      return;
    }

    const created = await ChatRoom.create({
      hostelId,
      type: 'DIRECT',
      name: null,
      memberIds: [myId, targetObjId],
      createdBy: myId,
    });

    res.status(201).json({ roomId: created._id });
  } catch (err) {
    next(err);
  }
});

const createGroupSchema = z.object({
  name: z.string().trim().min(2, 'Group name is required').max(60),
  memberIds: z.array(z.string().min(1)).min(1, 'Pick at least 1 traveller').max(30),
});

router.post('/rooms/group', async (req, res, next) => {
  try {
    const { name, memberIds } = createGroupSchema.parse(req.body);
    const hostelId = req.auth!.hostelId!;
    const myId = req.auth!.userId;

    const uniqueIds = [...new Set([...memberIds, myId.toString()])];
    const validUsers = await User.find({
      _id: { $in: uniqueIds },
      hostelId,
      status: 'ACTIVE',
    })
      .select('_id')
      .lean();

    if (validUsers.length < 2) {
      res.status(400).json({ error: 'Please select at least 1 active traveller in your hostel' });
      return;
    }

    const room = await ChatRoom.create({
      hostelId,
      type: 'GROUP',
      name,
      memberIds: validUsers.map((u) => u._id),
      createdBy: myId,
      lastMessageText: `${req.auth!.nickname} created the group`,
      lastMessageAt: new Date(),
    });

    for (const u of validUsers) {
      const uidStr = u._id.toString();
      emitToUser(uidStr, 'chat:room_created', { roomId: room._id });
      if (uidStr !== myId.toString()) {
        const notif = await Notification.create({
          userId: u._id,
          hostelId,
          type: 'GROUP_ADDED',
          title: `Added to group: ${name}`,
          message: `${req.auth!.nickname} added you to "${name}".`,
          referenceId: room._id,
        });
        emitToUser(uidStr, 'notification:new', notif);
        void sendPushToUser(u._id, {
          title: notif.title,
          body: notif.message,
          url: `/app/chat/${room._id}`,
        });
      }
    }

    res.status(201).json({ roomId: room._id });
  } catch (err) {
    next(err);
  }
});

router.post('/rooms/:roomId/members', async (req, res, next) => {
  try {
    const { targetUserId } = z.object({ targetUserId: z.string().min(1) }).parse(req.body);
    const hostelId = req.auth!.hostelId!;
    const myId = req.auth!.userId;

    const room = await ChatRoom.findOne({
      _id: req.params.roomId,
      hostelId,
      type: 'GROUP',
      memberIds: myId,
    });
    if (!room) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    const target = await User.findOne({ _id: targetUserId, hostelId, status: 'ACTIVE' }).lean();
    if (!target) {
      res.status(404).json({ error: 'Traveller not found in your hostel' });
      return;
    }

    if (room.memberIds.some((id) => id.toString() === targetUserId)) {
      res.status(409).json({ error: 'Traveller is already in this group' });
      return;
    }

    room.memberIds.push(target._id);
    await room.save();

    const notif = await Notification.create({
      userId: target._id,
      hostelId,
      type: 'GROUP_ADDED',
      title: `Added to group: ${room.name}`,
      message: `${req.auth!.nickname} added you to "${room.name}".`,
      referenceId: room._id,
    });

    emitToUser(targetUserId, 'chat:room_created', { roomId: room._id });
    emitToUser(targetUserId, 'notification:new', notif);
    void sendPushToUser(target._id, {
      title: notif.title,
      body: notif.message,
      url: `/app/chat/${room._id}`,
    });

    res.status(201).json({ message: 'Member added' });
  } catch (err) {
    next(err);
  }
});

router.delete('/rooms/:roomId/members/:memberId', async (req, res, next) => {
  try {
    const hostelId = req.auth!.hostelId!;
    const myId = req.auth!.userId.toString();
    const targetId = req.params.memberId;

    const room = await ChatRoom.findOne({
      _id: req.params.roomId,
      hostelId,
      type: 'GROUP',
      memberIds: req.auth!.userId,
    });
    if (!room) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    const isSelfLeave = targetId === myId;
    const isCreator = room.createdBy.toString() === myId;
    if (!isSelfLeave && !isCreator) {
      res.status(403).json({ error: 'Only the group creator can remove members' });
      return;
    }

    room.memberIds = room.memberIds.filter((id) => id.toString() !== targetId);
    await room.save();

    emitToUser(targetId, 'chat:room_created', { roomId: room._id });

    if (!isSelfLeave) {
      const notif = await Notification.create({
        userId: new Types.ObjectId(targetId),
        hostelId,
        type: 'GROUP_REMOVED',
        title: `Removed from group: ${room.name}`,
        message: `${req.auth!.nickname} removed you from "${room.name}".`,
        referenceId: null,
      });
      emitToUser(targetId, 'notification:new', notif);
      void sendPushToUser(targetId, {
        title: notif.title,
        body: notif.message,
        url: '/app/notifications',
      });
    }

    res.json({ message: isSelfLeave ? 'Left group' : 'Member removed' });
  } catch (err) {
    next(err);
  }
});

router.get('/rooms/:roomId/messages', async (req, res, next) => {
  try {
    const hostelId = req.auth!.hostelId!;
    const myId = req.auth!.userId;

    const room = await ChatRoom.findOne({
      _id: req.params.roomId,
      hostelId,
      memberIds: myId,
    }).lean();
    if (!room) {
      res.status(404).json({ error: 'Chat room not found' });
      return;
    }

    await ChatRoom.updateOne(
      { _id: room._id },
      { $set: { [`lastReadAt.${myId.toString()}`]: new Date() } }
    );

    const messages = await ChatMessage.find({ roomId: room._id, hostelId })
      .sort({ createdAt: 1 })
      .limit(100)
      .lean();

    const senderIds = [...new Set(messages.map((m) => m.senderId.toString()))];
    const senders = await User.find({ _id: { $in: senderIds } })
      .select('_id nickname avatar')
      .lean();
    const sMap = new Map(senders.map((s) => [s._id.toString(), s]));

    res.json({
      messages: messages.map((m) => ({
        _id: m._id,
        roomId: m.roomId,
        senderId: m.senderId,
        senderNickname: sMap.get(m.senderId.toString())?.nickname ?? 'Traveller',
        senderAvatar: sMap.get(m.senderId.toString())?.avatar ?? null,
        text: m.text,
        createdAt: m.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/rooms/:roomId/messages', async (req, res, next) => {
  try {
    const { text } = z.object({ text: z.string().trim().min(1).max(500) }).parse(req.body);
    const hostelId = req.auth!.hostelId!;
    const myId = req.auth!.userId;

    const room = await ChatRoom.findOne({
      _id: req.params.roomId,
      hostelId,
      memberIds: myId,
    });
    if (!room) {
      res.status(404).json({ error: 'Chat room not found' });
      return;
    }

    const me = await User.findById(myId).select('_id nickname avatar').lean();

    const msg = await ChatMessage.create({
      roomId: room._id,
      hostelId,
      senderId: myId,
      text,
    });

    room.lastMessageText = text;
    room.lastMessageAt = msg.createdAt;
    room.lastReadAt.set(myId.toString(), msg.createdAt);
    await room.save();

    const payload = {
      _id: msg._id,
      roomId: room._id.toString(),
      senderId: myId.toString(),
      senderNickname: me?.nickname ?? req.auth!.nickname,
      senderAvatar: me?.avatar ?? null,
      text: msg.text,
      createdAt: msg.createdAt,
    };

    for (const memberId of room.memberIds) {
      const mIdStr = memberId.toString();
      emitToUser(mIdStr, 'chat:message', payload);
      if (mIdStr !== myId.toString()) {
        void sendPushToUser(memberId, {
          title: room.type === 'GROUP' ? `${room.name}` : payload.senderNickname,
          body: room.type === 'GROUP' ? `${payload.senderNickname}: ${text}` : text,
          url: `/app/chat/${room._id}`,
        });
      }
    }

    res.status(201).json({ message: payload });
  } catch (err) {
    next(err);
  }
});

export default router;
