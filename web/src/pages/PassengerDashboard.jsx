import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { LogOut, MapPin, Hash, User, Phone, Mail } from 'lucide-react';

export default function PassengerDashboard() {
  const [profile, setProfile] = useState(null);
  const [driverProfile, setDriverProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem('userToken');
        if (!token) return navigate('/login');

        const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (data.role !== 'passenger') {
          return navigate('/driver-dashboard');
        }
        setProfile(data);

        // Fetch assigned driver details
        try {
          const driverRes = await axios.get(`${import.meta.env.VITE_API_URL}/auth/my-driver`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setDriverProfile(driverRes.data);
        } catch (err) {
          console.error('Error fetching driver details');
        }

      } catch (error) {
        console.error('Error fetching passenger profile', error);
        navigate('/login');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [navigate]);

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
              <MapPin className="w-6 h-6" /> E-Transport
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
                <p className="text-gray-500">Passenger Dashboard</p>
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
                <h3 className="text-lg font-semibold text-brand-dark mb-4 border-b border-brand/20 pb-2">Trip Status</h3>
                <div className="space-y-4 p-5 bg-white rounded-xl shadow-sm border border-gray-100">
                  <div>
                    <p className="text-gray-500 text-sm mb-1">Target Vehicle</p>
                    <p className="flex items-center gap-3 text-gray-900 text-xl font-bold">
                      <Hash className="w-6 h-6 text-brand" /> {profile?.chosenVehicleNumber || 'Not assigned'}
                    </p>
                  </div>

                  {driverProfile && (
                    <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Driver</p>
                        <p className="font-semibold text-gray-800">{driverProfile.name}</p>
                        <p className="text-sm text-gray-600 flex items-center gap-1 mt-1"><Phone className="w-3 h-3"/>{driverProfile.phoneNumber}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Vehicle</p>
                        <p className="font-semibold text-gray-800 capitalize">{driverProfile.vehicleType}</p>
                      </div>
                      <div className="sm:col-span-2 mt-2">
                        <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">Route Info</p>
                        {(driverProfile.routes && driverProfile.routes.length > 0) ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {driverProfile.routes.map((r, i) => (
                              <div key={i} className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-sm space-y-1">
                                <p><span className="font-medium text-gray-700">Route {i + 1}:</span> {r.route || 'Not set'}</p>
                                <p><span className="font-medium text-gray-700">Time:</span> {r.startTime || 'Not set'}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-sm text-gray-500 italic">No routes recorded for this driver</div>
                        )}
                        <div className="mt-3 bg-brand-light/50 p-3 rounded-lg border border-brand-light text-sm">
                          <p><span className="font-medium text-brand-dark">Total Seats Configured:</span> {driverProfile.totalSeats || 'Not set'}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
