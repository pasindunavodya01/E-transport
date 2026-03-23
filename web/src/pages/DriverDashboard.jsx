import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { LogOut, Car, Hash, User, Phone, Mail, MapPin, Calendar, AlertCircle } from 'lucide-react';

export default function DriverDashboard() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [passengers, setPassengers] = useState([]);
  const [loadingPassengers, setLoadingPassengers] = useState(true);
  const [isEditingRoute, setIsEditingRoute] = useState(false);
  const [routeData, setRouteData] = useState({ routes: [], totalSeats: '' });
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
        setRouteData({
          routes: data.routes || [],
          totalSeats: data.totalSeats || ''
        });
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

  const getTodayStr = () => {
    const d = new Date();
    const tzOffset = d.getTimezoneOffset() * 60000;
    return (new Date(d - tzOffset)).toISOString().split('T')[0];
  };

  const handleLogout = () => {
    localStorage.removeItem('userToken');
    localStorage.removeItem('userRole');
    navigate('/login');
  };

  const handleSaveRoute = async () => {
    try {
      const token = localStorage.getItem('userToken');
      const { data } = await axios.put(`${import.meta.env.VITE_API_URL}/auth/update-route`, {
        routes: routeData.routes,
        totalSeats: parseInt(routeData.totalSeats) || 0
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProfile(data);
      setIsEditingRoute(false);
    } catch (error) {
      console.error('Error updating route', error);
      alert('Failed to update route information');
    }
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

            <div className="mt-8 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="flex justify-between items-center mb-4 border-b pb-2">
                <h3 className="text-lg font-semibold text-gray-900">Route Information</h3>
                {!isEditingRoute && (
                  <button onClick={() => setIsEditingRoute(true)} className="text-brand text-sm font-semibold hover:underline">
                    Edit Route
                  </button>
                )}
              </div>
              
              {isEditingRoute ? (
                <div className="space-y-4">
                  {routeData.routes.map((r, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-100 relative">
                      <button 
                        onClick={() => {
                          const newRoutes = [...routeData.routes];
                          newRoutes.splice(index, 1);
                          setRouteData({...routeData, routes: newRoutes});
                        }}
                        className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold hover:bg-red-200"
                      >
                        X
                      </button>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Route (e.g., Colombo - Kandy)</label>
                        <input type="text" value={r.route} onChange={e => {
                          const newRoutes = [...routeData.routes];
                          newRoutes[index].route = e.target.value;
                          setRouteData({...routeData, routes: newRoutes});
                        }} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"/>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Start Time (e.g., 08:00 AM)</label>
                        <input type="text" value={r.startTime} onChange={e => {
                          const newRoutes = [...routeData.routes];
                          newRoutes[index].startTime = e.target.value;
                          setRouteData({...routeData, routes: newRoutes});
                        }} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"/>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-center">
                    <button 
                      onClick={() => setRouteData({...routeData, routes: [...routeData.routes, { route: '', startTime: '' }]})}
                      className="text-brand text-sm font-semibold hover:underline"
                    >
                      + Add Another Route
                    </button>
                  </div>
                  <div className="border-t pt-4 mt-4">
                    <div className="w-full md:w-1/3">
                      <label className="block text-sm text-gray-600 mb-1">Total Seats</label>
                      <input type="number" value={routeData.totalSeats} onChange={e => setRouteData({...routeData, totalSeats: e.target.value})} className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"/>
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end mt-4">
                    <button onClick={() => setIsEditingRoute(false)} className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Cancel</button>
                    <button onClick={handleSaveRoute} className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-dark transition-colors">Save Route</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {(profile?.routes && profile.routes.length > 0) ? profile.routes.map((r, index) => (
                    <div key={index} className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
                      <div className="text-center sm:text-left">
                        <p className="text-sm text-gray-500 mb-1">Route</p>
                        <p className="font-bold text-gray-900">{r.route || 'Not set'}</p>
                      </div>
                      <div className="text-center sm:text-left">
                        <p className="text-sm text-gray-500 mb-1">Start Time</p>
                        <p className="font-bold text-gray-900">{r.startTime || 'Not set'}</p>
                      </div>
                    </div>
                  )) : (
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-100 text-center text-gray-500 italic">No routes set</div>
                  )}
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="inline-block p-4 bg-brand-light rounded-lg border border-brand/20">
                      <p className="text-sm text-brand-dark mb-1 font-semibold">Total Seats</p>
                      <p className="font-bold text-gray-900 text-xl">{profile?.totalSeats || 'Not set'}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {profile?.totalSeats && !loadingPassengers && (
              <div className="mt-8 border-t border-gray-100 pt-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <Calendar className="w-6 h-6 text-brand" /> Today's Ride Summary
                  </h3>
                  <span className="text-sm font-semibold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">{getTodayStr()}</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {['Morning', 'Evening'].map(period => {
                    const assigned = passengers.length;
                    const absent = passengers.filter(p => p.absences?.some(a => a.date === getTodayStr() && (a.period === period || a.period === 'Both'))).length;
                    const extra = passengers.reduce((sum, p) => sum + (p.extraBookings?.filter(eb => eb.date === getTodayStr() && (eb.period === period || eb.period === 'Both')).reduce((s, eb) => s + eb.seats, 0) || 0), 0);
                    const present = assigned - absent;
                    const free = profile.totalSeats - present - extra;
                    const totalOccupied = present + extra;
                    const overbooked = totalOccupied > profile.totalSeats;

                    return (
                      <div key={period} className={`p-6 rounded-xl border ${overbooked ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                        <div className="flex justify-between items-center mb-4">
                          <h4 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            {period === 'Morning' ? '🌅' : '🌆'} {period} Route
                          </h4>
                          {overbooked ? (
                            <span className="flex items-center gap-1 text-red-600 text-xs font-bold uppercase px-2 py-1 bg-red-100 rounded">
                              <AlertCircle className="w-4 h-4" /> Overbooked ({Math.abs(free)})
                            </span>
                          ) : (
                            <span className="text-green-600 text-xs font-bold uppercase px-2 py-1 bg-green-100 rounded">
                              {free} Seats Free
                            </span>
                          )}
                        </div>
                        
                        <div className="space-y-3">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Active Passengers</span>
                            <span className="font-semibold">{present} <span className="text-gray-400 font-normal">({assigned} tot, {absent} abs)</span></span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Extra Friend Bookings</span>
                            <span className="font-semibold text-brand">{extra}</span>
                          </div>
                          <div className="border-t pt-2 flex justify-between font-bold">
                            <span className="text-gray-800">Total Occupancy</span>
                            <span className={overbooked ? 'text-red-600' : 'text-gray-900'}>{totalOccupied} / {profile.totalSeats}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

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
                  {passengers.map((passenger) => {
                    const todayAbsence = passenger.absences?.find(a => a.date === getTodayStr());
                    const isAbsentToday = !!todayAbsence;

                    return (
                    <div key={passenger._id} className={`bg-white p-5 rounded-xl shadow-sm hover:shadow-md transition-shadow border border-gray-100 border-l-4 ${isAbsentToday ? 'border-l-red-500 bg-red-50/20' : 'border-l-brand'}`}>
                      <div className="flex items-start justify-between mb-3">
                        <h4 className={`font-semibold text-lg ${isAbsentToday ? 'text-red-700' : 'text-gray-900'}`}>{passenger.name}</h4>
                        {isAbsentToday && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded uppercase tracking-wider">
                            Absent Today {todayAbsence.period !== 'Both' && `(${todayAbsence.period})`}
                          </span>
                        )}
                      </div>
                      <div className="space-y-2">
                        <p className="flex items-center gap-3 text-gray-600 text-sm"><Phone className="w-4 h-4 text-gray-400" /> {passenger.phoneNumber}</p>
                        <div className="flex items-center gap-2 text-gray-600">
                      <Mail className="w-4 h-4 text-brand" />
                      <span className="text-sm">{passenger.email}</span>
                    </div>
                    {(passenger.pickupLocation || passenger.dropoffLocation) && (
                      <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                        {passenger.pickupLocation && (
                          <div className="flex items-start gap-2 text-gray-600">
                            <MapPin className="w-4 h-4 text-green-500 mt-0.5" />
                            <div className="text-sm">
                              <span className="font-medium text-gray-700 block">Pickup</span>
                              {passenger.pickupLocation}
                            </div>
                          </div>
                        )}
                        {passenger.dropoffLocation && (
                          <div className="flex items-start gap-2 text-gray-600">
                            <MapPin className="w-4 h-4 text-red-500 mt-0.5" />
                            <div className="text-sm">
                              <span className="font-medium text-gray-700 block">Drop-off</span>
                              {passenger.dropoffLocation}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {passenger.absences && passenger.absences.filter(a => a.date > getTodayStr()).length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Upcoming Absences</p>
                        <div className="flex flex-wrap gap-2">
                          {passenger.absences.filter(a => a.date > getTodayStr()).sort((a,b) => a.date.localeCompare(b.date)).map(a => (
                            <span key={a.date} className="px-2 py-1 bg-orange-50 text-orange-700 border border-orange-100 rounded text-xs font-medium">
                              {new Date(a.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} {a.period !== 'Both' && `(${a.period})`}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
              })}
              </div>
              )}
            </div>
            
          </div>
        </div>
      </main>
    </div>
  );
}
