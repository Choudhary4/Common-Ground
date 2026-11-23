import { Router } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import {
  SocialStatus,
  User,
  Activity,
  Notification,
  Report,
  AnalyticsEvent,
} from '../models/index.js';
import { env } from '../config/env.js';
import { authenticate } from '../middleware/auth.js';
import { requireHostelScope, requireRole } from '../middleware/rbac.js';
import { actionRateLimiter } from '../middleware/rateLimit.js';
import { emitToHostel, emitToUser } from '../services/socketService.js';

const router = Router();

router.use(authenticate, requireHostelScope);

const statusSchema = z.object({
  status: z.enum(['OPEN_TO_MEETING', 'UP_FOR_ACTIVITIES', 'LOOKING_FOR_COMPANY', 'JUST_CHILLING']),
});

router.get('/status', async (req, res, next) => {
  try {
    const doc = await SocialStatus.findOne({
      userId: req.auth!.userId,
      hostelId: req.auth!.hostelId!,
      expiresAt: { $gt: new Date() },
    }).lean();
    res.json({ status: doc ?? null });
  } catch (err) {
    next(err);
  }
});

router.put('/status', async (req, res, next) => {
  try {
    const { status } = statusSchema.parse(req.body);
    const hostelId = req.auth!.hostelId!;
    const expiresAt = new Date(Date.now() + env.SOCIAL_STATUS_TTL_MINUTES * 60 * 1000);

    const updated = await SocialStatus.findOneAndUpdate(
      { userId: req.auth!.userId },
      { userId: req.auth!.userId, hostelId, status, expiresAt },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    await AnalyticsEvent.create({
      hostelId,
      userId: req.auth!.userId,
      eventType: 'SOCIAL_STATUS_SET',
      isDemo: req.auth!.isDemo,
    });

    emitToHostel(hostelId.toString(), 'social:updated', { hostelId: hostelId.toString() });
    res.json({ status: updated });
  } catch (err) {
    next(err);
  }
});

router.delete('/status', async (req, res, next) => {
  try {
    const hostelId = req.auth!.hostelId!;
    await SocialStatus.deleteOne({ userId: req.auth!.userId, hostelId });
    emitToHostel(hostelId.toString(), 'social:updated', { hostelId: hostelId.toString() });
    res.json({ message: 'Social status turned off' });
  } catch (err) {
    next(err);
  }
});

router.get('/discover', async (req, res, next) => {
  try {
    const hostelId = req.auth!.hostelId!;
    const currentUser = await User.findById(req.auth!.userId).lean();
    const myBlockedIds = new Set((currentUser?.blockedUserIds ?? []).map((id) => id.toString()));

    // Find users who blocked the current user
    const blockedMeUsers = await User.find({
      hostelId,
      blockedUserIds: req.auth!.userId,
    })
      .select('_id')
      .lean();
    for (const u of blockedMeUsers) {
      myBlockedIds.add(u._id.toString());
    }

    const activeStatuses = await SocialStatus.find({
      hostelId,
      expiresAt: { $gt: new Date() },
    })
      .sort({ createdAt: -1 })
      .lean();

    const userIds = activeStatuses
      .map((s) => s.userId)
      .filter((id) => id.toString() !== req.auth!.userId.toString() && !myBlockedIds.has(id.toString()));

    const users = await User.find({
      _id: { $in: userIds },
      hostelId,
      status: 'ACTIVE',
    })
      .select('_id nickname interests')
      .lean();

    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    const travellers = activeStatuses
      .filter((s) => userMap.has(s.userId.toString()))
      .map((s) => {
        const u = userMap.get(s.userId.toString())!;
        return {
          userId: u._id,
          nickname: u.nickname,
          interests: u.interests ?? [],
          status: s.status,
          expiresAt: s.expiresAt,
        };
      });

    res.json({
      openCount: travellers.length,
      travellers,
    });
  } catch (err) {
    next(err);
  }
});

const inviteSchema = z.object({
  targetUserId: z.string().min(1),
  activityId: z.string().min(1),
});

router.post('/invite', requireRole('TRAVELLER', 'HOSTEL_MANAGER'), actionRateLimiter, async (req, res, next) => {
  try {
    const { targetUserId, activityId } = inviteSchema.parse(req.body);
    const hostelId = req.auth!.hostelId!;

    if (targetUserId === req.auth!.userId.toString()) {
      res.status(400).json({ error: 'You cannot invite yourself' });
      return;
    }

    const [targetUser, targetStatus, activity] = await Promise.all([
      User.findOne({ _id: targetUserId, hostelId, status: 'ACTIVE' }).lean(),
      SocialStatus.findOne({ userId: targetUserId, hostelId, expiresAt: { $gt: new Date() } }).lean(),
      Activity.findOne({ _id: activityId, hostelId, status: 'OPEN' }).lean(),
    ]);

    if (!targetUser || !targetStatus) {
      res.status(404).json({ error: 'Traveller is not currently available for invitations' });
      return;
    }

    if (!activity) {
      res.status(404).json({ error: 'Activity is not open for invitations' });
      return;
    }

    const me = await User.findById(req.auth!.userId).lean();
    const blocked =
      (me?.blockedUserIds ?? []).some((id) => id.toString() === targetUserId) ||
      (targetUser.blockedUserIds ?? []).some((id) => id.toString() === req.auth!.userId.toString());

    if (blocked) {
      res.status(403).json({ error: 'Unable to send invitation to this traveller' });
      return;
    }

    // Limit: max 5 invitations sent in the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentInviteCount = await Notification.countDocuments({
      hostelId,
      type: 'ACTIVITY_INVITE',
      createdAt: { $gt: oneHourAgo },
      message: { $regex: `^${req.auth!.nickname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} invited` },
    });

    if (recentInviteCount >= 5) {
      res.status(429).json({ error: 'Hourly invitation limit reached. Give people space to respond!' });
      return;
    }

    // Prevent duplicate invite for same activity + user within 2 hours
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const duplicate = await Notification.findOne({
      userId: targetUser._id,
      hostelId,
      type: 'ACTIVITY_INVITE',
      referenceId: activity._id,
      createdAt: { $gt: twoHoursAgo },
    }).lean();

    if (duplicate) {
      res.status(409).json({ error: 'You already invited this traveller to this activity recently' });
      return;
    }

    const notification = await Notification.create({
      userId: targetUser._id,
      hostelId,
      type: 'ACTIVITY_INVITE',
      title: `Activity invite: ${activity.title}`,
      message: `${req.auth!.nickname} invited you to join "${activity.title}" at ${activity.meetingPoint}.`,
      referenceId: activity._id,
    });

    emitToUser(targetUser._id.toString(), 'notification:new', notification);
    res.status(201).json({ message: 'Invitation sent', notification });
  } catch (err) {
    next(err);
  }
});

