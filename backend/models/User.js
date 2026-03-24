const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true }, // Firebase UID
  role: { type: String, enum: ['driver', 'passenger'], required: true },
  name: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  
  // Driver specific fields
  vehicleNumber: { type: String },
  vehicleType: { type: String },
  routes: [{
    route: { type: String },
    startTime: { type: String }
  }],
  totalSeats: { type: Number },
  isTripActive: { type: Boolean, default: false },
  currentLocation: {
    lat: { type: Number },
    lng: { type: Number },
    timestamp: { type: Date }
  },
  
  // Passenger specific fields
  chosenVehicleNumber: { type: String },
  pickupLocation: { type: String },
  dropoffLocation: { type: String },
  absences: [{
    date: { type: String },
    period: { type: String, enum: ['Morning', 'Evening', 'Both'], default: 'Both' }
  }],
  extraBookings: [{
    date: { type: String, required: true },
    period: { type: String, enum: ['Morning', 'Evening', 'Both'], required: true },
    seats: { type: Number, required: true, min: 1 }
  }],
  
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
