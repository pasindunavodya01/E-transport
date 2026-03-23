const express = require('express');
const User = require('../models/User');
const verifyToken = require('../middleware/firebaseAuth');

const router = express.Router();

// Register a new user
router.post('/register', verifyToken, async (req, res) => {
  try {
    const { role, name, phoneNumber, email, vehicleNumber, vehicleType, chosenVehicleNumber } = req.body;
    const uid = req.user.uid;
    console.log('[REGISTER] decoded UID:', uid);

    // Check if user already exists
    let user = await User.findOne({ uid });
    if (user) {
      console.log('[REGISTER] user already exists with uid:', uid);
      return res.status(400).json({ message: 'User already exists' });
    }

    user = new User({
      uid,
      role,
      name,
      phoneNumber,
      email,
      vehicleNumber: role === 'driver' ? vehicleNumber : undefined,
      vehicleType: role === 'driver' ? vehicleType : undefined,
      chosenVehicleNumber: role === 'passenger' ? chosenVehicleNumber : undefined,
    });

    await user.save();
    res.status(201).json({ message: 'User registered successfully', user });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get current user profile
router.get('/me', verifyToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    console.log('[/me] decoded UID from token:', JSON.stringify(uid));

    // DEBUG: dump all stored UIDs so we can compare
    const allUsers = await User.find({}, 'uid email');
    console.log('[/me] all users in DB:', allUsers.map(u => ({ uid: u.uid, email: u.email })));

    const user = await User.findOne({ uid });
    if (!user) return res.status(404).json({ message: 'User not found. Please register first.', registered: false });
    res.json(user);
  } catch (error) {
    console.error('[/me] error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get passengers for a driver
router.get('/passengers', verifyToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const driver = await User.findOne({ uid, role: 'driver' });
    
    if (!driver) {
      return res.status(403).json({ message: 'Only drivers can view passengers' });
    }

    if (!driver.vehicleNumber) {
      return res.json([]);
    }

    // Find passengers whose chosen vehicle number matches the driver's vehicle number
    const passengers = await User.find({
      role: 'passenger',
      chosenVehicleNumber: driver.vehicleNumber
    }).select('-__v -uid'); // Exclude sensitive/internal fields

    res.json(passengers);
  } catch (error) {
    console.error('[/passengers] error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update driver route information
router.put('/update-route', verifyToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const { routes, totalSeats } = req.body;
    
    const driver = await User.findOneAndUpdate(
      { uid, role: 'driver' },
      { routes, totalSeats },
      { new: true }
    );

    if (!driver) {
      return res.status(404).json({ message: 'Driver not found' });
    }

    res.json(driver);
  } catch (error) {
    console.error('[/update-route] error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get passenger's assigned driver details
router.get('/my-driver', verifyToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const passenger = await User.findOne({ uid, role: 'passenger' });
    
    if (!passenger) {
      return res.status(403).json({ message: 'Only passengers can fetch their assigned driver' });
    }

    if (!passenger.chosenVehicleNumber) {
      return res.json(null);
    }

    const driver = await User.findOne({
      role: 'driver',
      vehicleNumber: passenger.chosenVehicleNumber
    }).select('-__v -uid'); 

    if (!driver) {
      return res.status(404).json({ message: 'Assigned driver not found' });
    }

    res.json(driver);
  } catch (error) {
    console.error('[/my-driver] error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update passenger pickup and dropoff locations
router.put('/update-locations', verifyToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const { pickupLocation, dropoffLocation } = req.body;
    
    const passenger = await User.findOneAndUpdate(
      { uid, role: 'passenger' },
      { pickupLocation, dropoffLocation },
      { new: true }
    );

    if (!passenger) {
      return res.status(404).json({ message: 'Passenger not found' });
    }

    res.json(passenger);
  } catch (error) {
    console.error('[/update-locations] error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update passenger absences
router.put('/update-absences', verifyToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const { absences } = req.body;
    
    // Ensure absences is an array, fallback to empty array
    const absenceList = Array.isArray(absences) ? absences : [];
    
    const passenger = await User.findOneAndUpdate(
      { uid, role: 'passenger' },
      { absences: absenceList },
      { new: true }
    );

    if (!passenger) {
      return res.status(404).json({ message: 'Passenger not found' });
    }

    res.json(passenger);
  } catch (error) {
    console.error('[/update-absences] error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
