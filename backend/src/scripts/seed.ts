import 'dotenv/config';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import {
  Hostel,
  User,
  HostelQR,
  AccessCode,
  SocialStatus,
  Activity,
  ActivityParticipant,
} from '../models/index.js';
import {
  hashPassword,
  generateSecureToken,
  hashToken,
  encryptSecret,
  hashAccessCode,
} from '../utils/crypto.js';
import { env } from '../config/env.js';

async function seed() {
  await connectDatabase();
  console.log('Connected to MongoDB for seeding...');

  await Promise.all([
    Hostel.deleteMany({}),
    User.deleteMany({}),
    HostelQR.deleteMany({}),
    AccessCode.deleteMany({}),
    SocialStatus.deleteMany({}),
    Activity.deleteMany({}),
    ActivityParticipant.deleteMany({}),
  ]);

  const [jaipur, delhi] = await Hostel.create([
    {
      name: 'goSTOPS Jaipur',
      slug: 'gostops-jaipur',
      city: 'Jaipur',
      address: 'MI Road, Panch Batti, Jaipur',
      status: 'ACTIVE',
      isDemo: true,
    },
    {
      name: 'goSTOPS Delhi',
      slug: 'gostops-delhi',
      city: 'Delhi',
      address: 'Asaf Ali Road, Paharganj, New Delhi',
      status: 'ACTIVE',
      isDemo: true,
    },
  ]);

  const adminPass = await hashPassword('Admin@1234');
  const managerPass = await hashPassword('Manager@1234');
  const staffPass = await hashPassword('Staff@1234');

  const admin = await User.create({
    nickname: 'Central Admin',
    email: 'admin@commonground.local',
    passwordHash: adminPass,
    role: 'CENTRAL_ADMIN',
    hostelId: null,
    isDemo: true,
  });

  const [jaipurMgr, delhiMgr, jaipurStaff, delhiStaff] = await User.create([
    {
      nickname: 'Aarav (Jaipur Manager)',
      email: 'manager.jaipur@commonground.local',
      passwordHash: managerPass,
      role: 'HOSTEL_MANAGER',
      hostelId: jaipur._id,
      isDemo: true,
    },
    {
      nickname: 'Meera (Delhi Manager)',
      email: 'manager.delhi@commonground.local',
      passwordHash: managerPass,
      role: 'HOSTEL_MANAGER',
      hostelId: delhi._id,
      isDemo: true,
    },
    {
      nickname: 'Rohan (Jaipur Staff)',
      email: 'staff.jaipur@commonground.local',
      passwordHash: staffPass,
      role: 'HOSTEL_STAFF',
      hostelId: jaipur._id,
      isDemo: true,
    },
    {
      nickname: 'Karan (Delhi Staff)',
      email: 'staff.delhi@commonground.local',
      passwordHash: staffPass,
      role: 'HOSTEL_STAFF',
      hostelId: delhi._id,
      isDemo: true,
    },
  ]);

  const jaipurToken = generateSecureToken(24);
  const delhiToken = generateSecureToken(24);

  await HostelQR.create([
    {
      hostelId: jaipur._id,
      tokenHash: hashToken(jaipurToken),
      tokenEncrypted: encryptSecret(jaipurToken),
      status: 'ACTIVE',
      createdBy: jaipurStaff._id,
    },
    {
      hostelId: delhi._id,
      tokenHash: hashToken(delhiToken),
      tokenEncrypted: encryptSecret(delhiToken),
      status: 'ACTIVE',
      createdBy: delhiStaff._id,
    },
  ]);

  const jaipurCode = 'JPR101';
  const delhiCode = 'DEL202';

  await AccessCode.create([
    {
      hostelId: jaipur._id,
      codeHash: hashAccessCode(jaipurCode),
      codeEncrypted: encryptSecret(jaipurCode),
      status: 'ACTIVE',
      createdBy: jaipurStaff._id,
    },
    {
      hostelId: delhi._id,
      codeHash: hashAccessCode(delhiCode),
      codeEncrypted: encryptSecret(delhiCode),
      status: 'ACTIVE',
      createdBy: delhiStaff._id,
    },
  ]);

  const [t1, t2, t3] = await User.create([
    {
      nickname: 'Ananya (Demo)',
      role: 'TRAVELLER',
      hostelId: jaipur._id,
      interests: ['Chai', 'Photography', 'Board Games'],
      isDemo: true,
    },
    {
      nickname: 'Liam (Demo)',
      role: 'TRAVELLER',
      hostelId: jaipur._id,
      interests: ['Street Food', 'Walking Tours'],
      isDemo: true,
    },
    {
      nickname: 'Maya (Demo)',
      role: 'TRAVELLER',
      hostelId: delhi._id,
      interests: ['Museums', 'Coffee'],
      isDemo: true,
    },
  ]);

  const twoHoursLater = new Date(Date.now() + 2 * 60 * 60 * 1000);
  await SocialStatus.create([
    { userId: t1._id, hostelId: jaipur._id, status: 'OPEN_TO_MEETING', expiresAt: twoHoursLater },
    { userId: t2._id, hostelId: jaipur._id, status: 'UP_FOR_ACTIVITIES', expiresAt: twoHoursLater },
    { userId: t3._id, hostelId: delhi._id, status: 'LOOKING_FOR_COMPANY', expiresAt: twoHoursLater },
  ]);

  const now = Date.now();
  const [a1, a2, a3] = await Activity.create([
    {
      hostelId: jaipur._id,
      creatorId: jaipurMgr._id,
      creatorType: 'HOSTEL_MANAGER',
      title: 'Rooftop UNO & Chai Night (Demo)',
      description: 'Official hostel hangout! Grab a cup of masala chai and join us for UNO and music.',
      category: 'GAMES',
      scheduledAt: new Date(now + 60 * 60 * 1000),
      endsAt: new Date(now + 3 * 60 * 60 * 1000),
      meetingPoint: 'Rooftop Common Area',
      maxParticipants: 16,
      confirmedCount: 2,
      joinMode: 'PUBLIC',
      status: 'OPEN',
      isDemo: true,
    },
    {
      hostelId: jaipur._id,
      creatorId: t1._id,
      creatorType: 'TRAVELLER',
      title: 'Sunset Walk to Nahargarh Fort (Demo)',
      description: 'Heading up for sunset views and evening snacks. Happy to share a cab!',
      category: 'EXPLORATION',
      scheduledAt: new Date(now + 4 * 60 * 60 * 1000),
      endsAt: new Date(now + 7 * 60 * 60 * 1000),
      meetingPoint: 'Main Reception Lobby',
      maxParticipants: 5,
      confirmedCount: 1,
      joinMode: 'APPROVAL',
      status: 'OPEN',
      isDemo: true,
    },
    {
      hostelId: delhi._id,
      creatorId: delhiMgr._id,
      creatorType: 'HOSTEL_MANAGER',
      title: 'Old Delhi Street Food Walk (Demo)',
      description: 'Guided evening food walk through Chandni Chowk with fellow travellers.',
      category: 'FOOD',
      scheduledAt: new Date(now + 2 * 60 * 60 * 1000),
      endsAt: new Date(now + 5 * 60 * 60 * 1000),
      meetingPoint: 'Ground Floor Lounge',
      maxParticipants: 12,
      confirmedCount: 1,
      joinMode: 'PUBLIC',
      status: 'OPEN',
      isDemo: true,
    },
  ]);

  await ActivityParticipant.create([
    { activityId: a1._id, hostelId: jaipur._id, userId: jaipurMgr._id, status: 'CONFIRMED' },
    { activityId: a1._id, hostelId: jaipur._id, userId: t2._id, status: 'CONFIRMED' },
    { activityId: a2._id, hostelId: jaipur._id, userId: t1._id, status: 'CONFIRMED' },
    { activityId: a3._id, hostelId: delhi._id, userId: delhiMgr._id, status: 'CONFIRMED' },
  ]);

  const baseQrUrl = env.QR_BASE_URL.replace(/\/$/, '');
  console.log('\n--- Seed Complete (Demo Data Only) ---');
  console.log(`Central Admin: admin@commonground.local / Admin@1234 (id: ${admin._id})`);
  console.log(`Jaipur Manager: manager.jaipur@commonground.local / Manager@1234`);
  console.log(`Jaipur Staff: staff.jaipur@commonground.local / Staff@1234`);
  console.log(`Jaipur QR URL: ${baseQrUrl}/${jaipurToken}?code=${jaipurCode}`);
  console.log(`Jaipur Access Code: ${jaipurCode}`);
  console.log(`Delhi Manager: manager.delhi@commonground.local / Manager@1234`);
  console.log(`Delhi Staff: staff.delhi@commonground.local / Staff@1234`);
  console.log(`Delhi QR URL: ${baseQrUrl}/${delhiToken}?code=${delhiCode}`);
  console.log(`Delhi Access Code: ${delhiCode}`);

  await disconnectDatabase();
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
