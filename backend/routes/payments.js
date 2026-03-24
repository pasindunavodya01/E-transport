const express = require('express');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const User = require('../models/User');
const verifyToken = require('../middleware/firebaseAuth');

const router = express.Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure Multer with Cloudinary storage
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'e-transport/payments',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'heic'],
    transformation: [{ width: 1200, quality: 'auto', fetch_format: 'auto' }],
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10 MB limit

// ─────────────────────────────────────────────────────
// POST /api/payments/upload
// Passenger uploads a payment screenshot for a month
// ─────────────────────────────────────────────────────
router.post('/upload', verifyToken, upload.single('receipt'), async (req, res) => {
  try {
    const uid = req.user.uid;
    const { month, amount } = req.body; // month = "2026-03", amount = number

    if (!month || !amount || !req.file) {
      return res.status(400).json({ message: 'month, amount and receipt image are required.' });
    }

    const passenger = await User.findOne({ uid, role: 'passenger' });
    if (!passenger) return res.status(403).json({ message: 'Only passengers can submit payments.' });

    // Check if a payment for this month already exists
    const existing = passenger.payments.find(p => p.month === month);
    if (existing) {
      // Delete old image from Cloudinary
      if (existing.publicId) {
        await cloudinary.uploader.destroy(existing.publicId).catch(() => {});
      }
      // Update in-place
      existing.amount = parseFloat(amount);
      existing.imageUrl = req.file.path;
      existing.publicId = req.file.filename;
      existing.status = 'pending';
      existing.submittedAt = new Date();
      existing.reviewedAt = undefined;
      existing.note = undefined;
    } else {
      passenger.payments.push({
        month,
        amount: parseFloat(amount),
        imageUrl: req.file.path,
        publicId: req.file.filename,
        status: 'pending',
        submittedAt: new Date(),
      });
    }

    await passenger.save();
    res.json({ message: 'Payment submitted successfully.', payments: passenger.payments });
  } catch (error) {
    console.error('[/upload] error:', error);
    res.status(500).json({ message: 'Server error', detail: error.message });
  }
});

// ─────────────────────────────────────────────────────
// GET /api/payments/my-payments
// Passenger fetches their own payment history
// ─────────────────────────────────────────────────────
router.get('/my-payments', verifyToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const passenger = await User.findOne({ uid, role: 'passenger' }).select('payments name');
    if (!passenger) return res.status(403).json({ message: 'Passenger not found.' });

    const sorted = [...(passenger.payments || [])].sort((a, b) => b.month.localeCompare(a.month));
    res.json(sorted);
  } catch (error) {
    console.error('[/my-payments] error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────
// GET /api/payments/all-payments
// Driver fetches all passengers' payments
// ─────────────────────────────────────────────────────
router.get('/all-payments', verifyToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const driver = await User.findOne({ uid, role: 'driver' });
    if (!driver) return res.status(403).json({ message: 'Only drivers can view all payments.' });

    // Find passengers assigned to this driver's vehicle
    const passengers = await User.find({
      role: 'passenger',
      chosenVehicleNumber: driver.vehicleNumber,
    }).select('name email payments');

    const result = passengers.map(p => ({
      passengerId: p._id,
      name: p.name,
      email: p.email,
      payments: [...(p.payments || [])].sort((a, b) => b.month.localeCompare(a.month)),
    }));

    res.json(result);
  } catch (error) {
    console.error('[/all-payments] error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────
// PUT /api/payments/review/:passengerId/:paymentId
// Driver approves or rejects a payment
// ─────────────────────────────────────────────────────
router.put('/review/:passengerId/:paymentId', verifyToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const driver = await User.findOne({ uid, role: 'driver' });
    if (!driver) return res.status(403).json({ message: 'Only drivers can review payments.' });

    const { passengerId, paymentId } = req.params;
    const { status, note } = req.body; // status: 'approved' | 'rejected'

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'status must be "approved" or "rejected".' });
    }

    const passenger = await User.findById(passengerId);
    if (!passenger) return res.status(404).json({ message: 'Passenger not found.' });

    const payment = passenger.payments.id(paymentId);
    if (!payment) return res.status(404).json({ message: 'Payment record not found.' });

    payment.status = status;
    payment.note = note || '';
    payment.reviewedAt = new Date();

    await passenger.save();

    res.json({ message: `Payment ${status}.`, payment });
  } catch (error) {
    console.error('[/review] error:', error);
    res.status(500).json({ message: 'Server error', detail: error.message });
  }
});

