import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  LogOut, MapPin, Hash, User, Phone, Mail, CalendarOff, Users,
  CheckCircle, XCircle, Navigation, CreditCard, LocateFixed,
  MousePointer2, Menu, X, BarChart2, Settings, Clock, ChevronRight, Upload
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { io } from 'socket.io-client';
import L from 'leaflet';
import { geocodeAddress, fetchRouteAlternatives, reverseGeocode } from '../services/mapServices';
import GoogleAd from '../components/GoogleAd';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

const vehicleIcon = L.divIcon({
  html:`<div style="background-color:#f59e0b;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 6px rgba(0,0,0,0.3);border:2px solid white;"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg></div>`,
  className:'',iconSize:[34,34],iconAnchor:[17,17],popupAnchor:[0,-17]
});
const pickupIcon = L.divIcon({
  html:`<div style="color:#10b981;filter:drop-shadow(0 3px 3px rgba(0,0,0,0.5));transform:translateY(-4px);"><svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 24 24" fill="currentColor" stroke="white" stroke-width="1.5"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3" fill="white"/></svg></div>`,
  className:'',iconSize:[38,38],iconAnchor:[19,38],popupAnchor:[0,-38]
});
const dropoffIcon = L.divIcon({
  html:`<div style="color:#ef4444;filter:drop-shadow(0 3px 3px rgba(0,0,0,0.5));transform:translateY(-4px);"><svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 24 24" fill="currentColor" stroke="white" stroke-width="1.5"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3" fill="white"/></svg></div>`,
  className:'',iconSize:[38,38],iconAnchor:[19,38],popupAnchor:[0,-38]
});
const userIcon = L.divIcon({
  html:`<div style="background-color:#3b82f6;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 0 10px rgba(59,130,246,0.6);border:3px solid white;"><div style="width:8px;height:8px;background-color:white;border-radius:50%;"></div></div>`,
  className:'',iconSize:[24,24],iconAnchor:[12,12]
});

const TABS = [
  { id:'overview',  label:'Overview',      icon:BarChart2 },
  { id:'tracking',  label:'Live Map',      icon:Navigation },
  { id:'absences',  label:'Absences',      icon:CalendarOff },
  { id:'bookings',  label:'Extra Seats',   icon:Users },
  { id:'payments',  label:'Payments',      icon:CreditCard },
  { id:'settings',  label:'My Locations',  icon:Settings },
];

