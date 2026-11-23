import { Router } from 'express';
import { Hostel, HostelQR, AnalyticsEvent } from '../models/index.js';
import { hashToken } from '../utils/crypto.js';

const router = Router();

router.get('/resolve/:token', async (req, res, next) => {
  try {
    const { token } = req.params;
    if (!token || token.length < 10) {
      res.status(400).json({ error: 'Invalid QR code' });
      return;
    }

    const tokenHash = hashToken(token);
    const qr = await HostelQR.findOne({ tokenHash, status: 'ACTIVE' });
    if (!qr) {
      res.status(404).json({ error: 'This QR code is invalid or has been revoked.' });
      return;
    }

    const hostel = await Hostel.findOne({ _id: qr.hostelId, status: 'ACTIVE' }).lean();
    if (!hostel) {
      res.status(404).json({ error: 'Hostel is currently unavailable.' });
      return;
    }

    await HostelQR.updateOne({ _id: qr._id }, { $inc: { scanCount: 1 } });
    await AnalyticsEvent.create({
      hostelId: hostel._id,
      eventType: 'QR_SCAN',
      isDemo: hostel.isDemo,
    });

    res.json({
      hostel: {
        id: hostel._id,
        name: hostel.name,
        city: hostel.city,
        address: hostel.address,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
