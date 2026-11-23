import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { createApp } from '../app.js';
import {
  Hostel,
  User,
  Session,
  HostelQR,
  AccessCode,
  SocialStatus,
  Activity,
  ActivityParticipant,
  JoinRequest,
  Report,
  Notification,
} from '../models/index.js';
import { hashPassword } from '../utils/crypto.js';

let mongod: MongoMemoryServer;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDatabase(mongod.getUri());
  app = createApp();
});

afterAll(async () => {
  await disconnectDatabase();
  await mongod.stop();
});

beforeEach(async () => {
  await Promise.all([
    Hostel.deleteMany({}),
    User.deleteMany({}),
    Session.deleteMany({}),
    HostelQR.deleteMany({}),
    AccessCode.deleteMany({}),
    SocialStatus.deleteMany({}),
    Activity.deleteMany({}),
    ActivityParticipant.deleteMany({}),
    JoinRequest.deleteMany({}),
    Report.deleteMany({}),
    Notification.deleteMany({}),
  ]);
});

async function setupHostelWithStaffAndManager(name: string, city: string, suffix: string) {
  const hostel = await Hostel.create({
    name,
    slug: `gostops-${suffix}`,
    city,
    address: `${city} Main Road`,
  });
  const passwordHash = await hashPassword('pass1234');
  await User.create({
    nickname: `${city} Staff`,
    email: `staff.${suffix}@test.local`,
    passwordHash,
    role: 'HOSTEL_STAFF',
    hostelId: hostel._id,
  });
  await User.create({
    nickname: `${city} Manager`,
    email: `mgr.${suffix}@test.local`,
    passwordHash,
    role: 'HOSTEL_MANAGER',
    hostelId: hostel._id,
  });
  return hostel;
}

