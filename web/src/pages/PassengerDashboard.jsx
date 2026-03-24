import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { LogOut, MapPin, Hash, User, Phone, Mail, CalendarOff, Users, CheckCircle, XCircle, Navigation, Map } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { io } from 'socket.io-client';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

export default function PassengerDashboard() {
  const [profile, setProfile] = useState(null);
  const [driverProfile, setDriverProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditingLocations, setIsEditingLocations] = useState(false);
  const [locationData, setLocationData] = useState({ pickupLocation: '', dropoffLocation: '' });
  const [absences, setAbsences] = useState([]);
  const [selectedDateType, setSelectedDateType] = useState('Today');
  const [specificDate, setSpecificDate] = useState('');
  const [newAbsencePeriod, setNewAbsencePeriod] = useState('Both');
  
  const [extraBookings, setExtraBookings] = useState([]);
  const [bookingDateType, setBookingDateType] = useState('Today');
  const [bookingSpecificDate, setBookingSpecificDate] = useState('');
  const [bookingPeriod, setBookingPeriod] = useState('Morning');
  const [bookSeats, setBookSeats] = useState(1);
  const [availableSeatsCheck, setAvailableSeatsCheck] = useState(null);

  const [driverLocation, setDriverLocation] = useState(null);
  const [isDriverActive, setIsDriverActive] = useState(false);

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
        setAbsences(data.absences || []);
        setExtraBookings(data.extraBookings || []);

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

  useEffect(() => {
    let newSocket;
    if (driverProfile && driverProfile.isTripActive) {
      setIsDriverActive(true);
      if (driverProfile.currentLocation) {
        setDriverLocation(driverProfile.currentLocation);
      }

      newSocket = io(import.meta.env.VITE_API_URL.replace('/api', ''), { transports: ['websocket'] });
      
      newSocket.on(`live_location_${driverProfile.uid}`, (loc) => {
        setIsDriverActive(true);
        setDriverLocation(loc);
      });
    } else {
      setIsDriverActive(false);
      setDriverLocation(null);
    }

    return () => {
      if (newSocket) newSocket.disconnect();
    };
  }, [driverProfile]);

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

  const getDateStr = (offsetDays = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const tzOffset = d.getTimezoneOffset() * 60000;
    return (new Date(d - tzOffset)).toISOString().split('T')[0];
  };

  const addAbsence = async (dateStr, periodStr) => {
    const existingIndex = absences.findIndex(a => a.date === dateStr);
    let newAbsences = [...absences];
    if (existingIndex >= 0) {
      newAbsences[existingIndex] = { date: dateStr, period: periodStr };
    } else {
      newAbsences.push({ date: dateStr, period: periodStr });
    }
    
    newAbsences.sort((a,b) => a.date.localeCompare(b.date));
    
    try {
      const token = localStorage.getItem('userToken');
      const { data } = await axios.put(`${import.meta.env.VITE_API_URL}/auth/update-absences`, {
        absences: newAbsences
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProfile(data);
      setAbsences(data.absences || []);
    } catch (error) {
      console.error('Error updating absences:', error);
      alert('Failed to update absences');
    }
  };

  const removeAbsence = async (dateStr) => {
    const newAbsences = absences.filter(a => a.date !== dateStr);
    try {
      const token = localStorage.getItem('userToken');
      const { data } = await axios.put(`${import.meta.env.VITE_API_URL}/auth/update-absences`, {
        absences: newAbsences
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProfile(data);
      setAbsences(data.absences || []);
    } catch (error) {
      console.error('Error removing absence:', error);
      alert('Failed to remove absence');
    }
  };

  const handleSubmitAbsence = () => {
    let dateStr = '';
    if (selectedDateType === 'Today') dateStr = getDateStr(0);
    else if (selectedDateType === 'Tomorrow') dateStr = getDateStr(1);
    else {
      if (!specificDate) {
        alert('Please select a specific date.');
        return;
      }
      dateStr = specificDate;
    }
    addAbsence(dateStr, newAbsencePeriod);
    setSpecificDate('');
  };

  const checkAvailability = async () => {
    let dateStr = '';
    if (bookingDateType === 'Today') dateStr = getDateStr(0);
    else if (bookingDateType === 'Tomorrow') dateStr = getDateStr(1);
    else {
      if (!bookingSpecificDate) { alert('Please select a specific date.'); return; }
      dateStr = bookingSpecificDate;
    }
    
    try {
      const token = localStorage.getItem('userToken');
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/auth/ride-availability?date=${dateStr}&period=${bookingPeriod}`, { headers: { Authorization: `Bearer ${token}` } });
      setAvailableSeatsCheck({ ...data, dateStr, period: bookingPeriod });
    } catch (err) {
      console.error(err); alert('Could not check availability. Has the driver set total seats?');
    }
  };

  const confirmExtraBooking = async () => {
    if (!availableSeatsCheck) return;
    if (bookSeats < 1 || bookSeats > availableSeatsCheck.availableSeats) { alert('Invalid seat count'); return; }
    try {
      const newBookings = [...extraBookings, { date: availableSeatsCheck.dateStr, period: availableSeatsCheck.period, seats: parseInt(bookSeats, 10) }];
      const token = localStorage.getItem('userToken');
      const { data } = await axios.put(`${import.meta.env.VITE_API_URL}/auth/update-extra-bookings`, { extraBookings: newBookings }, { headers: { Authorization: `Bearer ${token}` } });
      setExtraBookings(data.extraBookings || []); setAvailableSeatsCheck(null); setBookSeats(1); alert('Successfully booked extra seats!');
    } catch (err) { console.error(err); alert('Could not complete booking'); }
  };

  const cancelExtraBooking = async (index) => {
    try {
      const newBookings = [...extraBookings]; newBookings.splice(index, 1);
      const token = localStorage.getItem('userToken');
      const { data } = await axios.put(`${import.meta.env.VITE_API_URL}/auth/update-extra-bookings`, { extraBookings: newBookings }, { headers: { Authorization: `Bearer ${token}` } });
      setExtraBookings(data.extraBookings || []);
    } catch (err) { console.error(err); }
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
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Navigation className="w-5 h-5 text-brand" /> Live Trip Tracking
                </h3>
                {isDriverActive && (
                  <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold uppercase rounded-full flex items-center gap-1 animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span> Live
                  </span>
                )}
              </div>
              
              {isDriverActive ? (
                <div className="w-full h-80 rounded-xl overflow-hidden border border-gray-200 shadow-inner bg-gray-50 flex items-center justify-center relative">
                  {driverLocation ? (
                    <MapContainer center={[driverLocation.lat, driverLocation.lng]} zoom={15} style={{ height: '100%', width: '100%', zIndex: 0 }}>
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      <Marker position={[driverLocation.lat, driverLocation.lng]}>
                        <Popup>Driver's Live Location</Popup>
                      </Marker>
                    </MapContainer>
                  ) : (
                    <div className="text-gray-500 animate-pulse font-medium">Connecting to driver's GPS...</div>
                  )}
                </div>
              ) : (
                <div className="w-full h-24 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 text-gray-500 italic text-center px-4">
                  {driverProfile ? "Driver has not started the trip yet." : "No driver assigned."}
                </div>
              )}
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
            
            <div className="mt-8 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="flex justify-between items-center mb-4 border-b pb-2">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <CalendarOff className="w-5 h-5 text-brand" /> Manage Absences
                </h3>
              </div>
              <p className="text-sm text-gray-500 mb-4">Let your driver know if you won't be travelling on specific days.</p>
              
              <div className="flex flex-col gap-6 mb-8 bg-gray-50 p-6 rounded-xl border border-gray-100">
                
                {/* Date Selection */}
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-3">1. Select Date</label>
                  <div className="flex flex-wrap gap-3">
                    <button 
                      onClick={() => setSelectedDateType('Today')}
                      className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition-colors border ${selectedDateType === 'Today' ? 'bg-brand text-white border-brand shadow-sm cursor-default' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300'}`}
                    >
                      Today
                    </button>
                    <button 
                      onClick={() => setSelectedDateType('Tomorrow')}
                      className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition-colors border ${selectedDateType === 'Tomorrow' ? 'bg-brand text-white border-brand shadow-sm cursor-default' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300'}`}
                    >
                      Tomorrow
                    </button>
                    <button 
                      onClick={() => setSelectedDateType('Specific')}
                      className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition-colors border ${selectedDateType === 'Specific' ? 'bg-brand text-white border-brand shadow-sm cursor-default' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300'}`}
                    >
                      Specific Date
                    </button>
                  </div>
                  {selectedDateType === 'Specific' && (
                    <div className="mt-3 animate-fade-in">
                      <input 
                        type="date" 
                        value={specificDate}
                        onChange={(e) => setSpecificDate(e.target.value)}
                        className="w-full md:w-1/2 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand bg-white"
                        min={getDateStr(0)}
                      />
                    </div>
                  )}
                </div>

                <div className="h-px bg-gray-200 w-full opacity-50"></div>

                {/* Period Selection */}
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-3">2. Select Period</label>
                  <div className="flex flex-wrap gap-3">
                    <button 
                      onClick={() => setNewAbsencePeriod('Morning')}
                      className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition-colors border ${newAbsencePeriod === 'Morning' ? 'bg-orange-100 text-orange-700 border-orange-200 shadow-sm cursor-default' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300'}`}
                    >
                      Morning Route
                    </button>
                    <button 
                      onClick={() => setNewAbsencePeriod('Evening')}
                      className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition-colors border ${newAbsencePeriod === 'Evening' ? 'bg-orange-100 text-orange-700 border-orange-200 shadow-sm cursor-default' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300'}`}
                    >
                      Evening Route
                    </button>
                    <button 
                      onClick={() => setNewAbsencePeriod('Both')}
                      className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition-colors border ${newAbsencePeriod === 'Both' ? 'bg-orange-100 text-orange-700 border-orange-200 shadow-sm cursor-default' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300'}`}
                    >
                      Full Day (Both)
                    </button>
                  </div>
                </div>

                <button 
                  onClick={handleSubmitAbsence}
                  className="w-full mt-2 bg-brand text-white py-3.5 rounded-lg font-bold text-base hover:bg-brand-dark transition-colors shadow-md flex items-center justify-center gap-2"
                >
                  <CalendarOff className="w-5 h-5" />
                  Submit Absence
                </button>
              </div>

              {absences.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Recorded Absences</h4>
                  <div className="space-y-2">
                    {absences.map(absence => (
                      <div key={absence.date} className="flex justify-between items-center bg-white border border-gray-100 p-2 px-3 rounded text-sm transition-colors hover:border-red-200">
                        <div>
                          <span className="font-medium text-gray-800 block">{new Date(absence.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                          <span className="text-xs font-semibold text-orange-600 uppercase tracking-wider">{absence.period} Route{absence.period === 'Both' ? 's' : ''}</span>
                        </div>
                        <button onClick={() => removeAbsence(absence.date)} className="text-red-500 hover:text-red-700 font-semibold p-2 rounded-lg hover:bg-red-50 transition-colors">
                          <LogOut className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-8 bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
              <div className="flex justify-between items-center mb-4 border-b pb-2">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-brand" /> Book Extra Seats
                </h3>
              </div>
              <p className="text-sm text-gray-500 mb-4">Check if your vehicle has freed seats and temporarily reserve them for your friends!</p>
              
              <div className="flex flex-col gap-5 mb-8 bg-gray-50 p-6 rounded-xl border border-gray-100">
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-3">1. Select Booking Date</label>
                  <div className="flex flex-wrap gap-3">
                    <button onClick={() => {setBookingDateType('Today'); setAvailableSeatsCheck(null);}} className={`flex-1 py-2 rounded-lg font-medium text-sm transition-colors border ${bookingDateType === 'Today' ? 'bg-brand text-white border-brand shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300'}`}>Today</button>
                    <button onClick={() => {setBookingDateType('Tomorrow'); setAvailableSeatsCheck(null);}} className={`flex-1 py-2 rounded-lg font-medium text-sm transition-colors border ${bookingDateType === 'Tomorrow' ? 'bg-brand text-white border-brand shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300'}`}>Tomorrow</button>
                    <button onClick={() => {setBookingDateType('Specific'); setAvailableSeatsCheck(null);}} className={`flex-1 py-2 rounded-lg font-medium text-sm transition-colors border ${bookingDateType === 'Specific' ? 'bg-brand text-white border-brand shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300'}`}>Specific Date</button>
                  </div>
                  {bookingDateType === 'Specific' && (
                    <div className="mt-3 animate-fade-in">
                      <input type="date" value={bookingSpecificDate} onChange={(e) => {setBookingSpecificDate(e.target.value); setAvailableSeatsCheck(null);}} className="w-full md:w-1/2 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand bg-white" min={getDateStr(0)} />
                    </div>
                  )}
                </div>

                <div className="h-px bg-gray-200 w-full opacity-50"></div>

                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-3">2. Select Period</label>
                  <div className="flex flex-wrap gap-3">
                    <button onClick={() => {setBookingPeriod('Morning'); setAvailableSeatsCheck(null);}} className={`flex-1 py-2 rounded-lg font-medium text-sm transition-colors border ${bookingPeriod === 'Morning' ? 'bg-green-100 text-green-700 border-green-200 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300'}`}>Morning Route</button>
                    <button onClick={() => {setBookingPeriod('Evening'); setAvailableSeatsCheck(null);}} className={`flex-1 py-2 rounded-lg font-medium text-sm transition-colors border ${bookingPeriod === 'Evening' ? 'bg-green-100 text-green-700 border-green-200 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300'}`}>Evening Route</button>
                  </div>
                </div>

                {!availableSeatsCheck ? (
                  <button onClick={checkAvailability} className="w-full mt-2 bg-gray-800 text-white py-3 rounded-lg font-bold text-base hover:bg-gray-900 transition-colors shadow-md flex items-center justify-center gap-2">
                    Check Driver Availability
                  </button>
                ) : (
                  <div className="mt-2 animate-fade-in">
                    {availableSeatsCheck.availableSeats > 0 ? (
                      <div className="p-4 bg-green-50 border border-green-200 rounded-xl relative">
                        <div className="flex items-center gap-2 mb-3">
                          <CheckCircle className="w-5 h-5 text-green-600" />
                          <span className="font-bold text-green-800 text-lg">{availableSeatsCheck.availableSeats} Seats Available!</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <input type="number" min="1" max={availableSeatsCheck.availableSeats} value={bookSeats} onChange={e => setBookSeats(e.target.value)} className="w-20 px-3 py-2 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 font-bold text-center" />
                          <button onClick={confirmExtraBooking} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-bold shadow-md transition-colors">
                            Book {bookSeats} Seat{bookSeats > 1 ? 's' : ''} Now!
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
                        <XCircle className="w-6 h-6 text-red-500" />
                        <span className="font-bold text-red-800">No seats available for this ride.</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {extraBookings.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">My Temporary Bookings</h4>
                  <div className="space-y-2">
                    {extraBookings.slice().sort((a,b)=>a.date.localeCompare(b.date)).map((booking, index) => (
                      <div key={index} className="flex justify-between items-center bg-green-50/50 border border-green-100 p-2 px-3 rounded text-sm transition-colors hover:border-red-200">
                        <div>
                          <span className="font-medium text-gray-800 block">{typeof booking.date === 'string' ? new Date(booking.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : ''} - <span className="text-green-700 font-bold">{booking.seats} Seat(s)</span></span>
                          <span className="text-xs font-semibold text-green-600 uppercase tracking-wider">{booking.period} Route</span>
                        </div>
                        <button onClick={() => cancelExtraBooking(index)} className="text-red-500 hover:text-red-700 font-semibold p-2 rounded-lg hover:bg-red-50 transition-colors">
                          <span className="text-xs uppercase font-bold px-1">Cancel</span> <XCircle className="w-4 h-4 inline" />
                        </button>
                      </div>
                    ))}
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