export default function PassengerDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [profile, setProfile] = useState(null);
  const [driverProfile, setDriverProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditingLocations, setIsEditingLocations] = useState(false);
  const [locationData, setLocationData] = useState({ 
    morningPickup: '', morningDropoff: '', 
    eveningPickup: '', eveningDropoff: '' 
  });
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
  const [sameForAll, setSameForAll] = useState(true);
  const [extraLocations, setExtraLocations] = useState([{ pickup:'', dropoff:'' }]);
  const [extraDistance, setExtraDistance] = useState(null);
  const [extraPrice, setExtraPrice] = useState(null);
  const [calculatingPrice, setCalculatingPrice] = useState(false);
  const [mapPickingMode, setMapPickingMode] = useState(null);

  const [payments, setPayments] = useState([]);
  const [paymentMonth, setPaymentMonth] = useState(() => new Date().toISOString().slice(0,7));
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentFile, setPaymentFile] = useState(null);
  const [paymentFilePreview, setPaymentFilePreview] = useState(null);
  const [paymentUploading, setPaymentUploading] = useState(false);

  const [driverLocation, setDriverLocation] = useState(null);
  const [isDriverActive, setIsDriverActive] = useState(false);
  const [userLocation, setUserLocation] = useState(null);

  const navigate = useNavigate();

  const fetchProfileData = async () => {
    const token = localStorage.getItem('userToken');
    if (!token) return navigate('/login');
    const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/auth/me`, { headers:{Authorization:`Bearer ${token}`} });
    if (data.role !== 'passenger') return navigate('/driver-dashboard');
    setProfile(data);
    setLocationData({ 
      morningPickup: data.locations?.morning?.pickup?.address || data.locations?.morning?.pickup || '', 
      morningDropoff: data.locations?.morning?.dropoff?.address || data.locations?.morning?.dropoff || '',
      eveningPickup: data.locations?.evening?.pickup?.address || data.locations?.evening?.pickup || '',
      eveningDropoff: data.locations?.evening?.dropoff?.address || data.locations?.evening?.dropoff || ''
    });
    setAbsences(data.absences || []);
    setExtraBookings(data.extraBookings || []);
  };

  useEffect(() => {
    const init = async () => {
      try {
        await fetchProfileData();
        const token = localStorage.getItem('userToken');
        try {
          const dr = await axios.get(`${import.meta.env.VITE_API_URL}/auth/my-driver`, { headers:{Authorization:`Bearer ${token}`} });
          setDriverProfile(dr.data);
        } catch {}
        try {
          const pr = await axios.get(`${import.meta.env.VITE_API_URL.replace('/api','')}/api/payments/my-payments`, { headers:{Authorization:`Bearer ${token}`} });
          setPayments(pr.data || []);
        } catch {}
      } catch(e) { navigate('/login'); }
      finally { setLoading(false); }
    };
    init();
  }, [navigate]);

  useEffect(() => {
    let watchId;
    if (activeTab === 'tracking') {
      watchId = navigator.geolocation.watchPosition(
        pos => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        err => console.error('Tracking error:', err),
        { enableHighAccuracy: true }
      );
    }
    return () => { if (watchId) navigator.geolocation.clearWatch(watchId); };
  }, [activeTab]);

  useEffect(() => {
    let sock;
    if (driverProfile?.uid) {
      if (driverProfile.isTripActive) {
        setIsDriverActive(true);
        if (driverProfile.currentLocation) setDriverLocation(driverProfile.currentLocation);
      } else {
        setIsDriverActive(false);
        setDriverLocation(null);
      }

      // Always connect to socket if we have a driver, to listen for status changes
      sock = io(import.meta.env.VITE_API_URL.replace('/api',''), { transports:['websocket'] });

      sock.on(`live_location_${driverProfile.uid}`, loc => { 
        setIsDriverActive(true); 
        setDriverLocation(loc); 
      });

      sock.on(`trip_status_update_${driverProfile.uid}`, d => { 
        setIsDriverActive(d.isTripActive);
        if (d.isTripActive) {
          // Refresh driver details to get active route index and other trip state
          const token = localStorage.getItem('userToken');
          axios.get(`${import.meta.env.VITE_API_URL}/auth/my-driver`, { headers:{Authorization:`Bearer ${token}`} })
            .then(dr => setDriverProfile(dr.data))
            .catch(console.error);
        } else {
          setDriverLocation(null);
        }
      });
    }
    return () => { if(sock) sock.disconnect(); };
  }, [driverProfile?.uid]);

  const handleLogout = () => { localStorage.removeItem('userToken'); localStorage.removeItem('userRole'); navigate('/login'); };

  const handleUseCurrentLocation = (type) => {
    if (!navigator.geolocation) { alert("Geolocation not supported"); return; }
    navigator.geolocation.getCurrentPosition(async pos => {
      const addr = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
      if (addr) setLocationData(prev => ({ ...prev, [type]: addr }));
      else alert("Could not determine address.");
    }, e => alert("Error: " + e.message));
  };

  function MapClickHandler() {
    useMapEvents({ click: async e => {
      if (mapPickingMode) {
        const addr = await reverseGeocode(e.latlng.lat, e.latlng.lng);
        if (addr) { setLocationData(prev=>({...prev,[mapPickingMode]:addr})); setMapPickingMode(null); }
      }
    }});
    return null;
  }

  const handleSaveLocations = async () => {
    try {
      const token = localStorage.getItem('userToken');
      const geocode = async (addr) => {
        if (!addr) return null;
        const g = await geocodeAddress(addr);
        return g ? { address: addr, lat: g.lat, lng: g.lng } : addr;
      };

      const [mp, md, ep, ed] = await Promise.all([
        geocode(locationData.morningPickup),
        geocode(locationData.morningDropoff),
        geocode(locationData.eveningPickup),
        geocode(locationData.eveningDropoff)
      ]);

      const payload = {
        locations: {
          morning: { pickup: mp, dropoff: md },
          evening: { pickup: ep, dropoff: ed }
        }
      };

      const { data } = await axios.put(`${import.meta.env.VITE_API_URL}/auth/update-locations`, payload, { headers:{Authorization:`Bearer ${token}`} });
      setProfile(data);
      setLocationData({ 
        morningPickup: data.locations?.morning?.pickup?.address || data.locations?.morning?.pickup || '', 
        morningDropoff: data.locations?.morning?.dropoff?.address || data.locations?.morning?.dropoff || '',
        eveningPickup: data.locations?.evening?.pickup?.address || data.locations?.evening?.pickup || '',
        eveningDropoff: data.locations?.evening?.dropoff?.address || data.locations?.evening?.dropoff || ''
      });
      setIsEditingLocations(false);
    } catch { alert('Failed to update locations'); }
  };

  const getDateStr = (offset=0) => {
    const d = new Date(); d.setDate(d.getDate()+offset);
    return (new Date(d - d.getTimezoneOffset()*60000)).toISOString().split('T')[0];
  };

  const addAbsence = async (dateStr, periodStr) => {
    let newAbs = absences.filter(a=>a.date!==dateStr);
    newAbs.push({ date:dateStr, period:periodStr });
    newAbs.sort((a,b)=>a.date.localeCompare(b.date));
    try {
      const token = localStorage.getItem('userToken');
      const { data } = await axios.put(`${import.meta.env.VITE_API_URL}/auth/update-absences`, { absences:newAbs }, { headers:{Authorization:`Bearer ${token}`} });
      setProfile(data); setAbsences(data.absences||[]);
    } catch { alert('Failed to update absences'); }
  };

  const removeAbsence = async (dateStr) => {
    const newAbs = absences.filter(a=>a.date!==dateStr);
    try {
      const token = localStorage.getItem('userToken');
      const { data } = await axios.put(`${import.meta.env.VITE_API_URL}/auth/update-absences`, { absences:newAbs }, { headers:{Authorization:`Bearer ${token}`} });
      setProfile(data); setAbsences(data.absences||[]);
    } catch { alert('Failed to remove absence'); }
  };

  const handleSubmitAbsence = () => {
    let dateStr = selectedDateType==='Today' ? getDateStr(0) : selectedDateType==='Tomorrow' ? getDateStr(1) : specificDate;
    if (!dateStr) { alert('Please select a date.'); return; }
    addAbsence(dateStr, newAbsencePeriod);
    setSpecificDate('');
  };

  const checkAvailability = async () => {
    let dateStr = bookingDateType==='Today' ? getDateStr(0) : bookingDateType==='Tomorrow' ? getDateStr(1) : bookingSpecificDate;
    if (!dateStr) { alert('Please select a date.'); return; }
    try {
      const token = localStorage.getItem('userToken');
      const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/auth/ride-availability?date=${dateStr}&period=${bookingPeriod}`, { headers:{Authorization:`Bearer ${token}`} });
      setAvailableSeatsCheck({ ...data, dateStr, period:bookingPeriod });
    } catch { alert('Could not check availability.'); }
  };

  const handleSeatCountChange = val => {
    const seats = parseInt(val)||1;
    setBookSeats(val); setExtraPrice(null);
    if (!sameForAll) {
      setExtraLocations(prev => { const nl=[...prev]; while(nl.length<seats) nl.push({pickup:'',dropoff:''}); return nl.slice(0,seats); });
    }
  };

  const handleSameForAllChange = isSame => {
    setSameForAll(isSame); setExtraPrice(null);
    if (isSame) setExtraLocations(prev=>prev.slice(0,1));
    else {
      const seats=parseInt(bookSeats)||1;
      setExtraLocations(prev=>{ const nl=[...prev]; while(nl.length<seats) nl.push({pickup:'',dropoff:''}); return nl.slice(0,seats); });
    }
  };

  const calculateExtraPrice = async () => {
    for (let i=0; i<extraLocations.length; i++) {
      if (!extraLocations[i].pickup||!extraLocations[i].dropoff) { alert(sameForAll?'Enter both pickup and drop-off.':'Enter locations for all passengers.'); return; }
    }
    setCalculatingPrice(true);
    try {
      let totalDist=0, totalPrice=0;
      const rate = availableSeatsCheck?.pricePerKm||0;
      for (let i=0; i<extraLocations.length; i++) {
        const [sg,eg] = await Promise.all([geocodeAddress(extraLocations[i].pickup), geocodeAddress(extraLocations[i].dropoff)]);
        if (!sg||!eg) throw new Error(`Could not find locations for Passenger ${i+1}.`);
        const alts = await fetchRouteAlternatives(sg,eg);
        if (!alts?.length) throw new Error(`Could not calculate distance for Passenger ${i+1}.`);
        const km = alts[0].distance/1000;
        totalDist+=km; totalPrice+=km*rate;
      }
      if (sameForAll) { setExtraDistance(totalDist*bookSeats); setExtraPrice(totalPrice*bookSeats); }
      else { setExtraDistance(totalDist); setExtraPrice(totalPrice); }
    } catch(e) { alert(e.message||'Error calculating price.'); }
    finally { setCalculatingPrice(false); }
  };

  const confirmExtraBooking = async () => {
    if (!availableSeatsCheck) return;
    const seats = parseInt(bookSeats,10);
    if (seats<1||seats>availableSeatsCheck.availableSeats) { alert('Invalid seat count'); return; }
    if (extraPrice===null) { alert('Please calculate the price first.'); return; }
    try {
      const newBookings = [...extraBookings];
      if (sameForAll) {
        newBookings.push({ date:availableSeatsCheck.dateStr, period:availableSeatsCheck.period, seats, pickupLocation:{address:extraLocations[0].pickup}, dropoffLocation:{address:extraLocations[0].dropoff}, distanceKm:extraDistance, price:extraPrice });
      } else {
        for (let i=0; i<seats; i++) newBookings.push({ date:availableSeatsCheck.dateStr, period:availableSeatsCheck.period, seats:1, pickupLocation:{address:extraLocations[i].pickup}, dropoffLocation:{address:extraLocations[i].dropoff}, distanceKm:extraDistance/seats, price:extraPrice/seats });
      }
      const token = localStorage.getItem('userToken');
      const { data } = await axios.put(`${import.meta.env.VITE_API_URL}/auth/update-extra-bookings`, { extraBookings:newBookings }, { headers:{Authorization:`Bearer ${token}`} });
      setExtraBookings(data.extraBookings||[]); setAvailableSeatsCheck(null); setBookSeats(1); setExtraLocations([{pickup:'',dropoff:''}]); setSameForAll(true); setExtraPrice(null); setExtraDistance(null);
      alert('Successfully booked extra seats!');
    } catch { alert('Could not complete booking'); }
  };

  const cancelExtraBooking = async index => {
    try {
      const nb = [...extraBookings]; nb.splice(index,1);
      const token = localStorage.getItem('userToken');
      const { data } = await axios.put(`${import.meta.env.VITE_API_URL}/auth/update-extra-bookings`, { extraBookings:nb }, { headers:{Authorization:`Bearer ${token}`} });
      setExtraBookings(data.extraBookings||[]);
    } catch(e) { console.error(e); }
  };

  const uploadPayment = async () => {
    if (!paymentFile||!paymentAmount||!paymentMonth) { alert('Please fill all fields and pick a receipt.'); return; }
    setPaymentUploading(true);
    try {
      const token = localStorage.getItem('userToken');
      const fd = new FormData();
      fd.append('month',paymentMonth); fd.append('amount',paymentAmount); fd.append('receipt',paymentFile);
      const { data } = await axios.post(`${import.meta.env.VITE_API_URL.replace('/api','')}/api/payments/upload`, fd, { headers:{Authorization:`Bearer ${token}`,'Content-Type':'multipart/form-data'} });
      setPayments(data.payments?[...data.payments].sort((a,b)=>b.month.localeCompare(a.month)):[]);
      setPaymentFile(null); setPaymentFilePreview(null); setPaymentAmount('');
      alert('Payment submitted successfully!');
    } catch { alert('Failed to upload payment.'); }
    finally { setPaymentUploading(false); }
  };

  const pendingPayments = payments.filter(p=>p.status==='pending').length;
  const upcomingAbsences = absences.filter(a=>a.date>=getDateStr(0)).length;

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"/>
        <p className="text-slate-400 text-sm font-medium">Loading dashboard…</p>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">

      {sidebarOpen && <div className="fixed inset-0 bg-black/60 z-20 lg:hidden" onClick={()=>setSidebarOpen(false)}/>}

      {/* ── Sidebar ── */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-30 w-64 bg-slate-900 border-r border-slate-800 flex flex-col transition-transform duration-300 ${sidebarOpen?'translate-x-0':'-translate-x-full'} lg:translate-x-0`}>
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-400 flex items-center justify-center shadow-lg shadow-amber-400/30">
              <MapPin className="w-5 h-5 text-slate-900"/>
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-none">E-Transport</p>
              <p className="text-slate-500 text-xs mt-0.5">Passenger Portal</p>
            </div>
          </div>
          <button onClick={()=>setSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-white"><X className="w-5 h-5"/></button>
        </div>

        <div className="p-4 mx-3 mt-4 rounded-xl bg-slate-800/60 border border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-slate-900 font-bold text-sm shadow-md">
              {profile?.name?.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="text-white font-semibold text-sm truncate">{profile?.name}</p>
              <p className="text-slate-400 text-xs truncate">{profile?.chosenVehicleNumber || 'No vehicle'}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isDriverActive?'bg-green-400 animate-pulse':'bg-slate-600'}`}/>
            <span className={`text-xs font-medium ${isDriverActive?'text-green-400':'text-slate-500'}`}>
              {isDriverActive?'Driver is Live':'Driver Offline'}
            </span>
          </div>
        </div>

        <nav className="flex-1 p-3 mt-2 space-y-1 overflow-y-auto">
          {TABS.map(tab=>{
            const Icon=tab.icon;
            const active=activeTab===tab.id;
            const badge = tab.id==='payments'&&pendingPayments>0 ? pendingPayments
              : tab.id==='absences'&&upcomingAbsences>0 ? upcomingAbsences : null;
            return(
              <button key={tab.id} onClick={()=>{setActiveTab(tab.id);setSidebarOpen(false);}}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150
                  ${active?'bg-amber-400 text-slate-900 shadow-lg shadow-amber-400/20':'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                <Icon className="w-4 h-4 flex-shrink-0"/>
                <span>{tab.label}</span>
                {badge&&<span className="ml-auto bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">{badge}</span>}
                {active&&<ChevronRight className="w-4 h-4 ml-auto opacity-60"/>}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Ad */}
        <div className="p-3">
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-2 flex justify-center">
            <GoogleAd slot="1234567891" style={{ display: 'block', width: '120px', height: '200px' }} format="vertical" responsive="false" />
          </div>
        </div>

        <div className="p-3 border-t border-slate-800">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors">
            <LogOut className="w-4 h-4"/><span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 bg-slate-900 border-b border-slate-800 flex items-center gap-3 px-4 flex-shrink-0">
          <button onClick={()=>setSidebarOpen(true)} className="lg:hidden text-slate-400 hover:text-white">
            <Menu className="w-5 h-5"/>
          </button>
          <div>
            <h1 className="text-white font-semibold text-sm">{TABS.find(t=>t.id===activeTab)?.label}</h1>
            <p className="text-slate-500 text-xs hidden sm:block">{getDateStr(0)}</p>
          </div>
          {isDriverActive&&(
            <div className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-xl bg-green-500/15 border border-green-500/30">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"/>
              <span className="text-green-400 text-xs font-bold">Driver Live</span>
            </div>
          )}
        </header>

        <main className="flex-1 overflow-y-auto bg-slate-950 p-4 lg:p-6">

          {/* ── OVERVIEW ── */}
          {activeTab==='overview' && (
            <div className="space-y-5 max-w-4xl mx-auto">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  {label:'Vehicle',value:profile?.chosenVehicleNumber||'—',icon:Hash,color:'text-amber-400',bg:'bg-amber-400/10'},
                  {label:'Absences',value:upcomingAbsences,icon:CalendarOff,color:'text-orange-400',bg:'bg-orange-400/10'},
                  {label:'Extra Bookings',value:extraBookings.length,icon:Users,color:'text-blue-400',bg:'bg-blue-400/10'},
                  {label:'Pending Pay.',value:pendingPayments,icon:Clock,color:'text-red-400',bg:'bg-red-400/10'},
                ].map(c=>(
                  <div key={c.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                    <div className={`w-9 h-9 rounded-xl ${c.bg} flex items-center justify-center mb-3`}>
                      <c.icon className={`w-4 h-4 ${c.color}`}/>
                    </div>
                    <p className="text-2xl font-bold text-white">{c.value}</p>
                    <p className="text-slate-500 text-xs mt-0.5">{c.label}</p>
                  </div>
                ))}
              </div>

              {/* Ad Banner */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex justify-center">
                <GoogleAd slot="1234567892" style={{ display: 'block', width: '468px', height: '60px' }} />
              </div>

              {/* Driver info card */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <h2 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-amber-400"/> My Driver & Vehicle
                </h2>
                {driverProfile ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-4 p-3 bg-slate-800 rounded-xl">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-white font-bold text-sm">
                        {driverProfile.name?.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold text-sm">{driverProfile.name}</p>
                        <p className="text-slate-400 text-xs flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3"/>{driverProfile.phoneNumber}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-slate-400 text-xs">Vehicle type</p>
                        <p className="text-white text-sm font-medium capitalize">{driverProfile.vehicleType}</p>
                      </div>
                    </div>
                    {driverProfile.routes?.length>0&&(
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {driverProfile.routes.map((r,i)=>(
                          <div key={i} className="p-3 bg-slate-800 rounded-xl">
                            <p className="text-slate-400 text-xs mb-1">Route {i+1}</p>
                            <p className="text-white text-sm font-medium">{r.route||'—'}</p>
                            <p className="text-amber-400 text-xs mt-0.5">{r.startTime||'—'}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {driverProfile.bankDetails?.accountNumber&&(
                      <div className="p-4 bg-slate-800 rounded-xl flex items-center gap-4 border border-slate-700">
                        <CreditCard className="w-5 h-5 text-amber-400 flex-shrink-0"/>
                        <div>
                          <p className="text-white font-bold text-sm">{driverProfile.bankDetails.bankName}</p>
                          <p className="text-slate-300 font-mono text-sm">{driverProfile.bankDetails.accountNumber}</p>
                          <p className="text-slate-500 text-xs mt-0.5">{driverProfile.bankDetails.accountName} · {driverProfile.bankDetails.branchName}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ):<p className="text-slate-500 text-sm italic">No driver assigned yet.</p>}
              </div>

              {/* Today absences quick view */}
              {absences.filter(a=>a.date===getDateStr(0)).length>0&&(
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-4 flex items-center gap-3">
                  <CalendarOff className="w-5 h-5 text-orange-400 flex-shrink-0"/>
                  <div>
                    <p className="text-orange-300 font-semibold text-sm">You are absent today</p>
                    <p className="text-orange-400/70 text-xs">{absences.find(a=>a.date===getDateStr(0))?.period} route</p>
                  </div>
                  <button onClick={()=>setActiveTab('absences')} className="ml-auto text-xs text-orange-400 hover:text-orange-300 font-medium">Manage →</button>
                </div>
              )}
            </div>
          )}

          {/* ── LIVE MAP ── */}
          {activeTab==='tracking' && (
            <div className="max-w-4xl mx-auto">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="p-4 flex items-center justify-between border-b border-slate-800">
                  <div>
                    <h2 className="text-white font-semibold text-sm">Driver's Live Location</h2>
                    <p className="text-slate-500 text-xs mt-0.5">{isDriverActive?'Your driver is currently broadcasting their location':'Driver has not started the trip yet'}</p>
                  </div>
                  {isDriverActive&&(
                    <span className="flex items-center gap-2 px-3 py-1.5 bg-green-500/15 border border-green-500/30 rounded-xl text-green-400 text-xs font-bold">
                      <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"/> LIVE
                    </span>
                  )}
                </div>
                <div className="h-[32rem] relative">
                  {isDriverActive && driverLocation ? (
                    <MapContainer center={[driverLocation.lat,driverLocation.lng]} zoom={15} style={{height:'100%',width:'100%',zIndex:0}}>
                      <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
                      <Marker position={[driverLocation.lat,driverLocation.lng]} icon={vehicleIcon} zIndexOffset={1000}>
                        <Popup>🚐 Driver's Live Location</Popup>
                      </Marker>
                      {(() => {
                        const period = driverProfile?.activeRouteIndex === 1 ? 'evening' : 'morning';
                        const locs = profile?.locations?.[period];
                        // Only show period-specific locations if they exist, otherwise fallback to old ones ONLY IF no locations object exists at all
                        const pLoc = locs?.pickup?.lat ? locs.pickup : (!profile?.locations ? profile?.pickupLocation : null);
                        const dLoc = locs?.dropoff?.lat ? locs.dropoff : (!profile?.locations ? profile?.dropoffLocation : null);
                        return (
                          <>
                            {pLoc?.lat && (
                              <Marker position={[pLoc.lat, pLoc.lng]} icon={pickupIcon}>
                                <Popup>📍 Your {period} Pickup: {pLoc.address}</Popup>
                              </Marker>
                            )}
                            {dLoc?.lat && (
                              <Marker position={[dLoc.lat, dLoc.lng]} icon={dropoffIcon}>
                                <Popup>🏁 Your {period} Drop-off: {dLoc.address}</Popup>
                              </Marker>
                            )}
                          </>
                        );
                      })()}
                      {userLocation && (
                        <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon}>
                          <Popup>🔵 Your Current Location</Popup>
                        </Marker>
                      )}
                      {driverProfile?.routes?.map((r,i)=> {
                        if (!r.polyline) return null;
                        try {
                          const points = JSON.parse(r.polyline);
                          if (!Array.isArray(points)) return null;
                          const positions = points.map(p => [p.latitude || p.lat, p.longitude || p.lng])
                            .filter(p => typeof p[0] === 'number' && !isNaN(p[0]));
                          return <Polyline key={i} positions={positions} color="#f59e0b" weight={4} opacity={0.6} dashArray="5,10"/>;
                        } catch (e) {
                          console.error('Polyline parse error:', e);
                          return null;
                        }
                      })}
                    </MapContainer>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-500 bg-slate-900">
                      <Navigation className="w-12 h-12 opacity-20"/>
                      <p className="text-sm">{driverProfile?'Driver has not started the trip yet.':'No driver assigned.'}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── ABSENCES ── */}
          {activeTab==='absences' && (
            <div className="max-w-2xl mx-auto space-y-5">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <h2 className="text-white font-semibold text-sm mb-1">Report Absence</h2>
                <p className="text-slate-500 text-xs mb-5">Let your driver know when you won't be travelling.</p>

                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">1. Date</p>
                    <div className="grid grid-cols-3 gap-2">
                      {['Today','Tomorrow','Specific'].map(t=>(
                        <button key={t} onClick={()=>setSelectedDateType(t)}
                          className={`py-2.5 rounded-xl text-sm font-medium transition-all ${selectedDateType===t?'bg-amber-400 text-slate-900':'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}`}>
                          {t}
                        </button>
                      ))}
                    </div>
                    {selectedDateType==='Specific'&&(
                      <input type="date" value={specificDate} onChange={e=>setSpecificDate(e.target.value)} min={getDateStr(0)}
                        className="mt-3 w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"/>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">2. Period</p>
                    <div className="grid grid-cols-3 gap-2">
                      {['Morning','Evening','Both'].map(p=>(
                        <button key={p} onClick={()=>setNewAbsencePeriod(p)}
                          className={`py-2.5 rounded-xl text-sm font-medium transition-all ${newAbsencePeriod===p?'bg-orange-400/20 text-orange-300 border border-orange-400/40':'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white border border-transparent'}`}>
                          {p==='Both'?'Full Day':p}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button onClick={handleSubmitAbsence} className="w-full py-3 bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2">
                    <CalendarOff className="w-4 h-4"/> Submit Absence
                  </button>
                </div>
              </div>

              {absences.length>0&&(
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                  <h2 className="text-white font-semibold text-sm mb-4">Recorded Absences</h2>
                  <div className="space-y-2">
                    {absences.map(a=>(
                      <div key={a.date} className="flex items-center justify-between p-3 bg-slate-800 rounded-xl">
                        <div>
                          <p className="text-white text-sm font-medium">{new Date(a.date).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric',year:'numeric'})}</p>
                          <p className="text-orange-400 text-xs font-semibold mt-0.5">{a.period} {a.period!=='Both'?'Route':'Routes'}</p>
                        </div>
                        <button onClick={()=>removeAbsence(a.date)} className="p-2 rounded-lg text-slate-500 hover:bg-red-500/15 hover:text-red-400 transition-colors">
                          <XCircle className="w-4 h-4"/>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── EXTRA SEAT BOOKINGS ── */}
          {activeTab==='bookings' && (
            <div className="max-w-2xl mx-auto space-y-5">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <h2 className="text-white font-semibold text-sm mb-1">Book Extra Seats</h2>
                <p className="text-slate-500 text-xs mb-5">Check availability and reserve seats for your friends.</p>

                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">1. Date</p>
                    <div className="grid grid-cols-3 gap-2">
                      {['Today','Tomorrow','Specific'].map(t=>(
                        <button key={t} onClick={()=>{setBookingDateType(t);setAvailableSeatsCheck(null);setExtraPrice(null);}}
                          className={`py-2.5 rounded-xl text-sm font-medium transition-all ${bookingDateType===t?'bg-amber-400 text-slate-900':'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}`}>
                          {t}
                        </button>
                      ))}
                    </div>
                    {bookingDateType==='Specific'&&(
                      <input type="date" value={bookingSpecificDate} onChange={e=>{setBookingSpecificDate(e.target.value);setAvailableSeatsCheck(null);}} min={getDateStr(0)}
                        className="mt-3 w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"/>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">2. Period</p>
                    <div className="grid grid-cols-2 gap-2">
                      {['Morning','Evening'].map(p=>(
                        <button key={p} onClick={()=>{setBookingPeriod(p);setAvailableSeatsCheck(null);setExtraPrice(null);}}
                          className={`py-2.5 rounded-xl text-sm font-medium transition-all ${bookingPeriod===p?'bg-green-400/20 text-green-300 border border-green-400/40':'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white border border-transparent'}`}>
                          {p} Route
                        </button>
                      ))}
                    </div>
                  </div>

                  {!availableSeatsCheck ? (
                    <button onClick={checkAvailability} className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold text-sm rounded-xl transition-colors">
                      Check Availability
                    </button>
                  ) : availableSeatsCheck.availableSeats>0 ? (
                    <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 space-y-4">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-400"/>
                        <span className="text-green-300 font-bold">{availableSeatsCheck.availableSeats} seats available!</span>
                      </div>

                      <div className="flex items-center gap-3">
                        <label className="text-slate-300 text-sm font-medium">Seats needed:</label>
                        <input type="number" min="1" max={availableSeatsCheck.availableSeats} value={bookSeats} onChange={e=>handleSeatCountChange(e.target.value)}
                          className="w-20 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"/>
                      </div>

                      {parseInt(bookSeats)>1&&(
                        <label className="flex items-center gap-3 cursor-pointer p-3 bg-slate-800 rounded-xl" onClick={()=>handleSameForAllChange(!sameForAll)}>
                          <div className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors ${sameForAll?'bg-amber-400 border-amber-400':'border-slate-500'}`}>
                            {sameForAll&&<CheckCircle className="w-3 h-3 text-slate-900"/>}
                          </div>
                          <span className="text-slate-300 text-sm">Same pickup & drop-off for all {bookSeats} passengers</span>
                        </label>
                      )}

                      <div className="space-y-3 max-h-52 overflow-y-auto">
                        {extraLocations.map((loc,idx)=>(
                          <div key={idx} className="space-y-2 p-3 bg-slate-800 rounded-xl">
                            {!sameForAll&&<p className="text-xs text-slate-400 font-semibold">Passenger {idx+1}</p>}
                            <input type="text" placeholder="Pickup location" value={loc.pickup} onChange={e=>{const nl=[...extraLocations];nl[idx].pickup=e.target.value;setExtraLocations(nl);setExtraPrice(null);}}
                              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder-slate-500"/>
                            <input type="text" placeholder="Drop-off location" value={loc.dropoff} onChange={e=>{const nl=[...extraLocations];nl[idx].dropoff=e.target.value;setExtraLocations(nl);setExtraPrice(null);}}
                              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder-slate-500"/>
                          </div>
                        ))}
                      </div>

                      {extraPrice===null ? (
                        <button onClick={calculateExtraPrice} disabled={calculatingPrice} className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-bold text-sm rounded-xl transition-colors">
                          {calculatingPrice?'Calculating…':'Calculate Price'}
                        </button>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex justify-between items-center p-3 bg-slate-800 rounded-xl">
                            <div><p className="text-slate-400 text-xs">Distance</p><p className="text-white font-bold">{extraDistance.toFixed(1)} km</p></div>
                            <div className="text-right"><p className="text-slate-400 text-xs">Total @ Rs.{availableSeatsCheck.pricePerKm}/km</p><p className="text-green-400 font-bold text-lg">Rs. {Math.round(extraPrice)}</p></div>
                          </div>
                          <button onClick={confirmExtraBooking} className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold text-sm rounded-xl transition-colors">
                            Confirm {bookSeats} Seat{bookSeats>1?'s':''}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                      <XCircle className="w-5 h-5 text-red-400 flex-shrink-0"/>
                      <span className="text-red-300 font-medium text-sm">No seats available for this ride.</span>
                    </div>
                  )}
                </div>
              </div>

              {extraBookings.length>0&&(
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                  <h2 className="text-white font-semibold text-sm mb-4">My Bookings</h2>
                  <div className="space-y-2">
                    {extraBookings.slice().sort((a,b)=>a.date.localeCompare(b.date)).map((b,i)=>(
                      <div key={i} className="p-3 bg-slate-800 rounded-xl flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-white font-medium text-sm">{new Date(b.date).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}</span>
                            <span className="text-xs bg-green-400/15 text-green-400 px-2 py-0.5 rounded-full font-medium">{b.seats} seat{b.seats>1?'s':''}</span>
                            <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full">{b.period}</span>
                          </div>
                          {b.pickupLocation&&(
                            <div className="mt-1.5 text-xs text-slate-400 space-y-0.5 pl-2 border-l-2 border-slate-700">
                              <p>From: {b.pickupLocation.address}</p>
                              <p>To: {b.dropoffLocation?.address}</p>
                              {b.price&&<p className="text-green-400 font-semibold">Rs. {Math.round(b.price)}</p>}
                            </div>
                          )}
                        </div>
                        <button onClick={()=>cancelExtraBooking(i)} className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors flex-shrink-0">
                          <XCircle className="w-4 h-4"/>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── PAYMENTS ── */}
          {activeTab==='payments' && (
            <div className="max-w-2xl mx-auto space-y-5">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <h2 className="text-white font-semibold text-sm mb-1">Submit Monthly Payment</h2>
                <p className="text-slate-500 text-xs mb-5">Upload your receipt and the driver will approve it.</p>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">Month</label>
                      <input type="month" value={paymentMonth} onChange={e=>setPaymentMonth(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"/>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">Amount (LKR)</label>
                      <input type="number" value={paymentAmount} onChange={e=>setPaymentAmount(e.target.value)} placeholder="e.g. 3500"
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder-slate-600"/>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Receipt Photo</label>
                    <label className="flex flex-col items-center justify-center w-full h-28 bg-slate-800 border-2 border-dashed border-slate-700 rounded-xl cursor-pointer hover:border-amber-400/50 transition-colors">
                      {paymentFilePreview
                        ?<img src={paymentFilePreview} alt="Preview" className="h-full object-cover rounded-xl"/>
                        :<><Upload className="w-6 h-6 text-slate-500 mb-2"/><span className="text-slate-500 text-xs">Click to upload receipt</span></>}
                      <input type="file" accept="image/*" className="hidden" onChange={e=>{const f=e.target.files[0];setPaymentFile(f||null);setPaymentFilePreview(f?URL.createObjectURL(f):null);}}/>
                    </label>
                  </div>
                  <button onClick={uploadPayment} disabled={paymentUploading}
                    className="w-full py-3 bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold text-sm rounded-xl transition-colors disabled:opacity-50">
                    {paymentUploading?'Uploading…':'Submit Receipt'}
                  </button>
                </div>
              </div>

              {payments.length>0&&(
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                  <h2 className="text-white font-semibold text-sm mb-4">Payment History</h2>
                  <div className="space-y-2">
                    {payments.map((p,i)=>(
                      <div key={i} className="flex items-center gap-3 p-3 bg-slate-800 rounded-xl">
                        {p.imageUrl&&<a href={p.imageUrl} target="_blank" rel="noreferrer"><img src={p.imageUrl} alt="receipt" className="w-12 h-12 object-cover rounded-lg border border-slate-700 hover:opacity-80 transition-opacity"/></a>}
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-semibold text-sm">{p.month} · LKR {p.amount?.toLocaleString()}</p>
                          <p className="text-slate-500 text-xs mt-0.5">
                            {p.submittedAt?new Date(p.submittedAt).toLocaleDateString():'N/A'}
                            {p.reviewedAt&&` · Reviewed ${new Date(p.reviewedAt).toLocaleDateString()}`}
                          </p>
                          {p.note&&<p className="text-slate-400 text-xs italic mt-0.5">Note: {p.note}</p>}
                        </div>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 flex-shrink-0
                          ${p.status==='approved'?'bg-green-500/15 text-green-400':p.status==='rejected'?'bg-red-500/15 text-red-400':'bg-amber-500/15 text-amber-400'}`}>
                          {p.status==='approved'?<CheckCircle className="w-3 h-3"/>:p.status==='rejected'?<XCircle className="w-3 h-3"/>:<Clock className="w-3 h-3"/>}
                          {p.status==='approved'?'Approved':p.status==='rejected'?'Rejected':'Pending'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── MY LOCATIONS ── */}
          {activeTab==='settings' && (
            <div className="max-w-2xl mx-auto space-y-5">
              {/* Personal info */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <h2 className="text-white font-semibold text-sm mb-4 flex items-center gap-2"><User className="w-4 h-4 text-amber-400"/>Personal Information</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[{icon:User,label:'Name',value:profile?.name},{icon:Phone,label:'Phone',value:profile?.phoneNumber},{icon:Mail,label:'Email',value:profile?.email},{icon:Hash,label:'Vehicle',value:profile?.chosenVehicleNumber}].map(f=>(
                    <div key={f.label} className="flex items-center gap-3 p-3 bg-slate-800 rounded-xl">
                      <f.icon className="w-4 h-4 text-slate-400 flex-shrink-0"/>
                      <div className="min-w-0">
                        <p className="text-slate-500 text-xs">{f.label}</p>
                        <p className="text-white text-sm font-medium truncate">{f.value||'—'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Locations */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-white font-semibold text-sm flex items-center gap-2"><MapPin className="w-4 h-4 text-sm text-amber-400"/> Pickup & Drop-off</h2>
                  {!isEditingLocations ? (
                    <button onClick={()=>setIsEditingLocations(true)} className="text-amber-400 hover:text-amber-300 text-xs font-bold uppercase tracking-wider">Edit Locations</button>
                  ) : (
                    <div className="flex gap-3">
                      <button onClick={()=>setIsEditingLocations(false)} className="text-slate-400 hover:text-white text-xs font-bold uppercase tracking-wider">Cancel</button>
                      <button onClick={handleSaveLocations} className="text-green-400 hover:text-green-300 text-xs font-bold uppercase tracking-wider">Save Changes</button>
                    </div>
                  )}
                </div>

                {isEditingLocations ? (
                  <div className="space-y-6">
                    {[
                      { period: 'morning', label: 'Morning Route' },
                      { period: 'evening', label: 'Evening Route' }
                    ].map(p => (
                      <div key={p.period} className="p-4 bg-slate-800/50 rounded-xl border border-slate-800">
                        <h3 className="text-white text-xs font-bold mb-4 uppercase tracking-widest">{p.label}</h3>
                        <div className="space-y-4">
                          {['Pickup', 'Dropoff'].map(type => {
                            const key = p.period + type;
                            return (
                              <div key={key}>
                                <label className="block text-xs font-medium text-slate-400 mb-1.5">{type}</label>
                                <div className="flex gap-2">
                                  <div className="relative flex-1">
                                    <input type="text" value={locationData[key]} onChange={e=>setLocationData(v=>({...v,[key]:e.target.value}))}
                                      placeholder={`e.g. ${type === 'Pickup' ? 'Station' : 'Office'}`}
                                      className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder-slate-600"/>
                                    <button onClick={()=>setMapPickingMode(mapPickingMode===key?null:key)}
                                      className={`absolute right-2 top-1.5 p-1 rounded-lg transition-colors ${mapPickingMode===key?'bg-amber-400 text-slate-900':'text-slate-500 hover:text-amber-400'}`}>
                                      <MousePointer2 className="w-4 h-4"/>
                                    </button>
                                  </div>
                                  <button onClick={()=>handleUseCurrentLocation(key)} title="Use current location" className="p-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-400 hover:text-amber-400 transition-colors">
                                    <LocateFixed className="w-5 h-5"/>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}

                    {mapPickingMode && (
                      <div className="rounded-xl overflow-hidden border-2 border-amber-400/50 h-64 relative">
                        <MapContainer 
                          center={[
                            profile?.locations?.[mapPickingMode.startsWith('morning')?'morning':'evening']?.[mapPickingMode.endsWith('Pickup')?'pickup':'dropoff']?.lat || 6.9271, 
                            profile?.locations?.[mapPickingMode.startsWith('morning')?'morning':'evening']?.[mapPickingMode.endsWith('Pickup')?'pickup':'dropoff']?.lng || 79.8612
                          ]} 
                          zoom={13} style={{height:'100%',width:'100%'}}>
                          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
                          <MapClickHandler/>
                          {(() => {
                            const p = mapPickingMode.startsWith('morning') ? 'morning' : 'evening';
                            const locs = profile?.locations?.[p];
                            return (
                              <>
                                {locs?.pickup?.lat && <Marker position={[locs.pickup.lat, locs.pickup.lng]} icon={pickupIcon}/>}
                                {locs?.dropoff?.lat && <Marker position={[locs.dropoff.lat, locs.dropoff.lng]} icon={dropoffIcon}/>}
                              </>
                            );
                          })()}
                        </MapContainer>
                        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-slate-900 px-4 py-1.5 rounded-full text-xs font-bold shadow-lg z-[1000] flex items-center gap-2">
                          <MousePointer2 className="w-3 h-3"/> Click on map to set {mapPickingMode.replace(/([A-Z])/g, ' $1')}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        { period: 'morning', label: 'Morning Route' },
                        { period: 'evening', label: 'Evening Route' }
                      ].map(p => {
                        const periodLocs = profile?.locations?.[p.period];
                        const locs = (periodLocs?.pickup || periodLocs?.dropoff) 
                          ? periodLocs 
                          : (!profile?.locations ? { pickup: profile?.pickupLocation, dropoff: profile?.dropoffLocation } : null);
                        return (
                          <div key={p.period} className="p-4 bg-slate-800/30 rounded-xl border border-slate-800/50">
                            <h3 className="text-amber-400 text-xs font-bold mb-4 uppercase tracking-widest">{p.label}</h3>
                            <div className="space-y-4">
                              <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0 mt-0.5"><MapPin className="w-4 h-4 text-green-400"/></div>
                                <div><p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Pickup</p><p className="text-slate-200 text-sm font-medium text-wrap break-words">{locs?.pickup?.address || locs?.pickup || 'Not set'}</p></div>
                              </div>
                              <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0 mt-0.5"><MapPin className="w-4 h-4 text-red-400"/></div>
                                <div><p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Drop-off</p><p className="text-slate-200 text-sm font-medium text-wrap break-words">{locs?.dropoff?.address || locs?.dropoff || 'Not set'}</p></div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {(profile?.locations || profile?.pickupLocation || profile?.dropoffLocation) && (
                      <div className="mt-6">
                        <p className="text-slate-400 text-xs font-bold mb-3 uppercase tracking-widest flex items-center gap-2">
                          <Navigation className="w-3 h-3 text-amber-400"/> Location Preview
                        </p>
                        <div className="h-64 rounded-2xl overflow-hidden border border-slate-800 relative shadow-inner">
                          <MapContainer 
                            center={[
                              profile?.locations?.morning?.pickup?.lat || profile?.pickupLocation?.lat || 6.9271, 
                              profile?.locations?.morning?.pickup?.lng || profile?.pickupLocation?.lng || 79.8612
                            ]} 
                            zoom={12} style={{height:'100%',width:'100%',zIndex:0}}>
                            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
                            {[
                              { p: 'morning', icon: pickupIcon, label: 'Morning Pickup' },
                              { p: 'morning', type: 'dropoff', icon: dropoffIcon, label: 'Morning Drop-off' },
                              { p: 'evening', icon: pickupIcon, label: 'Evening Pickup' },
                              { p: 'evening', type: 'dropoff', icon: dropoffIcon, label: 'Evening Drop-off' }
                            ].map((item, idx) => {
                              const loc = profile?.locations?.[item.p]?.[item.type || 'pickup'];
                              if (!loc?.lat) return null;
                              return (
                                <Marker key={idx} position={[loc.lat, loc.lng]} icon={item.icon}>
                                  <Popup><span className="font-bold">{item.label}:</span><br/>{loc.address}</Popup>
                                </Marker>
                              );
                            })}
                          </MapContainer>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-2 italic text-center">Verify your locations on the map. If they are incorrect, click "Edit Locations" to fix them.</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Google AdSense Banner */}
          <div className="mt-8 flex justify-center">
            <GoogleAd slot="1234567890" style={{ display: 'block', width: '728px', height: '90px' }} />
          </div>

        </main>
      </div>
    </div>
  );
}