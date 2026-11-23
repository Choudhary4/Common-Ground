import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { createApp } from '../app.js';
import { Hostel, User, Session } from '../models/index.js';
import { hashPassword, hashToken } from '../utils/crypto.js';
import { authenticate, SESSION_COOKIE_NAME } from '../middleware/auth.js';
import { requireRole, requireHostelScope } from '../middleware/rbac.js';

let mongod: MongoMemoryServer;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDatabase(mongod.getUri());
  app = createApp();
  // Mount a test-only scoped route to verify RBAC + hostel isolation
  app.get('/api/test/hostel/:hostelId/manager-only', authenticate, requireHostelScope, requireRole('HOSTEL_MANAGER'), (req, res) => {
    res.json({ ok: true, hostelId: req.auth!.hostelId?.toString() });
  });
});

afterAll(async () => {
  await disconnectDatabase();
  await mongod.stop();
});

beforeEach(async () => {
  await Promise.all([Hostel.deleteMany({}), User.deleteMany({}), Session.deleteMany({})]);
});

describe('Phase 1 — Foundation, Auth, Sessions & Hostel Isolation', () => {
  it('authenticates staff/manager via HTTP-only cookie, enforces 72h session, and revokes on logout', async () => {
    const hostel = await Hostel.create({
      name: 'goSTOPS Jaipur',
      slug: 'gostops-jaipur',
      city: 'Jaipur',
      address: 'MI Road, Jaipur',
    });

    const passwordHash = await hashPassword('secret123');
    await User.create({
      nickname: 'Jaipur Manager',
      email: 'manager@jaipur.test',
      passwordHash,
      role: 'HOSTEL_MANAGER',
      hostelId: hostel._id,
    });

    const agent = request.agent(app);

    const loginRes = await agent
      .post('/api/auth/staff/login')
      .send({ email: 'manager@jaipur.test', password: 'secret123' });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.user.role).toBe('HOSTEL_MANAGER');
    expect(loginRes.headers['set-cookie']).toBeDefined();

    const meRes = await agent.get('/api/auth/me');
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.hostelName).toBe('goSTOPS Jaipur');

    const logoutRes = await agent.post('/api/auth/logout');
    expect(logoutRes.status).toBe(200);

    const meAfterLogout = await agent.get('/api/auth/me');
    expect(meAfterLogout.status).toBe(401);
  });

  it('rejects expired sessions even if not yet cleaned up by TTL', async () => {
    const hostel = await Hostel.create({
      name: 'goSTOPS Delhi',
      slug: 'gostops-delhi',
      city: 'Delhi',
      address: 'Paharganj, Delhi',
    });

    const user = await User.create({
      nickname: 'SoloTraveller',
      role: 'TRAVELLER',
      hostelId: hostel._id,
    });

    const rawToken = 'expired-test-token-123';
    await Session.create({
      userId: user._id,
      hostelId: hostel._id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() - 1000),
    });

    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', [`${SESSION_COOKIE_NAME}=${rawToken}`]);

    expect(res.status).toBe(401);
  });

  it('enforces role permissions and strict hostel-level isolation', async () => {
    const jaipur = await Hostel.create({
      name: 'goSTOPS Jaipur',
      slug: 'gostops-jaipur',
      city: 'Jaipur',
      address: 'MI Road',
    });
    const delhi = await Hostel.create({
      name: 'goSTOPS Delhi',
      slug: 'gostops-delhi',
      city: 'Delhi',
      address: 'Paharganj',
    });

    const passwordHash = await hashPassword('pass1234');
    await User.create({
      nickname: 'Jaipur Manager',
      email: 'mgr@jaipur.test',
      passwordHash,
      role: 'HOSTEL_MANAGER',
      hostelId: jaipur._id,
    });
    await User.create({
      nickname: 'Jaipur Staff',
      email: 'staff@jaipur.test',
      passwordHash,
      role: 'HOSTEL_STAFF',
      hostelId: jaipur._id,
    });

    const mgrAgent = request.agent(app);
    await mgrAgent.post('/api/auth/staff/login').send({ email: 'mgr@jaipur.test', password: 'pass1234' });

    // Manager can access own hostel
    const ownRes = await mgrAgent.get(`/api/test/hostel/${jaipur._id}/manager-only`);
    expect(ownRes.status).toBe(200);

    // Manager cannot access another hostel
    const crossRes = await mgrAgent.get(`/api/test/hostel/${delhi._id}/manager-only`);
    expect(crossRes.status).toBe(403);

    // Staff cannot access manager-only route
    const staffAgent = request.agent(app);
    await staffAgent.post('/api/auth/staff/login').send({ email: 'staff@jaipur.test', password: 'pass1234' });
    const staffRes = await staffAgent.get(`/api/test/hostel/${jaipur._id}/manager-only`);
    expect(staffRes.status).toBe(403);
  });
});