// ─────────────────────────────────────────────────────
// POST /api/payments/admin/upload
// Driver uploads a system payment screenshot (to Admin)
// ─────────────────────────────────────────────────────
router.post('/admin/upload', verifyToken, upload.single('receipt'), async (req, res) => {
  try {
    const uid = req.user.uid;
    const { month, amount } = req.body; 

    if (!month || !amount || !req.file) {
      return res.status(400).json({ message: 'month, amount and receipt image are required.' });
    }

    const driver = await User.findOne({ uid, role: 'driver' });
    if (!driver) return res.status(403).json({ message: 'Only drivers can submit system payments.' });

    // Check if a payment for this month already exists
    const existing = driver.systemPayments.find(p => p.month === month);
    if (existing) {
      if (existing.publicId) {
        await cloudinary.uploader.destroy(existing.publicId).catch(() => {});
      }
      existing.amount = parseFloat(amount);
      existing.imageUrl = req.file.path;
      existing.publicId = req.file.filename;
      existing.status = 'pending';
      existing.submittedAt = new Date();
      existing.reviewedAt = undefined;
      existing.note = undefined;
    } else {
      driver.systemPayments.push({
        month,
        amount: parseFloat(amount),
        imageUrl: req.file.path,
        publicId: req.file.filename,
        status: 'pending',
        submittedAt: new Date(),
      });
    }

    await driver.save();
    res.json({ message: 'Payment submitted successfully.', systemPayments: driver.systemPayments });
  } catch (error) {
    console.error('[/admin/upload] error:', error);
    res.status(500).json({ message: 'Server error', detail: error.message });
  }
});

// ─────────────────────────────────────────────────────
// GET /api/payments/admin/my-payments
// Driver fetches their own system payment history
// ─────────────────────────────────────────────────────
router.get('/admin/my-payments', verifyToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const driver = await User.findOne({ uid, role: 'driver' }).select('systemPayments');
    if (!driver) return res.status(403).json({ message: 'Driver not found.' });

    const sorted = [...(driver.systemPayments || [])].sort((a, b) => b.month.localeCompare(a.month));
    res.json(sorted);
  } catch (error) {
    console.error('[/admin/my-payments] error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────
// GET /api/payments/admin/all-payments
// Admin fetches all drivers' payments
// ─────────────────────────────────────────────────────
router.get('/admin/all-payments', verifyToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const admin = await User.findOne({ uid, role: 'admin' });
    if (!admin) return res.status(403).json({ message: 'Only admins can view all driver payments.' });

    const drivers = await User.find({ role: 'driver' }).select('name email vehicleNumber systemPayments');

    const result = drivers.map(d => ({
      _id: d._id,
      driverId: d._id,
      name: d.name,
      email: d.email,
      vehicleNumber: d.vehicleNumber,
      payments: [...(d.systemPayments || [])].sort((a, b) => b.month.localeCompare(a.month)),
    }));

    res.json(result);
  } catch (error) {
    console.error('[/admin/all-payments] error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─────────────────────────────────────────────────────
// PUT /api/payments/admin/review/:driverId/:paymentId
// Admin approves or rejects a system payment
// ─────────────────────────────────────────────────────
router.put('/admin/review/:driverId/:paymentId', verifyToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const admin = await User.findOne({ uid, role: 'admin' });
    if (!admin) return res.status(403).json({ message: 'Only admins can review payments.' });

    const { driverId, paymentId } = req.params;
    const { status, note } = req.body; 

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'status must be "approved" or "rejected".' });
    }

    const driver = await User.findById(driverId);
    if (!driver) return res.status(404).json({ message: 'Driver not found.' });

    const payment = driver.systemPayments.id(paymentId);
    if (!payment) return res.status(404).json({ message: 'Payment record not found.' });

    payment.status = status;
    payment.note = note || '';
    payment.reviewedAt = new Date();

    await driver.save();

    res.json({ message: `Payment ${status}.`, payment });
  } catch (error) {
    console.error('[/admin/review] error:', error);
    res.status(500).json({ message: 'Server error', detail: error.message });
  }
});

module.exports = router;