describe('Phases 2-5 — QR, Traveller Onboarding, Social Status, Activities, Concurrency, Staff & Manager', () => {
  it('supports staff QR & access code generation, QR scan, traveller onboarding, and QR revocation', async () => {
    await setupHostelWithStaffAndManager('goSTOPS Jaipur', 'Jaipur', 'jpr');

    const staffAgent = request.agent(app);
    await staffAgent
      .post('/api/auth/staff/login')
      .send({ email: 'staff.jpr@test.local', password: 'pass1234' });

    const qrRes = await staffAgent.post('/api/staff/qr/generate');
    expect(qrRes.status).toBe(201);
    expect(qrRes.body.qr.qrDataUrl).toContain('data:image/png;base64');
    const parsedQrUrl = new URL(qrRes.body.qr.qrUrl);
    const token1 = parsedQrUrl.pathname.split('/').pop()!;
    const embeddedCode = parsedQrUrl.searchParams.get('code');
    expect(embeddedCode).toBeTruthy();

    // Scan QR
    const scanRes = await request(app).get(`/api/qr/resolve/${token1}`);
    expect(scanRes.status).toBe(200);
    expect(scanRes.body.hostel.name).toBe('goSTOPS Jaipur');

    // Onboard traveller using the code embedded in QR URL
    const travellerAgent = request.agent(app);
    const onboardRes = await travellerAgent.post('/api/auth/traveller/onboard').send({
      qrToken: token1,
      nickname: 'SoloExplorer',
      accessCode: embeddedCode,
    });
    expect(onboardRes.status).toBe(201);
    expect(onboardRes.body.user.hostelName).toBe('goSTOPS Jaipur');

    // Regenerate QR -> old token must be revoked
    const qrRes2 = await staffAgent.post('/api/staff/qr/generate');
    expect(qrRes2.status).toBe(201);
    const oldScan = await request(app).get(`/api/qr/resolve/${token1}`);
    expect(oldScan.status).toBe(404);
  });

  it('enforces hostel isolation for social discovery and activities', async () => {
    await setupHostelWithStaffAndManager('goSTOPS Jaipur', 'Jaipur', 'jpr');
    await setupHostelWithStaffAndManager('goSTOPS Delhi', 'Delhi', 'del');

    const jprStaff = request.agent(app);
    await jprStaff.post('/api/auth/staff/login').send({ email: 'staff.jpr@test.local', password: 'pass1234' });
    const jprToken = new URL((await jprStaff.post('/api/staff/qr/generate')).body.qr.qrUrl).pathname.split('/').pop()!;
    const jprCode = (await jprStaff.post('/api/staff/access-code/regenerate')).body.accessCode.code;

    const delStaff = request.agent(app);
    await delStaff.post('/api/auth/staff/login').send({ email: 'staff.del@test.local', password: 'pass1234' });
    const delToken = new URL((await delStaff.post('/api/staff/qr/generate')).body.qr.qrUrl).pathname.split('/').pop()!;
    const delCode = (await delStaff.post('/api/staff/access-code/regenerate')).body.accessCode.code;

    const jprTraveller = request.agent(app);
    await jprTraveller.post('/api/auth/traveller/onboard').send({
      qrToken: jprToken,
      nickname: 'JaipurGuest',
      accessCode: jprCode,
    });
    await jprTraveller.put('/api/traveller/status').send({ status: 'OPEN_TO_MEETING' });

    const delTraveller = request.agent(app);
    await delTraveller.post('/api/auth/traveller/onboard').send({
      qrToken: delToken,
      nickname: 'DelhiGuest',
      accessCode: delCode,
    });

    // Delhi guest must NOT see Jaipur guest in discover
    const delDiscover = await delTraveller.get('/api/traveller/discover');
    expect(delDiscover.status).toBe(200);
    expect(delDiscover.body.openCount).toBe(0);
    expect(delDiscover.body.travellers).toHaveLength(0);
  });

  it('prevents overbooking on concurrent joins for the final seat', async () => {
    await setupHostelWithStaffAndManager('goSTOPS Jaipur', 'Jaipur', 'jpr');
    const staff = request.agent(app);
    await staff.post('/api/auth/staff/login').send({ email: 'staff.jpr@test.local', password: 'pass1234' });
    const token = new URL((await staff.post('/api/staff/qr/generate')).body.qr.qrUrl).pathname.split('/').pop()!;
    const code = (await staff.post('/api/staff/access-code/regenerate')).body.accessCode.code;

    const host = request.agent(app);
    await host.post('/api/auth/traveller/onboard').send({ qrToken: token, nickname: 'Host', accessCode: code });
    const t1 = request.agent(app);
    await t1.post('/api/auth/traveller/onboard').send({ qrToken: token, nickname: 'Racer1', accessCode: code });
    const t2 = request.agent(app);
    await t2.post('/api/auth/traveller/onboard').send({ qrToken: token, nickname: 'Racer2', accessCode: code });

    // Create activity with maxParticipants = 2 (host takes 1 seat, so 1 seat remains)
    const createRes = await host.post('/api/activities').send({
      title: 'Chai & Cards',
      description: 'Quick game in the lounge',
      category: 'GAMES',
      scheduledAt: new Date(Date.now() + 3600_000).toISOString(),
      endsAt: new Date(Date.now() + 7200_000).toISOString(),
      meetingPoint: 'Common Room',
      maxParticipants: 2,
      joinMode: 'PUBLIC',
    });
    expect(createRes.status).toBe(201);
    const activityId = createRes.body.activity._id;

    // Concurrent join attempts
    const [res1, res2] = await Promise.all([
      t1.post(`/api/activities/${activityId}/join`),
      t2.post(`/api/activities/${activityId}/join`),
    ]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([201, 409]);

    const detail = await host.get(`/api/activities/${activityId}`);
    expect(detail.body.activity.confirmedCount).toBe(2);
    expect(detail.body.activity.status).toBe('FULL');
  });

  it('supports approval-required activities, manager official activities, staff restriction, and report moderation', async () => {
    await setupHostelWithStaffAndManager('goSTOPS Jaipur', 'Jaipur', 'jpr');

    const staff = request.agent(app);
    await staff.post('/api/auth/staff/login').send({ email: 'staff.jpr@test.local', password: 'pass1234' });
    const token = new URL((await staff.post('/api/staff/qr/generate')).body.qr.qrUrl).pathname.split('/').pop()!;
    const code = (await staff.post('/api/staff/access-code/regenerate')).body.accessCode.code;

    // Regular staff CANNOT create official activities
    const staffCreate = await staff.post('/api/activities').send({
      title: 'Unauthorized Official',
      description: 'Should be forbidden',
      category: 'SOCIAL',
      scheduledAt: new Date(Date.now() + 3600_000).toISOString(),
      endsAt: new Date(Date.now() + 7200_000).toISOString(),
      meetingPoint: 'Lobby',
      maxParticipants: 10,
      joinMode: 'PUBLIC',
    });
    expect(staffCreate.status).toBe(403);

    // Manager CAN create official activities
    const mgr = request.agent(app);
    await mgr.post('/api/auth/staff/login').send({ email: 'mgr.jpr@test.local', password: 'pass1234' });
    const mgrCreate = await mgr.post('/api/activities').send({
      title: 'Official Karaoke Night',
      description: 'Hostel-hosted karaoke!',
      category: 'SOCIAL',
      scheduledAt: new Date(Date.now() + 3600_000).toISOString(),
      endsAt: new Date(Date.now() + 7200_000).toISOString(),
      meetingPoint: 'Rooftop',
      maxParticipants: 20,
      joinMode: 'PUBLIC',
    });
    expect(mgrCreate.status).toBe(201);
    expect(mgrCreate.body.activity.creatorType).toBe('HOSTEL_MANAGER');

    // Approval-required flow
    const creator = request.agent(app);
    await creator.post('/api/auth/traveller/onboard').send({ qrToken: token, nickname: 'Creator', accessCode: code });
    const guest = request.agent(app);
    await guest.post('/api/auth/traveller/onboard').send({ qrToken: token, nickname: 'Guest', accessCode: code });

    const appAct = await creator.post('/api/activities').send({
      title: 'Fort Hike',
      description: 'Early morning hike',
      category: 'EXPLORATION',
      scheduledAt: new Date(Date.now() + 3600_000).toISOString(),
      endsAt: new Date(Date.now() + 7200_000).toISOString(),
      meetingPoint: 'Gate',
      maxParticipants: 4,
      joinMode: 'APPROVAL',
    });
    const actId = appAct.body.activity._id;

    const joinReqRes = await guest.post(`/api/activities/${actId}/join`);
    expect(joinReqRes.status).toBe(201);
    expect(joinReqRes.body.requestStatus).toBe('PENDING');

    const detail = await creator.get(`/api/activities/${actId}`);
    expect(detail.body.pendingRequests).toHaveLength(1);
    const reqId = detail.body.pendingRequests[0].id;

    const acceptRes = await creator
      .post(`/api/activities/${actId}/requests/${reqId}/resolve`)
      .send({ decision: 'ACCEPT' });
    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.confirmedCount).toBe(2);

    // Report & Manager moderation
    const reportRes = await guest.post('/api/traveller/reports').send({
      activityId: actId,
      reason: 'Spam',
      description: 'Test report',
    });
    expect(reportRes.status).toBe(201);

    const mgrReports = await mgr.get('/api/manager/reports');
    expect(mgrReports.status).toBe(200);
    expect(mgrReports.body.reports).toHaveLength(1);

    const resolveReport = await mgr
      .patch(`/api/manager/reports/${mgrReports.body.reports[0]._id}`)
      .send({ status: 'DISMISSED', resolutionNote: 'Reviewed' });
    expect(resolveReport.status).toBe(200);
  });
});
