import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { auth, isMockAuth, mockRegister } from '../firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { User, Mail, Lock, Phone, Car, Hash, UserPlus } from 'lucide-react';
import axios from 'axios';

export default function Register() {
  const [role, setRole] = useState('passenger'); // 'driver' or 'passenger'
  const [formData, setFormData] = useState({
    name: '',
    phoneNumber: '',
    email: '',
    password: '',
    vehicleNumber: '', // For Driver
    vehicleType: '', // For Driver
    chosenVehicleNumber: '' // For Passenger
  });
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let userToken;
      
      if (isMockAuth) {
        const { user } = await mockRegister(formData.email);
        userToken = await user.getIdToken();
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        userToken = await userCredential.user.getIdToken();
      }

      // Register user in backend
      await axios.post(`${import.meta.env.VITE_API_URL}/auth/register`, {
        role,
        ...formData
      }, {
        headers: { Authorization: `Bearer ${userToken}` }
      });

      localStorage.setItem('userToken', userToken);
      localStorage.setItem('userRole', role);

      if (role === 'admin') navigate('/admin-dashboard');
      else if (role === 'driver') navigate('/driver-dashboard');
      else navigate('/passenger-dashboard');
      
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-light p-4 py-12">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-brand p-6 text-center text-white">
          <h2 className="text-3xl font-bold mb-2">Join E-Transport</h2>
          <p className="text-brand-light opacity-90">Create a new account</p>
        </div>

        <div className="p-8">
          <div className="flex rounded-md shadow-sm mb-6" role="group">
            <button
              onClick={() => setRole('passenger')}
              className={`flex-1 px-4 py-2 text-sm font-medium border border-gray-200 rounded-s-lg transition-colors ${role === 'passenger' ? 'bg-brand text-white border-brand' : 'bg-white text-gray-900 hover:bg-gray-100 hover:text-brand'}`}
            >
              Passenger
            </button>
            <button
              onClick={() => setRole('driver')}
              className={`flex-1 px-4 py-2 text-sm font-medium border border-gray-200 transition-colors ${role === 'driver' ? 'bg-brand text-white border-brand' : 'bg-white text-gray-900 hover:bg-gray-100 hover:text-brand'}`}
            >
              Driver
            </button>
            <button
              onClick={() => setRole('admin')}
              className={`flex-1 px-4 py-2 text-sm font-medium border border-gray-200 rounded-e-lg transition-colors ${role === 'admin' ? 'bg-brand text-white border-brand' : 'bg-white text-gray-900 hover:bg-gray-100 hover:text-brand'}`}
            >
              Admin
            </button>
          </div>

          {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">{error}</div>}

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><User className="h-5 w-5 text-gray-400" /></div>
                <input type="text" name="name" required value={formData.name} onChange={handleChange} className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-brand focus:border-brand" placeholder="John Doe" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Phone className="h-5 w-5 text-gray-400" /></div>
                <input type="tel" name="phoneNumber" required value={formData.phoneNumber} onChange={handleChange} className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-brand focus:border-brand" placeholder="+1234567890" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Mail className="h-5 w-5 text-gray-400" /></div>
                <input type="email" name="email" required value={formData.email} onChange={handleChange} className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-brand focus:border-brand" placeholder="mail@example.com" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Lock className="h-5 w-5 text-gray-400" /></div>
                <input type="password" name="password" required value={formData.password} onChange={handleChange} className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-brand focus:border-brand" placeholder="••••••••" />
              </div>
            </div>

            {role === 'driver' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Number</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Hash className="h-5 w-5 text-gray-400" /></div>
                    <input type="text" name="vehicleNumber" required value={formData.vehicleNumber} onChange={handleChange} className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-brand focus:border-brand" placeholder="ABC-1234" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Type</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Car className="h-5 w-5 text-gray-400" /></div>
                    <select name="vehicleType" required value={formData.vehicleType} onChange={handleChange} className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-brand focus:border-brand bg-white">
                      <option value="">Select Type</option>
                      <option value="sedan">Sedan</option>
                      <option value="suv">SUV</option>
                      <option value="van">Van</option>
                      <option value="bus">Minibus</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {role === 'passenger' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Target Vehicle Number</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Hash className="h-5 w-5 text-gray-400" /></div>
                  <input type="text" name="chosenVehicleNumber" required value={formData.chosenVehicleNumber} onChange={handleChange} className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-brand focus:border-brand" placeholder="Enter vehicle number to join" />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-6 bg-brand text-white font-semibold py-3 px-4 rounded-lg hover:bg-brand-dark transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
            >
              <UserPlus className="w-5 h-5" />
              {loading ? 'Registering...' : 'Register'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-600 text-sm">
              Already have an account?{' '}
              <Link to="/login" className="text-brand font-semibold hover:underline">
                Login here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
