import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { LogOut, Car, Hash, User, Phone, Mail } from 'lucide-react';

export default function DriverDashboard() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [passengers, setPassengers] = useState([]);
  const [loadingPassengers, setLoadingPassengers] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem('userToken');
        if (!token) return navigate('/login');

        const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (data.role !== 'driver') {
          return navigate('/passenger-dashboard');
        }
        setProfile(data);
      } catch (error) {
        console.error('Error fetching driver profile', error);
        navigate('/login');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [navigate]);

  useEffect(() => {
    const fetchPassengers = async () => {
      try {
        const token = localStorage.getItem('userToken');
        if (!token) return;

        const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/auth/passengers`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        setPassengers(data);
      } catch (error) {
        console.error('Error fetching passengers', error);
      } finally {
        setLoadingPassengers(false);
      }
    };
    fetchPassengers();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('userToken');
    localStorage.removeItem('userRole');
    navigate('/login');
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-brand-light text-brand text-xl">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <nav className="bg-brand text-white shadow-md w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Car className="w-6 h-6" /> E-Transport Driver
            </h1>
            <button onClick={handleLogout} className="flex items-center gap-2 hover:bg-brand-dark px-3 py-2 rounded-lg transition-colors">
              <LogOut className="w-5 h-5" /> Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto mt-8 px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 md:p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-brand-light text-brand rounded-full flex items-center justify-center text-2xl font-bold">
                {profile?.name?.charAt(0)}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Welcome, {profile?.name}</h2>
                <p className="text-gray-500">Driver Dashboard</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Personal Info</h3>
                <div className="space-y-3">
                  <p className="flex items-center gap-3 text-gray-700"><User className="w-5 h-5 text-brand" /> {profile?.name}</p>
                  <p className="flex items-center gap-3 text-gray-700"><Phone className="w-5 h-5 text-brand" /> {profile?.phoneNumber}</p>
                  <p className="flex items-center gap-3 text-gray-700"><Mail className="w-5 h-5 text-brand" /> {profile?.email}</p>
                </div>
              </div>
              
              <div className="bg-brand-light p-6 rounded-xl border border-brand-light">
                <h3 className="text-lg font-semibold text-brand-dark mb-4 border-b border-brand/20 pb-2">Vehicle Info</h3>
                <div className="space-y-3">
                  <p className="flex items-center gap-3 text-gray-800"><Hash className="w-5 h-5 text-brand" /> <span className="font-medium">Number:</span> {profile?.vehicleNumber}</p>
                  <p className="flex items-center gap-3 text-gray-800"><Car className="w-5 h-5 text-brand" /> <span className="font-medium">Type:</span> <span className="capitalize">{profile?.vehicleType}</span></p>
                </div>
              </div>
            </div>

            <div className="mt-8 border-t border-gray-100 pt-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <User className="w-6 h-6 text-brand" /> My Passengers
                </h3>
                <span className="bg-brand-light text-brand font-bold py-1 px-3 rounded-full text-sm">
                  {passengers.length}
                </span>
              </div>
              
              {loadingPassengers ? (
                <div className="text-gray-500 py-4 text-center">Loading passengers...</div>
              ) : passengers.length === 0 ? (
                <div className="text-gray-500 py-8 text-center bg-gray-50 rounded-xl border border-gray-100 italic">
                  No passengers have selected your vehicle yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {passengers.map((passenger) => (
                    <div key={passenger._id} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-brand">
                      <h4 className="font-semibold text-gray-900 text-lg mb-3">{passenger.name}</h4>
                      <div className="space-y-2">
                        <p className="flex items-center gap-3 text-gray-600 text-sm"><Phone className="w-4 h-4 text-gray-400" /> {passenger.phoneNumber}</p>
                        <p className="flex items-center gap-3 text-gray-600 text-sm"><Mail className="w-4 h-4 text-gray-400" /> {passenger.email}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
          </div>
        </div>
      </main>
    </div>
  );
}
