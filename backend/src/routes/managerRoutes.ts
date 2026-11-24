import { Router } from 'express';
import { z } from 'zod';
import {
  Activity,
  Report,
  User,
  Session,
  AnalyticsEvent,
  Hostel,
  Broadcast,
  Notification,
} from '../models/index.js';
import { authenticate } from '../middleware/auth.js';
import { requireHostelScope, requireRole } from '../middleware/rbac.js';
import { recordAuditLog } from '../services/auditService.js';
import { emitToHostel, emitToUser } from '../services/socketService.js';
import { sendPushToUser } from '../services/pushService.js';

const router = Router();
router.use(authenticate, requireHostelScope, requireRole('HOSTEL_MANAGER'));

router.get('/overview', async (req, res, next) => {
  try {
    const hostelId = req.auth!.hostelId!;
    const now = new Date();

    const [
      hostel,
      activeActivities,
      openReports,
      activeTravellers,
      events,
    ] = await Promise.all([
      Hostel.findById(hostelId).lean(),
      Activity.countDocuments({ hostelId, status: { $in: ['OPEN', 'FULL'] } }),
      Report.countDocuments({ hostelId, status: 'OPEN' }),
      User.countDocuments({ hostelId, role: 'TRAVELLER', status: 'ACTIVE', isDemo: false }),
      AnalyticsEvent.aggregate([
        { $match: { hostelId, isDemo: false } },
        { $group: { _id: '$eventType', count: { $sum: 1 } } },
      ]),
    ]);

    const eventCounts: Record<string, number> = {};
    for (const e of events) {
      eventCounts[e._id] = e.count;
    }

    const activeSessions = await Session.countDocuments({
      hostelId,
      revokedAt: null,
      expiresAt: { $gt: now },
    });

    res.json({
      hostelName: hostel?.name ?? 'Hostel',
      activeActivities,
      openReports,
      activeSessions,
      realMetrics: {
        travellersOnboarded: activeTravellers,
        qrScans: eventCounts.QR_SCAN ?? 0,
        socialStatusesSet: eventCounts.SOCIAL_STATUS_SET ?? 0,
        activitiesCreated: eventCounts.ACTIVITY_CREATED ?? 0,
        activitiesJoined: eventCounts.ACTIVITY_JOINED ?? 0,
        joinRequestsAccepted: eventCounts.JOIN_REQUEST_ACCEPTED ?? 0,
        activitiesCompleted: eventCounts.ACTIVITY_COMPLETED ?? 0,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/activities', async (req, res, next) => {
  try {
    const hostelId = req.auth!.hostelId!;
    const activities = await Activity.find({ hostelId }).sort({ scheduledAt: -1 }).lean();
    const creatorIds = [...new Set(activities.map((a) => a.creatorId))];
    const creators = await User.find({ _id: { $in: creatorIds } }).select('_id nickname role').lean();
    const cMap = new Map(creators.map((c) => [c._id.toString(), c]));

    res.json({
      activities: activities.map((a) => ({
        ...a,
        creatorNickname:
          a.creatorType === 'HOSTEL_MANAGER'
            ? 'Hostel Team'
            : (cMap.get(a.creatorId.toString())?.nickname ?? 'Traveller'),
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/reports', async (req, res, next) => {
  try {
    const hostelId = req.auth!.hostelId!;
    const reports = await Report.find({ hostelId }).sort({ createdAt: -1 }).lean();

    const userIds = [
      ...new Set(
        reports
          .flatMap((r) => [r.reporterId, r.reportedUserId])
          .filter((id): id is NonNullable<typeof id> => Boolean(id))
      ),
    ];
    const activityIds = [
      ...new Set(
        reports.map((r) => r.activityId).filter((id): id is NonNullable<typeof id> => Boolean(id))
      ),
    ];

    const [users, activities] = await Promise.all([
      User.find({ _id: { $in: userIds } }).select('_id nickname status').lean(),
      Activity.find({ _id: { $in: activityIds } }).select('_id title status').lean(),
    ]);

    const uMap = new Map(users.map((u) => [u._id.toString(), u]));
    const aMap = new Map(activities.map((a) => [a._id.toString(), a]));

    res.json({
      reports: reports.map((r) => ({
        ...r,
        reporterNickname: uMap.get(r.reporterId.toString())?.nickname ?? 'Traveller',
        reportedUser: r.reportedUserId
          ? {
              id: r.reportedUserId,
              nickname: uMap.get(r.reportedUserId.toString())?.nickname ?? 'User',
              status: uMap.get(r.reportedUserId.toString())?.status ?? 'ACTIVE',
            }
          : null,
        activity: r.activityId
          ? {
              id: r.activityId,
              title: aMap.get(r.activityId.toString())?.title ?? 'Activity',
              status: aMap.get(r.activityId.toString())?.status ?? 'OPEN',
            }
          : null,
      })),
    });
  } catch (err) {
    next(err);
  }
});

const resolveReportSchema = z.object({
  status: z.enum(['DISMISSED', 'ACTION_TAKEN']),
  resolutionNote: z.string().trim().max(300).optional(),
  cancelActivity: z.boolean().optional(),
  restrictUser: z.boolean().optional(),
});

router.patch('/reports/:id', async (req, res, next) => {
  try {
    const data = resolveReportSchema.parse(req.body);
    const hostelId = req.auth!.hostelId!;

    const report = await Report.findOne({ _id: req.params.id, hostelId });
    if (!report) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }

    report.status = data.status;
    report.resolutionNote = data.resolutionNote;
    report.resolvedBy = req.auth!.userId;
    report.resolvedAt = new Date();
    await report.save();

    if (data.cancelActivity && report.activityId) {
      await Activity.updateOne(
        { _id: report.activityId, hostelId },
        { $set: { status: 'CANCELLED' } }
      );
      emitToHostel(hostelId.toString(), 'activity:cancelled', { activityId: report.activityId });
    }

    if (data.restrictUser && report.reportedUserId) {
      await User.updateOne(
        { _id: report.reportedUserId, hostelId, role: 'TRAVELLER' },
        { $set: { status: 'RESTRICTED' } }
      );
      await Session.updateMany(
        { userId: report.reportedUserId, hostelId, revokedAt: null },
        { $set: { revokedAt: new Date() } }
      );
    }

    await recordAuditLog({
      actorId: req.auth!.userId,
      actorRole: req.auth!.role,
      hostelId,
      action: 'REPORT_RESOLVED',
      targetType: 'Report',
      targetId: report._id.toString(),
      metadata: data,
    });

    res.json({ report });
  } catch (err) {
    next(err);
  }
});

const createBroadcastSchema = z.object({
  title: z.string().trim().min(3, 'Title is required').max(80),
  message: z.string().trim().min(5, 'Message is required').max(240),
  durationHours: z.number().min(1).max(24).optional().default(6),
});

router.get('/broadcasts', async (req, res, next) => {
  try {
    const hostelId = req.auth!.hostelId!;
    const broadcasts = await Broadcast.find({ hostelId })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    res.json({ broadcasts });
  } catch (err) {
    next(err);
  }
});

router.post('/broadcasts', async (req, res, next) => {
  try {
    const { title, message, durationHours } = createBroadcastSchema.parse(req.body);
    const hostelId = req.auth!.hostelId!;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationHours * 60 * 60 * 1000);

    // Deactivate previous active banners so the new notice takes center stage
    await Broadcast.updateMany({ hostelId, active: true }, { $set: { active: false } });

    const broadcast = await Broadcast.create({
      hostelId,
      createdBy: req.auth!.userId,
      senderNickname: req.auth!.nickname || 'Hostel Team',
      title,
      message,
      active: true,
      expiresAt,
    });

    emitToHostel(hostelId.toString(), 'broadcast:new', { broadcast });

    // Notify & push to all active checked-in travellers in this hostel
    const activeUserIds = await Session.distinct('userId', {
      hostelId,
      revokedAt: null,
      expiresAt: { $gt: now },
    });

    const travellers = await User.find({
      _id: { $in: activeUserIds },
      hostelId,
      role: 'TRAVELLER',
      status: 'ACTIVE',
    })
      .select('_id')
      .lean();

    for (const t of travellers) {
      const notif = await Notification.create({
        userId: t._id,
        hostelId,
        type: 'LOBBY_BROADCAST',
        title: `Hostel Notice: ${title}`,
        message,
        referenceId: broadcast._id,
      });
      emitToUser(t._id.toString(), 'notification:new', notif);
      void sendPushToUser(t._id, {
        title: `Hostel Notice: ${title}`,
        body: message,
        url: '/app',
      });
    }

    await recordAuditLog({
      actorId: req.auth!.userId,
      actorRole: req.auth!.role,
      hostelId,
      action: 'LOBBY_BROADCAST_SENT',
      targetType: 'Broadcast',
      targetId: broadcast._id.toString(),
      metadata: { recipients: travellers.length },
    });

    res.status(201).json({ broadcast, recipientsCount: travellers.length });
  } catch (err) {
    next(err);
  }
});

router.delete('/broadcasts/:id', async (req, res, next) => {
  try {
    const hostelId = req.auth!.hostelId!;
    const updated = await Broadcast.findOneAndUpdate(
      { _id: req.params.id, hostelId },
      { $set: { active: false } },
      { new: true }
    );
    if (!updated) {
      res.status(404).json({ error: 'Broadcast not found' });
      return;
    }
    emitToHostel(hostelId.toString(), 'broadcast:cleared', { broadcastId: updated._id });
    res.json({ message: 'Broadcast cleared' });
  } catch (err) {
    next(err);
  }
});

export default router;
