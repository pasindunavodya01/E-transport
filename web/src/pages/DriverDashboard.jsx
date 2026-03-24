import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { LogOut, Car, Hash, User, Phone, Mail, MapPin, Calendar, AlertCircle, Navigation, CreditCard } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { io } from 'socket.io-client';
import L from 'leaflet';
import { geocodeAddress, fetchRoutePolyline } from '../services/mapServices';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

export default function DriverDashboard() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [passengers, setPassengers] = useState([]);
  const [loadingPassengers, setLoadingPassengers] = useState(true);
  const [isEditingRoute, setIsEditingRoute] = useState(false);
  const [routeData, setRouteData] = useState({ routes: [], totalSeats: '' });
  const [isTripActive, setIsTripActive] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const currentLocationRef = React.useRef(null);
  const [routePolylines, setRoutePolylines] = useState([]); // array of {points:[{lat,lng}]}
  const [allPayments, setAllPayments] = useState([]); // [{passengerId, name, email, payments:[...]}]
  const [reviewNotes, setReviewNotes] = useState({}); // { paymentId: noteText }
  const [isEditingBank, setIsEditingBank] = useState(false);
  const [bankDetails, setBankDetails] = useState({ bankName: '', accountName: '', accountNumber: '', branchName: '' });
  
  const navigate = useNavigate();

  useEffect(() => {
    currentLocationRef.current = currentLocation;
  }, [currentLocation]);

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
        setBankDetails({
          bankName: data.bankDetails?.bankName || '',
          accountName: data.bankDetails?.accountName || '',
          accountNumber: data.bankDetails?.accountNumber || '',
          branchName: data.bankDetails?.branchName || ''
        });
        setIsTripActive(data.isTripActive || false);
        if (data.currentLocation) {
          setCurrentLocation(data.currentLocation);
        }
        // Rehydrate saved polylines from routes
        if (data.routes) {
          const polys = data.routes
            .filter(r => r.polyline)
            .map(r => ({ points: JSON.parse(r.polyline) }));
          setRoutePolylines(polys);
        }
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

        // Fetch payment records for all passengers
        try {
          const token2 = localStorage.getItem('userToken');
          const paymentsRes = await axios.get(
            `${import.meta.env.VITE_API_URL.replace('/api', '')}/api/payments/all-payments`,
            { headers: { Authorization: `Bearer ${token2}` } }
          );
          setAllPayments(paymentsRes.data || []);
        } catch {}
      } catch (error) {
        console.error('Error fetching passengers', error);
      } finally {
        setLoadingPassengers(false);
      }
    };
    fetchPassengers();
  }, []);

  useEffect(() => {
    let watchId;
    let newSocket;
    let interval;

    if (isTripActive && profile) {
      newSocket = io(import.meta.env.VITE_API_URL.replace('/api', ''), { transports: ['websocket'] });
      
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const loc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            timestamp: new Date()
          };
          setCurrentLocation(loc);
          newSocket.emit('driver_location_update', {
            driverId: profile.uid,
            ...loc
          });
        },
        (error) => console.error('Geolocation error:', error),
        { enableHighAccuracy: true, maximumAge: 0 }
      );
      
      interval = setInterval(() => {
        const loc = currentLocationRef.current;
        if (loc) {
            const token = localStorage.getItem('userToken');
            axios.put(`${import.meta.env.VITE_API_URL}/auth/update-location`, loc, {
              headers: { Authorization: `Bearer ${token}` }
            }).catch(console.error);
        }
      }, 30000);
    }

    return () => {
      if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
      if (interval) clearInterval(interval);
      if (newSocket) newSocket.disconnect();
    };
  }, [isTripActive, profile]);

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

      // Geocode each route's start and end to get a polyline
      const enrichedRoutes = await Promise.all(routeData.routes.map(async (r) => {
        if (!r.route || !r.route.includes(' ')) return r;
        // Split on common separators: ' - ', ' to ', ','
        const parts = r.route.split(/ - | to |,/i);
        if (parts.length < 2) return r;
        const [start, end] = parts;
        const [startGeo, endGeo] = await Promise.all([geocodeAddress(start.trim()), geocodeAddress(end.trim())]);
        if (startGeo && endGeo) {
          const polylinePoints = await fetchRoutePolyline(startGeo, endGeo);
          return { ...r, polyline: polylinePoints ? JSON.stringify(polylinePoints) : undefined };
        }
        return r;
      }));

      const { data } = await axios.put(`${import.meta.env.VITE_API_URL}/auth/update-route`, {
        routes: enrichedRoutes,
        totalSeats: parseInt(routeData.totalSeats) || 0
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProfile(data);
      const polys = (data.routes || [])
        .filter(r => r.polyline)
        .map(r => ({ points: JSON.parse(r.polyline) }));
      setRoutePolylines(polys);
      setIsEditingRoute(false);
    } catch (error) {
      console.error('Error updating route', error);
      alert('Failed to update route information');
    }
  };

  const toggleTrip = async () => {
    try {
      const token = localStorage.getItem('userToken');
      const endpoint = isTripActive ? 'end-trip' : 'start-trip';
      const { data } = await axios.put(`${import.meta.env.VITE_API_URL}/auth/${endpoint}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsTripActive(data.isTripActive);
      if (!data.isTripActive) {
        setCurrentLocation(null);
      }
    } catch (error) {
      console.error('Toggle trip error', error);
      alert('Could not toggle trip state.');
    }
  };

  const reviewPayment = async (passengerId, paymentId, status) => {
    try {
      const token = localStorage.getItem('userToken');
      await axios.put(
        `${import.meta.env.VITE_API_URL.replace('/api', '')}/api/payments/review/${passengerId}/${paymentId}`,
        { status, note: reviewNotes[paymentId] || '' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // Refresh the payments list
      const paymentsRes = await axios.get(
        `${import.meta.env.VITE_API_URL.replace('/api', '')}/api/payments/all-payments`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAllPayments(paymentsRes.data || []);
    } catch (err) {
      console.error(err);
      alert('Failed to update payment status.');
    }
  };

  const handleSaveBankDetails = async () => {
    try {
      const token = localStorage.getItem('userToken');
      const { data } = await axios.put(`${import.meta.env.VITE_API_URL}/auth/update-bank-details`, {
        bankDetails
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProfile(data);
      setIsEditingBank(false);
    } catch (error) {
      console.error('Error updating bank details', error);
      alert('Failed to update bank details');
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
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Navigation className="w-5 h-5 text-brand" /> Live Trip Tracking
                </h3>
                <button 
                  onClick={toggleTrip} 
                  className={`px-4 py-2 text-sm font-bold rounded-lg shadow-sm transition-colors ${isTripActive ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-green-600 text-white hover:bg-green-700'}`}
                >
                  {isTripActive ? 'End Trip Tracking' : 'Start Live Tracking'}
                </button>
              </div>

              {isTripActive ? (
                <div className="w-full h-80 rounded-xl overflow-hidden border border-gray-200 shadow-inner bg-gray-50 flex items-center justify-center relative">
                  {currentLocation ? (
                    <MapContainer center={[currentLocation.lat, currentLocation.lng]} zoom={14} style={{ height: '100%', width: '100%', zIndex: 0 }}>
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      {/* Driver live position */}
                      <Marker position={[currentLocation.lat, currentLocation.lng]}>
                        <Popup>🚐 Broadcasting Location LIVE</Popup>
                      </Marker>
                      {/* Route polylines */}
                      {routePolylines.map((poly, i) => (
                        <Polyline
                          key={i}
                          positions={poly.points.map(p => [p.lat, p.lng])}
                          color="#3B82F6"
                          weight={4}
                          opacity={0.7}
                        />
                      ))}
                      {/* Passenger pickup & dropoff markers */}
                      {passengers.map(p => (
                        <React.Fragment key={p._id}>
                          {p.pickupLocation?.lat && (
                            <Marker position={[p.pickupLocation.lat, p.pickupLocation.lng]}>
                              <Popup>📍 {p.name}: Pickup</Popup>
                            </Marker>
                          )}
                          {p.dropoffLocation?.lat && (
                            <Marker position={[p.dropoffLocation.lat, p.dropoffLocation.lng]}>
                              <Popup>🏁 {p.name}: Drop-off</Popup>
                            </Marker>
                          )}
                        </React.Fragment>
                      ))}
                    </MapContainer>
                  ) : (
                    <div className="text-gray-500 animate-pulse font-medium">Acquiring GPS Signal...</div>
                  )}
                </div>
              ) : (
                <div className="w-full h-24 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 text-gray-500 italic">
                  Trip is currently inactive. Start the trip to broadcast your location to passengers.
                </div>
              )}
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

            {/* Bank Details Section */}
            <div className="mt-8 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="flex justify-between items-center mb-4 border-b pb-2">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-brand" /> Bank Details
                </h3>
                {!isEditingBank && (
                  <button onClick={() => setIsEditingBank(true)} className="text-brand text-sm font-semibold hover:underline">
                    Edit Bank Details
                  </button>
                )}
              </div>
              
              {isEditingBank ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Bank Name</label>
                      <input type="text" value={bankDetails.bankName} onChange={e => setBankDetails({...bankDetails, bankName: e.target.value})} placeholder="e.g. Commercial Bank" className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"/>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Account Name</label>
                      <input type="text" value={bankDetails.accountName} onChange={e => setBankDetails({...bankDetails, accountName: e.target.value})} placeholder="e.g. John Doe" className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"/>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Account Number</label>
                      <input type="text" value={bankDetails.accountNumber} onChange={e => setBankDetails({...bankDetails, accountNumber: e.target.value})} placeholder="e.g. 1234567890" className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"/>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Branch Name</label>
                      <input type="text" value={bankDetails.branchName} onChange={e => setBankDetails({...bankDetails, branchName: e.target.value})} placeholder="e.g. Colombo 03" className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"/>
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end mt-4">
                    <button onClick={() => {
                        setIsEditingBank(false);
                        setBankDetails({
                          bankName: profile.bankDetails?.bankName || '',
                          accountName: profile.bankDetails?.accountName || '',
                          accountNumber: profile.bankDetails?.accountNumber || '',
                          branchName: profile.bankDetails?.branchName || ''
                        });
                      }} 
                      className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >Cancel</button>
                    <button onClick={handleSaveBankDetails} className="px-4 py-2 bg-brand text-white rounded-lg hover:bg-brand-dark transition-colors">Save Details</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {profile?.bankDetails?.accountNumber ? (
                    <div className="bg-gray-50 p-4 rounded-lg flex items-start gap-3 border border-gray-100">
                      <div className="bg-white p-2 rounded-lg shadow-sm">
                        <CreditCard className="w-6 h-6 text-brand" />
                      </div>
                      <div>
                        <div className="font-bold text-gray-900">{profile.bankDetails.bankName || 'Unknown Bank'}</div>
                        <div className="text-gray-800 font-mono mt-1 tracking-wider">{profile.bankDetails.accountNumber}</div>
                        <div className="text-gray-500 mt-2 text-sm">Account Name: <span className="text-gray-700 font-medium">{profile.bankDetails.accountName || '-'}</span></div>
                        <div className="text-gray-500 mt-1 text-sm">Branch: <span className="text-gray-700 font-medium">{profile.bankDetails.branchName || '-'}</span></div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-100 text-center text-gray-500 italic">No bank details provided. Add them so passengers can transfer payments.</div>
                  )}
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
                              {passenger.pickupLocation?.address || passenger.pickupLocation}
                            </div>
                          </div>
                        )}
                        {passenger.dropoffLocation && (
                          <div className="flex items-start gap-2 text-gray-600">
                            <MapPin className="w-4 h-4 text-red-500 mt-0.5" />
                            <div className="text-sm">
                              <span className="font-medium text-gray-700 block">Drop-off</span>
                              {passenger.dropoffLocation?.address || passenger.dropoffLocation}
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

        {/* ── Payment Approvals ── */}
        <div className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 md:p-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">💳 Payment Approvals</h3>
            <p className="text-sm text-gray-500 mb-5">Review and approve monthly payments submitted by your passengers.</p>

            {allPayments.length === 0 && (
              <p className="text-sm text-gray-400 italic text-center py-4">No payment submissions yet.</p>
            )}

            {allPayments.map(passenger => (
              passenger.payments && passenger.payments.length > 0 && (
                <div key={passenger.passengerId} className="mb-6">
                  <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                    <span className="w-7 h-7 bg-brand-light text-brand rounded-full flex items-center justify-center font-bold text-xs">
                      {passenger.name?.charAt(0)}
                    </span>
                    {passenger.name} <span className="text-gray-400 font-normal text-xs">({passenger.email})</span>
                  </h4>
                  <div className="space-y-3">
                    {passenger.payments.map((p) => (
                      <div key={p._id} className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                        {p.imageUrl && (
                          <a href={p.imageUrl} target="_blank" rel="noreferrer">
                            <img src={p.imageUrl} alt="receipt" className="w-20 h-20 object-cover rounded-lg border border-gray-200 hover:opacity-80 transition-opacity flex-shrink-0" />
                          </a>
                        )}
                        <div className="flex-1">
                          <p className="font-semibold text-gray-800">{p.month} &nbsp;•&nbsp; LKR {p.amount?.toLocaleString()}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            Submitted: {p.submittedAt ? new Date(p.submittedAt).toLocaleDateString() : 'N/A'}
                            {p.reviewedAt && ` • Reviewed: ${new Date(p.reviewedAt).toLocaleDateString()}`}
                          </p>
                          {p.status === 'pending' && (
                            <div className="mt-2 flex flex-col gap-2">
                              <input
                                type="text"
                                placeholder="Optional note for passenger..."
                                value={reviewNotes[p._id] || ''}
                                onChange={e => setReviewNotes(n => ({ ...n, [p._id]: e.target.value }))}
                                className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs w-full focus:outline-none focus:ring-1 focus:ring-brand"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => reviewPayment(passenger.passengerId, p._id, 'approved')}
                                  className="flex-1 py-1.5 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 transition-colors"
                                >✅ Approve</button>
                                <button
                                  onClick={() => reviewPayment(passenger.passengerId, p._id, 'rejected')}
                                  className="flex-1 py-1.5 bg-red-100 text-red-700 text-xs font-bold rounded-lg hover:bg-red-200 transition-colors"
                                >❌ Reject</button>
                              </div>
                            </div>
                          )}
                          {p.note && <p className="text-xs text-gray-500 italic mt-1">Note: {p.note}</p>}
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide flex-shrink-0 ${
                          p.status === 'approved' ? 'bg-green-100 text-green-700' :
                          p.status === 'rejected' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {p.status === 'approved' ? '✅ Approved' : p.status === 'rejected' ? '❌ Rejected' : '⏳ Pending'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            ))}
          </div>
        </div>

      </main>
    </div>
  );
}