router.get('/notifications', async (req, res, next) => {
  try {
    const notifications = await Notification.find({
      userId: req.auth!.userId,
      hostelId: req.auth!.hostelId!,
    })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();
    res.json({ notifications });
  } catch (err) {
    next(err);
  }
});

router.patch('/notifications/:id/read', async (req, res, next) => {
  try {
    await Notification.updateOne(
      { _id: req.params.id, userId: req.auth!.userId, hostelId: req.auth!.hostelId! },
      { $set: { readAt: new Date() } }
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/notifications/read-all', async (req, res, next) => {
  try {
    await Notification.updateMany(
      { userId: req.auth!.userId, hostelId: req.auth!.hostelId!, readAt: null },
      { $set: { readAt: new Date() } }
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/block', async (req, res, next) => {
  try {
    const { targetUserId } = z.object({ targetUserId: z.string().min(1) }).parse(req.body);
    if (targetUserId === req.auth!.userId.toString()) {
      res.status(400).json({ error: 'Cannot block yourself' });
      return;
    }
    const target = await User.findOne({ _id: targetUserId, hostelId: req.auth!.hostelId! }).lean();
    if (!target) {
      res.status(404).json({ error: 'User not found in this hostel' });
      return;
    }
    await User.updateOne(
      { _id: req.auth!.userId },
      { $addToSet: { blockedUserIds: new Types.ObjectId(targetUserId) } }
    );
    res.json({ message: 'User blocked' });
  } catch (err) {
    next(err);
  }
});

router.delete('/block/:targetUserId', async (req, res, next) => {
  try {
    await User.updateOne(
      { _id: req.auth!.userId },
      { $pull: { blockedUserIds: new Types.ObjectId(req.params.targetUserId) } }
    );
    res.json({ message: 'User unblocked' });
  } catch (err) {
    next(err);
  }
});

router.get('/settings', async (req, res, next) => {
  try {
    const user = await User.findById(req.auth!.userId).lean();
    const blockedUsers = user?.blockedUserIds?.length
      ? await User.find({ _id: { $in: user.blockedUserIds } }).select('_id nickname').lean()
      : [];
    res.json({
      nickname: user?.nickname ?? '',
      interests: user?.interests ?? [],
      blockedUsers,
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/settings', async (req, res, next) => {
  try {
    const data = z
      .object({
        nickname: z.string().trim().min(2).max(40).optional(),
        interests: z.array(z.string().trim().min(1).max(24)).max(5).optional(),
      })
      .parse(req.body);

    const updated = await User.findByIdAndUpdate(
      req.auth!.userId,
      { $set: data },
      { new: true }
    ).lean();

    res.json({
      nickname: updated?.nickname,
      interests: updated?.interests ?? [],
    });
  } catch (err) {
    next(err);
  }
});

const reportSchema = z.object({
  reportedUserId: z.string().optional(),
  activityId: z.string().optional(),
  reason: z.string().trim().min(3).max(100),
  description: z.string().trim().max(600).optional(),
});

router.post('/reports', actionRateLimiter, async (req, res, next) => {
  try {
    const data = reportSchema.parse(req.body);
    if (!data.reportedUserId && !data.activityId) {
      res.status(400).json({ error: 'Please specify a user or activity to report' });
      return;
    }

    const hostelId = req.auth!.hostelId!;

    if (data.reportedUserId) {
      const targetUser = await User.findOne({ _id: data.reportedUserId, hostelId }).lean();
      if (!targetUser) {
        res.status(404).json({ error: 'Reported user not found in this hostel' });
        return;
      }
    }
    if (data.activityId) {
      const targetActivity = await Activity.findOne({ _id: data.activityId, hostelId }).lean();
      if (!targetActivity) {
        res.status(404).json({ error: 'Reported activity not found in this hostel' });
        return;
      }
    }

    const report = await Report.create({
      hostelId,
      reporterId: req.auth!.userId,
      reportedUserId: data.reportedUserId ? new Types.ObjectId(data.reportedUserId) : null,
      activityId: data.activityId ? new Types.ObjectId(data.activityId) : null,
      reason: data.reason,
      description: data.description ?? '',
    });

    res.status(201).json({ message: 'Report submitted to hostel manager', reportId: report._id });
  } catch (err) {
    next(err);
  }
});

export default router;
