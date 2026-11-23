import { Router } from 'express';
import { z } from 'zod';
import {
  Activity,
  ActivityParticipant,
  JoinRequest,
  Notification,
  User,
  AnalyticsEvent,
} from '../models/index.js';
import { authenticate } from '../middleware/auth.js';
import { requireHostelScope, requireRole } from '../middleware/rbac.js';
import { actionRateLimiter } from '../middleware/rateLimit.js';
import { emitToHostel, emitToUser } from '../services/socketService.js';
import { sendPushToUser } from '../services/pushService.js';

const router = Router();
router.use(authenticate, requireHostelScope);

async function expireOldActivities(hostelId: string | import('mongoose').Types.ObjectId) {
  const now = new Date();
  const expired = await Activity.find({
    hostelId,
    status: { $in: ['OPEN', 'FULL'] },
    endsAt: { $lte: now },
  })
    .select('_id')
    .lean();

  if (expired.length > 0) {
    const ids = expired.map((a) => a._id);
    await Promise.all([
      Activity.updateMany({ _id: { $in: ids } }, { $set: { status: 'EXPIRED' } }),
      JoinRequest.updateMany(
        { activityId: { $in: ids }, status: 'PENDING' },
        { $set: { status: 'EXPIRED', resolvedAt: now } }
      ),
    ]);
  }
}

