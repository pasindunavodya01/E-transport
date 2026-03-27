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
    const { routes, totalSeats, pricePerKm } = req.body;
    let updateData = { routes, totalSeats };
    if (pricePerKm !== undefined) updateData.pricePerKm = pricePerKm;
    
    const driver = await User.findOneAndUpdate(
      { uid, role: 'driver' },
      updateData,
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
    const { pickupLocation, dropoffLocation, morningLocation, eveningLocation, locations } = req.body;
    
    let updateData = {};
    if (pickupLocation) updateData.pickupLocation = pickupLocation;
    if (dropoffLocation) updateData.dropoffLocation = dropoffLocation;

    // Harmonize locations update
    if (locations) {
      // Use the nested locations structure directly if provided (from Web)
      updateData.locations = locations;
    } else if (morningLocation || eveningLocation) {
      // Handle individual period updates (from Mobile or legacy)
      const passenger = await User.findOne({ uid, role: 'passenger' });
      const currentLocs = passenger.locations || { morning: {}, evening: {} };
      updateData.locations = {
        morning: morningLocation || currentLocs.morning,
        evening: eveningLocation || currentLocs.evening
      };
    }

    const passenger = await User.findOneAndUpdate(
      { uid, role: 'passenger' },
      { $set: updateData },
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

    // Emit socket event for availability change
    const io = req.app.get('socketio');
    if (io && passenger.chosenVehicleNumber) {
      io.emit(`availability_update_${passenger.chosenVehicleNumber}`, { vehicleNumber: passenger.chosenVehicleNumber });
    }
  } catch (error) {
    console.error('[/update-absences] error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Calculate Ride Availability
router.get('/ride-availability', verifyToken, async (req, res) => {
  try {
    const { date, period } = req.query;
    if (!date || !period) return res.status(400).json({ message: 'Date and period required' });

    const uid = req.user.uid;
    const passenger = await User.findOne({ uid, role: 'passenger' });
    if (!passenger || !passenger.chosenVehicleNumber) {
      return res.status(404).json({ message: 'Passenger or chosen vehicle not found' });
    }

    const driver = await User.findOne({ vehicleNumber: passenger.chosenVehicleNumber, role: 'driver' });
    if (!driver || !driver.totalSeats) {
      return res.json({ availableSeats: 0, totalSeats: 0, message: 'Driver has not set total seats' });
    }

    const totalSeats = driver.totalSeats;
    const allPassengers = await User.find({ chosenVehicleNumber: passenger.chosenVehicleNumber, role: 'passenger' });
    
    let absentCount = 0;
    let extraBookingsCount = 0;

    allPassengers.forEach(p => {
      const isAbsent = p.absences && p.absences.some(a => a.date === date && (a.period === period || a.period === 'Both'));
      if (isAbsent) absentCount++;

      if (p.extraBookings) {
        p.extraBookings.forEach(eb => {
          if (eb.date === date && (eb.period === period || eb.period === 'Both')) {
            extraBookingsCount += eb.seats;
          }
        });
      }
    });

    const presentPassengers = allPassengers.length - absentCount;
    const freeSeats = totalSeats - presentPassengers - extraBookingsCount;

    res.json({ availableSeats: Math.max(0, freeSeats), totalSeats, pricePerKm: driver.pricePerKm || 0 });
  } catch (error) {
    console.error('[/ride-availability] error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update Extra Bookings
router.put('/update-extra-bookings', verifyToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const { extraBookings } = req.body;
    
    const bookingsList = Array.isArray(extraBookings) ? extraBookings : [];
    
    const passenger = await User.findOneAndUpdate(
      { uid, role: 'passenger' },
      { extraBookings: bookingsList },
      { new: true }
    );

    if (!passenger) {
      return res.status(404).json({ message: 'Passenger not found' });
    }

    res.json(passenger);

    // Emit socket event for availability change
    const io = req.app.get('socketio');
    if (io && passenger.chosenVehicleNumber) {
      io.emit(`availability_update_${passenger.chosenVehicleNumber}`, { vehicleNumber: passenger.chosenVehicleNumber });
    }
  } catch (error) {
    console.error('[/update-extra-bookings] error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update Driver Bank Details
router.put('/update-bank-details', verifyToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const { bankDetails } = req.body;
    
    const driver = await User.findOne({ uid, role: 'driver' });
    if (!driver) {
      return res.status(403).json({ message: 'Only drivers can update bank details' });
    }

    driver.bankDetails = {
      bankName: bankDetails?.bankName || '',
      accountName: bankDetails?.accountName || '',
      accountNumber: bankDetails?.accountNumber || '',
      branchName: bankDetails?.branchName || ''
    };

    await driver.save();
    res.json(driver);
  } catch (error) {
    console.error('[/update-bank-details] error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Start Trip
router.put('/start-trip', verifyToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const { activeRouteIndex } = req.body;
    
    const driver = await User.findOneAndUpdate(
      { uid, role: 'driver' },
      { isTripActive: true, activeRouteIndex: activeRouteIndex !== undefined ? activeRouteIndex : 0 },
      { new: true }
    );
    if (!driver) return res.status(404).json({ message: 'Driver not found' });
    res.json({ isTripActive: driver.isTripActive, activeRouteIndex: driver.activeRouteIndex });

    // Emit socket event for trip status
    const io = req.app.get('socketio');
    if (io) {
      io.emit(`trip_status_update_${uid}`, { 
        driverId: uid, 
        isTripActive: true, 
        activeRouteIndex: driver.activeRouteIndex 
      });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// End Trip
router.put('/end-trip', verifyToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const driver = await User.findOneAndUpdate(
      { uid, role: 'driver' },
      { isTripActive: false, activeRouteIndex: null },
      { new: true }
    );
    if (!driver) return res.status(404).json({ message: 'Driver not found' });
    res.json({ isTripActive: driver.isTripActive });

    // Emit socket event for trip status
    const io = req.app.get('socketio');
    if (io) {
      io.emit(`trip_status_update_${uid}`, { driverId: uid, isTripActive: false });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update Location
router.put('/update-location', verifyToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const { lat, lng } = req.body;
    if (lat === undefined || lng === undefined) return res.status(400).json({ message: 'Coordinates required' });

    const driver = await User.findOneAndUpdate(
      { uid, role: 'driver' },
      { currentLocation: { lat, lng, timestamp: new Date() } },
      { new: true }
    );
    
    if (!driver) return res.status(404).json({ message: 'Driver not found' });
    res.json({ currentLocation: driver.currentLocation });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
