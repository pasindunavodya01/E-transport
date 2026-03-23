import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { LogOut, MapPin, Hash, User, Phone, Mail } from 'lucide-react';

export default function PassengerDashboard() {
  const [profile, setProfile] = useState(null);
  const [driverProfile, setDriverProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditingLocations, setIsEditingLocations] = useState(false);
  const [locationData, setLocationData] = useState({ pickupLocation: '', dropoffLocation: '' });
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
        setLocationData({
          pickupLocation: data.pickupLocation || '',
          dropoffLocation: data.dropoffLocation || ''
        });

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

  const handleSaveLocations = async () => {
    try {
      const token = localStorage.getItem('userToken');
      const { data } = await axios.put(`${import.meta.env.VITE_API_URL}/auth/update-locations`, {
        pickupLocation: locationData.pickupLocation,
        dropoffLocation: locationData.dropoffLocation
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProfile(data);
      setIsEditingLocations(false);
    } catch (error) {
      console.error('Error updating locations', error);
      alert('Failed to update locations');
    }
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

            <div className="mt-8 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="flex justify-between items-center mb-4 border-b pb-2">
                <h3 className="text-lg font-semibold text-gray-900">My Trip Locations</h3>
                {!isEditingLocations && (
                  <button onClick={() => setIsEditingLocations(true)} className="text-brand text-sm font-semibold hover:underline">
                    Edit Locations
                  </button>
                )}
              </div>
              
              {isEditingLocations ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Pickup Location</label>
                    <input type="text" value={locationData.pickupLocation} onChange={e => setLocationData({...locationData, pickupLocation: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent" placeholder="e.g., Dematagoda Station"/>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Drop-off Location</label>
                    <input type="text" value={locationData.dropoffLocation} onChange={e => setLocationData({...locationData, dropoffLocation: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent" placeholder="e.g., Kandy Town"/>
                  </div>
                  <div className="md:col-span-2 flex gap-2 justify-end mt-2">
                    <button onClick={() => setIsEditingLocations(false)} className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Cancel</button>
                    <button onClick={handleSaveLocations} className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-dark transition-colors">Save</button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-100 text-center sm:text-left">
                    <p className="text-sm text-gray-500 mb-1">Pickup</p>
                    <p className="font-bold text-gray-900 flex items-center justify-center sm:justify-start gap-2">
                      <MapPin className="w-4 h-4 text-brand" /> {profile?.pickupLocation || 'Not set'}
                    </p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-100 text-center sm:text-left">
                    <p className="text-sm text-gray-500 mb-1">Drop-off</p>
                    <p className="font-bold text-gray-900 flex items-center justify-center sm:justify-start gap-2">
                      <MapPin className="w-4 h-4 text-brand" /> {profile?.dropoffLocation || 'Not set'}
                    </p>
                  </div>
                </div>
              )}
            </div>
            
          </div>
        </div>
      </main>
    </div>
  );
}
