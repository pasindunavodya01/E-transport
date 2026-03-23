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
  
  // Passenger specific fields
  chosenVehicleNumber: { type: String },
  
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