router.get('/', async (req, res, next) => {
  try {
    const hostelId = req.auth!.hostelId!;
    await expireOldActivities(hostelId);

    const filter = String(req.query.filter ?? 'all');
    const category = req.query.category ? String(req.query.category) : undefined;
    const now = new Date();
    const soon = new Date(now.getTime() + 3 * 60 * 60 * 1000);

    const query: Record<string, unknown> = { hostelId };
    if (category && category !== 'ALL') {
      query.category = category;
    }

    if (filter === 'starting_soon') {
      query.status = { $in: ['OPEN', 'FULL'] };
      query.scheduledAt = { $lte: soon };
    } else if (filter === 'upcoming') {
      query.status = { $in: ['OPEN', 'FULL'] };
      query.scheduledAt = { $gt: now };
    } else if (filter === 'past') {
      query.status = { $in: ['COMPLETED', 'EXPIRED', 'CANCELLED'] };
    } else if (filter === 'all') {
      query.status = { $in: ['OPEN', 'FULL'] };
    }

    let activities = await Activity.find(query).sort({ scheduledAt: 1 }).lean();

    const [myParticipations, myRequests] = await Promise.all([
      ActivityParticipant.find({
        hostelId,
        userId: req.auth!.userId,
        status: 'CONFIRMED',
      }).lean(),
      JoinRequest.find({
        hostelId,
        requesterId: req.auth!.userId,
        status: 'PENDING',
      }).lean(),
    ]);

    const joinedSet = new Set(myParticipations.map((p) => p.activityId.toString()));
    const pendingSet = new Set(myRequests.map((r) => r.activityId.toString()));

    if (filter === 'my') {
      activities = activities.filter(
        (a) =>
          a.creatorId.toString() === req.auth!.userId.toString() ||
          joinedSet.has(a._id.toString()) ||
          pendingSet.has(a._id.toString())
      );
    }

    const creatorIds = [...new Set(activities.map((a) => a.creatorId))];
    const creators = await User.find({ _id: { $in: creatorIds } }).select('_id nickname').lean();
    const creatorMap = new Map(creators.map((c) => [c._id.toString(), c.nickname]));

    const enriched = activities.map((a) => ({
      ...a,
      creatorNickname:
        a.creatorType === 'HOSTEL_MANAGER'
          ? 'Hostel Team'
          : (creatorMap.get(a.creatorId.toString()) ?? 'Traveller'),
      isCreator: a.creatorId.toString() === req.auth!.userId.toString(),
      isJoined: joinedSet.has(a._id.toString()),
      hasPendingRequest: pendingSet.has(a._id.toString()),
    }));

    res.json({ activities: enriched });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const hostelId = req.auth!.hostelId!;
    await expireOldActivities(hostelId);

    const activity = await Activity.findOne({ _id: req.params.id, hostelId }).lean();
    if (!activity) {
      res.status(404).json({ error: 'Activity not found' });
      return;
    }

    const [creator, participants, myRequest] = await Promise.all([
      User.findById(activity.creatorId).select('_id nickname').lean(),
      ActivityParticipant.find({ activityId: activity._id, status: 'CONFIRMED' })
        .sort({ joinedAt: 1 })
        .lean(),
      JoinRequest.findOne({
        activityId: activity._id,
        requesterId: req.auth!.userId,
      })
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    const participantUsers = await User.find({
      _id: { $in: participants.map((p) => p.userId) },
    })
      .select('_id nickname interests')
      .lean();
    const pMap = new Map(participantUsers.map((u) => [u._id.toString(), u]));

    const isCreator = activity.creatorId.toString() === req.auth!.userId.toString();
    const canManage = isCreator || req.auth!.role === 'HOSTEL_MANAGER';

    let pendingRequests: Array<{
      id: string;
      requesterId: string;
      nickname: string;
      createdAt: Date;
    }> = [];

    if (canManage) {
      const reqs = await JoinRequest.find({ activityId: activity._id, status: 'PENDING' })
        .sort({ createdAt: 1 })
        .lean();
      const reqUsers = await User.find({ _id: { $in: reqs.map((r) => r.requesterId) } })
        .select('_id nickname')
        .lean();
      const rMap = new Map(reqUsers.map((u) => [u._id.toString(), u.nickname]));
      pendingRequests = reqs.map((r) => ({
        id: r._id.toString(),
        requesterId: r.requesterId.toString(),
        nickname: rMap.get(r.requesterId.toString()) ?? 'Traveller',
        createdAt: r.createdAt,
      }));
    }

    res.json({
      activity: {
        ...activity,
        creatorNickname:
          activity.creatorType === 'HOSTEL_MANAGER'
            ? 'Hostel Team'
            : (creator?.nickname ?? 'Traveller'),
        isCreator,
        canManage,
        isJoined: participants.some((p) => p.userId.toString() === req.auth!.userId.toString()),
        myJoinRequestStatus: myRequest?.status ?? null,
      },
      participants: participants.map((p) => ({
        userId: p.userId,
        nickname: pMap.get(p.userId.toString())?.nickname ?? 'Traveller',
        interests: pMap.get(p.userId.toString())?.interests ?? [],
        joinedAt: p.joinedAt,
        isHost: p.userId.toString() === activity.creatorId.toString(),
      })),
      pendingRequests,
    });
  } catch (err) {
    next(err);
  }
});

const createActivitySchema = z.object({
  title: z.string().trim().min(3).max(100),
  description: z.string().trim().min(5).max(600),
  category: z.enum(['GAMES', 'SOCIAL', 'EXPLORATION', 'FOOD', 'OTHER']).default('SOCIAL'),
  scheduledAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  meetingPoint: z.string().trim().min(2).max(120),
  maxParticipants: z.coerce.number().int().min(2).max(100),
  joinMode: z.enum(['PUBLIC', 'APPROVAL']).default('PUBLIC'),
});

router.post(
  '/',
  requireRole('TRAVELLER', 'HOSTEL_MANAGER'),
  actionRateLimiter,
  async (req, res, next) => {
    try {
      const data = createActivitySchema.parse(req.body);
      if (data.endsAt <= data.scheduledAt) {
        res.status(400).json({ error: 'End time must be after start time' });
        return;
      }

      const hostelId = req.auth!.hostelId!;

      // Limit travellers to 3 active activities to prevent spam
      if (req.auth!.role === 'TRAVELLER') {
        const activeCount = await Activity.countDocuments({
          hostelId,
          creatorId: req.auth!.userId,
          status: { $in: ['OPEN', 'FULL'] },
        });
        if (activeCount >= 3) {
          res.status(429).json({
            error: 'You can have at most 3 active activities at a time.',
          });
          return;
        }
      }

      const creatorType = req.auth!.role === 'HOSTEL_MANAGER' ? 'HOSTEL_MANAGER' : 'TRAVELLER';

      const activity = await Activity.create({
        hostelId,
        creatorId: req.auth!.userId,
        creatorType,
        title: data.title,
        description: data.description,
        category: data.category,
        scheduledAt: data.scheduledAt,
        endsAt: data.endsAt,
        meetingPoint: data.meetingPoint,
        maxParticipants: data.maxParticipants,
        confirmedCount: 1,
        joinMode: data.joinMode,
        status: 'OPEN',
        isDemo: req.auth!.isDemo,
      });

      await ActivityParticipant.create({
        activityId: activity._id,
        hostelId,
        userId: req.auth!.userId,
        status: 'CONFIRMED',
      });

      await AnalyticsEvent.create({
        hostelId,
        userId: req.auth!.userId,
        eventType: 'ACTIVITY_CREATED',
        isDemo: req.auth!.isDemo,
      });

      emitToHostel(hostelId.toString(), 'activity:created', { activityId: activity._id });
      res.status(201).json({ activity });
    } catch (err) {
      next(err);
    }
  }
);

const updateActivitySchema = z.object({
  title: z.string().trim().min(3).max(100).optional(),
  description: z.string().trim().min(5).max(600).optional(),
  category: z.enum(['GAMES', 'SOCIAL', 'EXPLORATION', 'FOOD', 'OTHER']).optional(),
  scheduledAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
  meetingPoint: z.string().trim().min(2).max(120).optional(),
  maxParticipants: z.coerce.number().int().min(2).max(100).optional(),
  joinMode: z.enum(['PUBLIC', 'APPROVAL']).optional(),
});

router.patch('/:id', requireRole('TRAVELLER', 'HOSTEL_MANAGER'), async (req, res, next) => {
  try {
    const data = updateActivitySchema.parse(req.body);
    const hostelId = req.auth!.hostelId!;

    const activity = await Activity.findOne({ _id: req.params.id, hostelId });
    if (!activity) {
      res.status(404).json({ error: 'Activity not found' });
      return;
    }

    const isCreator = activity.creatorId.toString() === req.auth!.userId.toString();
    const isManager = req.auth!.role === 'HOSTEL_MANAGER';
    if (!isCreator && !isManager) {
      res.status(403).json({ error: 'Only the creator or hostel manager can edit this activity' });
      return;
    }

    if (!['OPEN', 'FULL'].includes(activity.status)) {
      res.status(400).json({ error: 'Cannot edit a closed or cancelled activity' });
      return;
    }

    if (data.maxParticipants !== undefined && data.maxParticipants < activity.confirmedCount) {
      res.status(400).json({
        error: `Capacity cannot be less than current confirmed participants (${activity.confirmedCount})`,
      });
      return;
    }

    const nextScheduledAt = data.scheduledAt ?? activity.scheduledAt;
    const nextEndsAt = data.endsAt ?? activity.endsAt;
    if (nextEndsAt <= nextScheduledAt) {
      res.status(400).json({ error: 'End time must be after start time' });
      return;
    }

    Object.assign(activity, data);
    activity.status = activity.confirmedCount >= activity.maxParticipants ? 'FULL' : 'OPEN';
    await activity.save();

    emitToHostel(hostelId.toString(), 'activity:updated', { activityId: activity._id });
    res.json({ activity });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/join', requireRole('TRAVELLER', 'HOSTEL_MANAGER'), async (req, res, next) => {
  try {
    const hostelId = req.auth!.hostelId!;
    const userId = req.auth!.userId;
    await expireOldActivities(hostelId);

    const activity = await Activity.findOne({ _id: req.params.id, hostelId });
    if (!activity) {
      res.status(404).json({ error: 'Activity not found' });
      return;
    }

    if (activity.status !== 'OPEN') {
      res.status(409).json({ error: 'This activity is full or no longer open' });
      return;
    }

    const existingParticipant = await ActivityParticipant.findOne({
      activityId: activity._id,
      userId,
      status: 'CONFIRMED',
    });
    if (existingParticipant) {
      res.status(409).json({ error: 'You have already joined this activity' });
      return;
    }

    if (activity.joinMode === 'PUBLIC') {
      // Atomic capacity check & increment prevents race condition overbooking
      const updated = await Activity.findOneAndUpdate(
        {
          _id: activity._id,
          hostelId,
          status: 'OPEN',
          $expr: { $lt: ['$confirmedCount', '$maxParticipants'] },
        },
        { $inc: { confirmedCount: 1 } },
        { new: true }
      );

      if (!updated) {
        res.status(409).json({ error: 'Activity just reached maximum capacity' });
        return;
      }

      await ActivityParticipant.findOneAndUpdate(
        { activityId: activity._id, userId },
        { activityId: activity._id, hostelId, userId, status: 'CONFIRMED', joinedAt: new Date() },
        { upsert: true, new: true }
      );

      if (updated.confirmedCount >= updated.maxParticipants) {
        await Activity.updateOne({ _id: updated._id }, { $set: { status: 'FULL' } });
        emitToHostel(hostelId.toString(), 'activity:full', { activityId: updated._id });
      }

      if (activity.creatorId.toString() !== userId.toString()) {
        const notif = await Notification.create({
          userId: activity.creatorId,
          hostelId,
          type: 'PARTICIPANT_JOINED',
          title: `${req.auth!.nickname} joined ${activity.title}`,
          message: `Confirmed for ${activity.meetingPoint}.`,
          referenceId: activity._id,
        });
        emitToUser(activity.creatorId.toString(), 'notification:new', notif);
        void sendPushToUser(activity.creatorId, {
          title: notif.title,
          body: notif.message,
          url: `/app/activities/${activity._id}`,
        });
      }

      await AnalyticsEvent.create({
        hostelId,
        userId,
        eventType: 'ACTIVITY_JOINED',
        isDemo: req.auth!.isDemo,
      });

      emitToHostel(hostelId.toString(), 'participant:joined', {
        activityId: activity._id,
        confirmedCount: updated.confirmedCount,
      });

      res.status(201).json({
        joined: true,
        message: "You're in!",
        confirmedCount: updated.confirmedCount,
      });
      return;
    }

    // APPROVAL mode
    const existingPending = await JoinRequest.findOne({
      activityId: activity._id,
      requesterId: userId,
      status: 'PENDING',
    });
    if (existingPending) {
      res.status(409).json({ error: 'You already have a pending request for this activity' });
      return;
    }

    const joinRequest = await JoinRequest.create({
      activityId: activity._id,
      hostelId,
      requesterId: userId,
      status: 'PENDING',
    });

    const notif = await Notification.create({
      userId: activity.creatorId,
      hostelId,
      type: 'JOIN_REQUEST_RECEIVED',
      title: `Join request for ${activity.title}`,
      message: `${req.auth!.nickname} wants to join "${activity.title}".`,
      referenceId: activity._id,
    });
    emitToUser(activity.creatorId.toString(), 'join_request:received', {
      activityId: activity._id,
      requestId: joinRequest._id,
      notification: notif,
    });
    void sendPushToUser(activity.creatorId, {
      title: notif.title,
      body: notif.message,
      url: `/app/activities/${activity._id}`,
    });

    res.status(201).json({
      joined: false,
      requestStatus: 'PENDING',
      message: 'Join request sent to the host!',
      joinRequest,
    });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/:id/requests/:requestId/resolve',
  requireRole('TRAVELLER', 'HOSTEL_MANAGER'),
  async (req, res, next) => {
    try {
      const { decision } = z.object({ decision: z.enum(['ACCEPT', 'DECLINE']) }).parse(req.body);
      const hostelId = req.auth!.hostelId!;

      const activity = await Activity.findOne({ _id: req.params.id, hostelId });
      if (!activity) {
        res.status(404).json({ error: 'Activity not found' });
        return;
      }

      const isCreator = activity.creatorId.toString() === req.auth!.userId.toString();
      const isManager = req.auth!.role === 'HOSTEL_MANAGER' && activity.creatorType === 'HOSTEL_MANAGER';
      if (!isCreator && !isManager) {
        res.status(403).json({ error: 'Only the activity host can resolve join requests' });
        return;
      }

      const joinRequest = await JoinRequest.findOne({
        _id: req.params.requestId,
        activityId: activity._id,
        hostelId,
        status: 'PENDING',
      });
      if (!joinRequest) {
        res.status(404).json({ error: 'Pending join request not found' });
        return;
      }

      if (decision === 'DECLINE') {
        joinRequest.status = 'DECLINED';
        joinRequest.resolvedAt = new Date();
        await joinRequest.save();

        const notif = await Notification.create({
          userId: joinRequest.requesterId,
          hostelId,
          type: 'JOIN_REQUEST_DECLINED',
          title: `Update on ${activity.title}`,
          message: `Your request to join "${activity.title}" was declined.`,
          referenceId: activity._id,
        });
        emitToUser(joinRequest.requesterId.toString(), 'join_request:declined', {
          activityId: activity._id,
          notification: notif,
        });
        void sendPushToUser(joinRequest.requesterId, {
          title: notif.title,
          body: notif.message,
          url: `/app/activities/${activity._id}`,
        });

        res.json({ status: 'DECLINED' });
        return;
      }

      // ACCEPT — atomic seat check
      const updated = await Activity.findOneAndUpdate(
        {
          _id: activity._id,
          hostelId,
          status: 'OPEN',
          $expr: { $lt: ['$confirmedCount', '$maxParticipants'] },
        },
        { $inc: { confirmedCount: 1 } },
        { new: true }
      );

      if (!updated) {
        res.status(409).json({ error: 'Activity is already full or closed' });
        return;
      }

      joinRequest.status = 'ACCEPTED';
      joinRequest.resolvedAt = new Date();
      await joinRequest.save();

      await ActivityParticipant.findOneAndUpdate(
        { activityId: activity._id, userId: joinRequest.requesterId },
        {
          activityId: activity._id,
          hostelId,
          userId: joinRequest.requesterId,
          status: 'CONFIRMED',
          joinedAt: new Date(),
        },
        { upsert: true, new: true }
      );

      if (updated.confirmedCount >= updated.maxParticipants) {
        await Activity.updateOne({ _id: updated._id }, { $set: { status: 'FULL' } });
        emitToHostel(hostelId.toString(), 'activity:full', { activityId: updated._id });
      }

      const notif = await Notification.create({
        userId: joinRequest.requesterId,
        hostelId,
        type: 'JOIN_REQUEST_ACCEPTED',
        title: `You're in: ${activity.title}!`,
        message: `Your request was accepted. Meet at ${activity.meetingPoint}.`,
        referenceId: activity._id,
      });

      await Promise.all([
        AnalyticsEvent.create({
          hostelId,
          userId: joinRequest.requesterId,
          eventType: 'JOIN_REQUEST_ACCEPTED',
          isDemo: req.auth!.isDemo,
        }),
        AnalyticsEvent.create({
          hostelId,
          userId: joinRequest.requesterId,
          eventType: 'ACTIVITY_JOINED',
          isDemo: req.auth!.isDemo,
        }),
      ]);

      emitToUser(joinRequest.requesterId.toString(), 'join_request:accepted', {
        activityId: activity._id,
        notification: notif,
      });
      void sendPushToUser(joinRequest.requesterId, {
        title: notif.title,
        body: notif.message,
        url: `/app/activities/${activity._id}`,
      });
      emitToHostel(hostelId.toString(), 'participant:joined', {
        activityId: activity._id,
        confirmedCount: updated.confirmedCount,
      });

      res.json({ status: 'ACCEPTED', confirmedCount: updated.confirmedCount });
    } catch (err) {
      next(err);
    }
  }
);

router.post('/:id/leave', async (req, res, next) => {
  try {
    const hostelId = req.auth!.hostelId!;
    const userId = req.auth!.userId;

    const activity = await Activity.findOne({ _id: req.params.id, hostelId });
    if (!activity) {
      res.status(404).json({ error: 'Activity not found' });
      return;
    }

    const participant = await ActivityParticipant.findOne({
      activityId: activity._id,
      userId,
      status: 'CONFIRMED',
    });

    if (!participant) {
      // Also allow cancelling a pending join request
      const pending = await JoinRequest.findOneAndUpdate(
        { activityId: activity._id, requesterId: userId, status: 'PENDING' },
        { $set: { status: 'CANCELLED', resolvedAt: new Date() } }
      );
      if (pending) {
        res.json({ message: 'Join request cancelled' });
        return;
      }
      res.status(404).json({ error: 'You are not a participant of this activity' });
      return;
    }

    participant.status = 'LEFT';
    await participant.save();

    if (activity.creatorId.toString() === userId.toString()) {
      // Transfer host responsibility to earliest remaining confirmed participant
      const nextHost = await ActivityParticipant.findOne({
        activityId: activity._id,
        status: 'CONFIRMED',
      }).sort({ joinedAt: 1 });

      if (nextHost) {
        activity.creatorId = nextHost.userId;
        activity.confirmedCount = Math.max(0, activity.confirmedCount - 1);
        if (activity.status === 'FULL' && activity.confirmedCount < activity.maxParticipants) {
          activity.status = 'OPEN';
        }
        await activity.save();

        const notif = await Notification.create({
          userId: nextHost.userId,
          hostelId,
          type: 'HOST_TRANSFERRED',
          title: `You're now hosting ${activity.title}`,
          message: `The previous host left, so you've been made the host of "${activity.title}".`,
          referenceId: activity._id,
        });
        emitToUser(nextHost.userId.toString(), 'notification:new', notif);
        void sendPushToUser(nextHost.userId, {
          title: notif.title,
          body: notif.message,
          url: `/app/activities/${activity._id}`,
        });
      } else {
        activity.confirmedCount = 0;
        activity.status = 'CANCELLED';
        await activity.save();
        await JoinRequest.updateMany(
          { activityId: activity._id, status: 'PENDING' },
          { $set: { status: 'EXPIRED', resolvedAt: new Date() } }
        );
        emitToHostel(hostelId.toString(), 'activity:cancelled', { activityId: activity._id });
      }
    } else {
      const updated = await Activity.findOneAndUpdate(
        { _id: activity._id, confirmedCount: { $gt: 0 } },
        { $inc: { confirmedCount: -1 } },
        { new: true }
      );
      if (updated && updated.status === 'FULL' && updated.confirmedCount < updated.maxParticipants) {
        await Activity.updateOne({ _id: updated._id }, { $set: { status: 'OPEN' } });
      }
    }

    emitToHostel(hostelId.toString(), 'participant:left', { activityId: activity._id });
    res.json({ message: 'You have left the activity' });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/cancel', requireRole('TRAVELLER', 'HOSTEL_MANAGER'), async (req, res, next) => {
  try {
    const hostelId = req.auth!.hostelId!;
    const activity = await Activity.findOne({ _id: req.params.id, hostelId });
    if (!activity) {
      res.status(404).json({ error: 'Activity not found' });
      return;
    }

    const isCreator = activity.creatorId.toString() === req.auth!.userId.toString();
    const isManager = req.auth!.role === 'HOSTEL_MANAGER';
    if (!isCreator && !isManager) {
      res.status(403).json({ error: 'Only the creator or hostel manager can cancel this activity' });
      return;
    }

    if (activity.status === 'CANCELLED') {
      res.json({ message: 'Activity is already cancelled' });
      return;
    }

    activity.status = 'CANCELLED';
    await activity.save();

    await JoinRequest.updateMany(
      { activityId: activity._id, status: 'PENDING' },
      { $set: { status: 'EXPIRED', resolvedAt: new Date() } }
    );

    const participants = await ActivityParticipant.find({
      activityId: activity._id,
      status: 'CONFIRMED',
      userId: { $ne: req.auth!.userId },
    }).lean();

    if (participants.length > 0) {
      await Notification.insertMany(
        participants.map((p) => ({
          userId: p.userId,
          hostelId,
          type: 'ACTIVITY_CANCELLED',
          title: `Cancelled: ${activity.title}`,
          message: `"${activity.title}" has been cancelled.`,
          referenceId: activity._id,
        }))
      );
      for (const p of participants) {
        void sendPushToUser(p.userId, {
          title: `Cancelled: ${activity.title}`,
          body: `"${activity.title}" has been cancelled.`,
          url: `/app/activities/${activity._id}`,
        });
      }
    }

    emitToHostel(hostelId.toString(), 'activity:cancelled', { activityId: activity._id });
    res.json({ message: 'Activity cancelled' });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/complete', requireRole('TRAVELLER', 'HOSTEL_MANAGER'), async (req, res, next) => {
  try {
    const hostelId = req.auth!.hostelId!;
    const activity = await Activity.findOne({ _id: req.params.id, hostelId });
    if (!activity) {
      res.status(404).json({ error: 'Activity not found' });
      return;
    }

    const isCreator = activity.creatorId.toString() === req.auth!.userId.toString();
    const isManager = req.auth!.role === 'HOSTEL_MANAGER';
    if (!isCreator && !isManager) {
      res.status(403).json({ error: 'Only the creator or hostel manager can complete this activity' });
      return;
    }

    activity.status = 'COMPLETED';
    await activity.save();

    await AnalyticsEvent.create({
      hostelId,
      userId: req.auth!.userId,
      eventType: 'ACTIVITY_COMPLETED',
      isDemo: activity.isDemo,
    });

    emitToHostel(hostelId.toString(), 'activity:updated', { activityId: activity._id });
    res.json({ message: 'Activity marked completed', activity });
  } catch (err) {
    next(err);
  }
});

export default router;
