const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true }, // Firebase UID
  role: { type: String, enum: ['driver', 'passenger', 'admin'], required: true },
  name: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  
  // Driver specific fields
  vehicleNumber: { type: String },
  vehicleType: { type: String },
  routes: [{
    route: { type: String },
    via: { type: String },
    startTime: { type: String },
    polyline: { type: String }
  }],
  totalSeats: { type: Number },
  pricePerKm: { type: Number, default: 0 },
  isTripActive: { type: Boolean, default: false },
  currentLocation: {
    lat: { type: Number },
    lng: { type: Number },
    timestamp: { type: Date }
  },
  bankDetails: {
    bankName: { type: String },
    accountName: { type: String },
    accountNumber: { type: String },
    branchName: { type: String }
  },
  systemPayments: [{
    month: { type: String },           // e.g. "2026-03"
    amount: { type: Number },
    imageUrl: { type: String },        // Cloudinary secure URL
    publicId: { type: String },        // Cloudinary public_id for deletion
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    submittedAt: { type: Date, default: Date.now },
    reviewedAt: { type: Date },
    note: { type: String }             // Admin's optional feedback
  }],
  
  // Passenger specific fields
  chosenVehicleNumber: { type: String },
  pickupLocation: { type: mongoose.Schema.Types.Mixed },
  dropoffLocation: { type: mongoose.Schema.Types.Mixed },
  absences: [{
    date: { type: String },
    period: { type: String, enum: ['Morning', 'Evening', 'Both'], default: 'Both' }
  }],
  extraBookings: [{
    date: { type: String, required: true },
    period: { type: String, enum: ['Morning', 'Evening', 'Both'], required: true },
    seats: { type: Number, required: true, min: 1 },
    pickupLocation: { type: mongoose.Schema.Types.Mixed },
    dropoffLocation: { type: mongoose.Schema.Types.Mixed },
    distanceKm: { type: Number },
    price: { type: Number }
  }],
  payments: [{
    month: { type: String },           // e.g. "2026-03"
    amount: { type: Number },
    imageUrl: { type: String },        // Cloudinary secure URL
    publicId: { type: String },        // Cloudinary public_id for deletion
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    submittedAt: { type: Date, default: Date.now },
    reviewedAt: { type: Date },
    note: { type: String }             // Driver's optional feedback
  }],
  
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
