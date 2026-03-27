import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  LogOut, Car, Hash, User, Phone, Mail, MapPin, Calendar,
  AlertCircle, Navigation, CreditCard, ChevronRight, CheckCircle,
  XCircle, Clock, Upload, Settings, BarChart2, Users, Menu, X
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { io } from 'socket.io-client';
import L from 'leaflet';
import { geocodeAddress, fetchRoutePolyline, fetchRouteAlternatives } from '../services/mapServices';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

const vehicleIcon = L.divIcon({
  html: `<div style="background-color:#f59e0b;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 6px rgba(0,0,0,0.3);border:2px solid white;"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg></div>`,
  className: '',iconSize:[34,34],iconAnchor:[17,17],popupAnchor:[0,-17]
});
const pickupIcon = L.divIcon({
  html:`<div style="color:#10b981;filter:drop-shadow(0 3px 3px rgba(0,0,0,0.5));transform:translateY(-4px);"><svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 24 24" fill="currentColor" stroke="white" stroke-width="1.5"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3" fill="white"/></svg></div>`,
  className:'',iconSize:[38,38],iconAnchor:[19,38],popupAnchor:[0,-38]
});
const dropoffIcon = L.divIcon({
  html:`<div style="color:#ef4444;filter:drop-shadow(0 3px 3px rgba(0,0,0,0.5));transform:translateY(-4px);"><svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 24 24" fill="currentColor" stroke="white" stroke-width="1.5"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3" fill="white"/></svg></div>`,
  className:'',iconSize:[38,38],iconAnchor:[19,38],popupAnchor:[0,-38]
});

const TABS = [
  { id: 'overview',  label: 'Overview',   icon: BarChart2 },
  { id: 'tracking',  label: 'Live Map',   icon: Navigation },
  { id: 'passengers',label: 'Passengers', icon: Users },
  { id: 'payments',  label: 'Payments',   icon: CreditCard },
  { id: 'settings',  label: 'Settings',   icon: Settings },
];

export default function DriverDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [passengers, setPassengers] = useState([]);
  const [loadingPassengers, setLoadingPassengers] = useState(true);
  const [isEditingRoute, setIsEditingRoute] = useState(false);
  const [routeData, setRouteData] = useState({ routes: [], totalSeats: '', pricePerKm: '' });
  const [isTripActive, setIsTripActive] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const currentLocationRef = React.useRef(null);
  const [routePolylines, setRoutePolylines] = useState([]);
  const [allPayments, setAllPayments] = useState([]);
  const [reviewNotes, setReviewNotes] = useState({});
  const [isEditingBank, setIsEditingBank] = useState(false);
  const [bankDetails, setBankDetails] = useState({ bankName:'',accountName:'',accountNumber:'',branchName:'' });
  const [systemPayments, setSystemPayments] = useState([]);
  const [sysPayMonth, setSysPayMonth] = useState(() => new Date().toISOString().slice(0,7));
  const [sysPayAmount, setSysPayAmount] = useState('');
  const [sysPayFile, setSysPayFile] = useState(null);
  const [sysPayPreview, setSysPayPreview] = useState(null);
  const [sysPayUploading, setSysPayUploading] = useState(false);

  const navigate = useNavigate();

  useEffect(() => { currentLocationRef.current = currentLocation; }, [currentLocation]);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem('userToken');
        if (!token) return navigate('/login');
        const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
        if (data.role !== 'driver') return navigate('/passenger-dashboard');
        setProfile(data);
        setRouteData({ routes: data.routes||[], totalSeats: data.totalSeats||'', pricePerKm: data.pricePerKm||'' });
        setBankDetails({ bankName:data.bankDetails?.bankName||'', accountName:data.bankDetails?.accountName||'', accountNumber:data.bankDetails?.accountNumber||'', branchName:data.bankDetails?.branchName||'' });
        setIsTripActive(data.isTripActive||false);
        if (data.currentLocation) setCurrentLocation(data.currentLocation);
        try {
          const sysRes = await axios.get(`${import.meta.env.VITE_API_URL.replace('/api','')}/api/payments/admin/my-payments`, { headers:{Authorization:`Bearer ${token}`} });
          setSystemPayments(sysRes.data||[]);
        } catch(_){}
        if (data.routes) {
          const polys = data.routes.filter(r=>r.polyline).map(r=>{
            try {
              const points = JSON.parse(r.polyline);
              if (!Array.isArray(points)) return null;
              const validPoints = points.map(p => ({
                lat: p.latitude || p.lat,
                lng: p.longitude || p.lng
              })).filter(p => typeof p.lat === 'number');
              return { points: validPoints };
            } catch { return null; }
          }).filter(p => p !== null);
          setRoutePolylines(polys);
        }
      } catch(e){ navigate('/login'); } finally { setLoading(false); }
    };
    fetchProfile();
  }, [navigate]);

  useEffect(() => {
    const fetchPassengers = async () => {
      try {
        const token = localStorage.getItem('userToken');
        if (!token) return;
        const { data } = await axios.get(`${import.meta.env.VITE_API_URL}/auth/passengers`, { headers:{Authorization:`Bearer ${token}`} });
        setPassengers(data);
        try {
          const token2 = localStorage.getItem('userToken');
          const pr = await axios.get(`${import.meta.env.VITE_API_URL.replace('/api','')}/api/payments/all-payments`, { headers:{Authorization:`Bearer ${token2}`} });
          setAllPayments(pr.data||[]);
        } catch{}
      } catch(e){ console.error(e); } finally { setLoadingPassengers(false); }
    };
    fetchPassengers();
  }, []);

  useEffect(() => {
    let watchId, newSocket, interval;
    if (isTripActive && profile) {
      newSocket = io(import.meta.env.VITE_API_URL.replace('/api',''),{transports:['websocket']});
      watchId = navigator.geolocation.watchPosition(position => {
        const loc = {lat:position.coords.latitude,lng:position.coords.longitude,timestamp:new Date()};
        setCurrentLocation(loc);
        newSocket.emit('driver_location_update',{driverId:profile.uid,...loc});
      }, e=>console.error(e), {enableHighAccuracy:true,maximumAge:0});
      interval = setInterval(()=>{
        const loc = currentLocationRef.current;
        if(loc){
          const token=localStorage.getItem('userToken');
          axios.put(`${import.meta.env.VITE_API_URL}/auth/update-location`,loc,{headers:{Authorization:`Bearer ${token}`}}).catch(console.error);
        }
      },30000);
    }
    return ()=>{ if(watchId!==undefined) navigator.geolocation.clearWatch(watchId); if(interval) clearInterval(interval); if(newSocket) newSocket.disconnect(); };
  }, [isTripActive, profile]);

  const getTodayStr = () => { const d=new Date(); return (new Date(d-d.getTimezoneOffset()*60000)).toISOString().split('T')[0]; };

  const handleLogout = () => { localStorage.removeItem('userToken'); localStorage.removeItem('userRole'); navigate('/login'); };

  const handleSaveRoute = async () => {
    try {
      const token = localStorage.getItem('userToken');
      const enrichedRoutes = await Promise.all(routeData.routes.map(async r=>{
        if(r.polylineOverride) return{route:r.route,via:r.via,startTime:r.startTime,polyline:r.polylineOverride};
        if(!r.route||!r.route.includes(' ')) return r;
        const parts=r.route.split(/ - | to |,/i);
        if(parts.length<2) return r;
        const [start,end]=parts;
        const [sg,eg]=await Promise.all([geocodeAddress(start.trim()),geocodeAddress(end.trim())]);
        let viaGeoList=null;
        if(r.via?.trim()){const geos=await Promise.all(r.via.split(',').map(v=>v.trim()).filter(v=>v).map(v=>geocodeAddress(v)));viaGeoList=geos.filter(g=>g!==null);if(!viaGeoList.length)viaGeoList=null;}
        if(sg&&eg){const pts=await fetchRoutePolyline(sg,eg,viaGeoList);return{...r,polyline:pts?JSON.stringify(pts):undefined};}
        return r;
      }));
      const{data}=await axios.put(`${import.meta.env.VITE_API_URL}/auth/update-route`,{routes:enrichedRoutes,totalSeats:parseInt(routeData.totalSeats)||0,pricePerKm:parseFloat(routeData.pricePerKm)||0},{headers:{Authorization:`Bearer ${localStorage.getItem('userToken')}`}});
      setProfile(data);
      const polys = (data.routes||[]).filter(r=>r.polyline).map(r=>{
        try {
          const points = JSON.parse(r.polyline);
          if (!Array.isArray(points)) return null;
          const validPoints = points.map(p => ({
            lat: p.latitude || p.lat,
            lng: p.longitude || p.lng
          })).filter(p => typeof p.lat === 'number');
          return { points: validPoints };
        } catch { return null; }
      }).filter(p => p !== null);
      setRoutePolylines(polys);
      setIsEditingRoute(false);
    } catch(e){ alert('Failed to update route information'); }
  };

  const handleFindAlternatives = async index => {
    const r=routeData.routes[index];
    if(!r.route?.includes(' ')){alert("Enter a route like 'Colombo - Kandy'.");return;}
    const parts=r.route.split(/ - | to |,/i);
    if(parts.length<2)return;
    try{
      const[sg,eg]=await Promise.all([geocodeAddress(parts[0].trim()),geocodeAddress(parts[1].trim())]);
      let viaGeoList=null;
      if(r.via?.trim()){const geos=await Promise.all(r.via.split(',').map(v=>v.trim()).filter(v=>v).map(v=>geocodeAddress(v)));viaGeoList=geos.filter(g=>g!==null);if(!viaGeoList.length)viaGeoList=null;}
      if(sg&&eg){
        const alts=await fetchRouteAlternatives(sg,eg,viaGeoList);
        if(alts?.length>0){const nr=[...routeData.routes];nr[index]={...nr[index],alternatives:alts,selectedAlternativeIndex:0,polylineOverride:alts[0].polyline};setRouteData({...routeData,routes:nr});}
        else alert('Could not generate alternative routes.');
      }else alert('Could not verify locations.');
    }catch(e){alert('Error fetching alternative routes.');}
  };

  const toggleTrip = async () => {
    try{
      const token=localStorage.getItem('userToken');
      const endpoint=isTripActive?'end-trip':'start-trip';
      const{data}=await axios.put(`${import.meta.env.VITE_API_URL}/auth/${endpoint}`,{},{headers:{Authorization:`Bearer ${token}`}});
      setIsTripActive(data.isTripActive);
      if(!data.isTripActive)setCurrentLocation(null);
    }catch(e){alert('Could not toggle trip state.');}
  };

  const reviewPayment = async (passengerId,paymentId,status) => {
    try{
      const token=localStorage.getItem('userToken');
      await axios.put(`${import.meta.env.VITE_API_URL.replace('/api','')}/api/payments/review/${passengerId}/${paymentId}`,{status,note:reviewNotes[paymentId]||''},{headers:{Authorization:`Bearer ${token}`}});
      const pr=await axios.get(`${import.meta.env.VITE_API_URL.replace('/api','')}/api/payments/all-payments`,{headers:{Authorization:`Bearer ${token}`}});
      setAllPayments(pr.data||[]);
    }catch(e){alert('Failed to update payment status.');}
  };

  const handleSaveBankDetails = async () => {
    try{
      const{data}=await axios.put(`${import.meta.env.VITE_API_URL}/auth/update-bank-details`,{bankDetails},{headers:{Authorization:`Bearer ${localStorage.getItem('userToken')}`}});
      setProfile(data);setIsEditingBank(false);
    }catch(e){alert('Failed to update bank details');}
  };

  const uploadSystemPayment = async () => {
    if(!sysPayMonth||!sysPayAmount||!sysPayFile){alert('Please fill in month, amount and select a receipt image.');return;}
    setSysPayUploading(true);
    try{
      const fd=new FormData();fd.append('month',sysPayMonth);fd.append('amount',sysPayAmount);fd.append('receipt',sysPayFile);
      const res=await axios.post(`${import.meta.env.VITE_API_URL.replace('/api','')}/api/payments/admin/upload`,fd,{headers:{Authorization:`Bearer ${localStorage.getItem('userToken')}`,'Content-Type':'multipart/form-data'}});
      setSystemPayments(res.data.systemPayments||[]);setSysPayAmount('');setSysPayFile(null);setSysPayPreview(null);
    }catch(e){alert('Failed to upload payment. Please try again.');}finally{setSysPayUploading(false);}
  };

  const pendingPaymentsCount = allPayments.reduce((sum,p)=>sum+(p.payments?.filter(pay=>pay.status==='pending').length||0),0);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"/>
        <p className="text-slate-400 text-sm font-medium">Loading dashboard…</p>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-950 font-sans overflow-hidden">

      {/* ── Mobile overlay ── */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/60 z-20 lg:hidden" onClick={()=>setSidebarOpen(false)}/>}

      {/* ── Sidebar ── */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-30 w-64 bg-slate-900 border-r border-slate-800 flex flex-col transition-transform duration-300 ${sidebarOpen?'translate-x-0':'-translate-x-full'} lg:translate-x-0`}>
        {/* Logo */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-400 flex items-center justify-center shadow-lg shadow-amber-400/30">
              <Car className="w-5 h-5 text-slate-900"/>
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-none">E-Transport</p>
              <p className="text-slate-500 text-xs mt-0.5">Driver Portal</p>
            </div>
          </div>
          <button onClick={()=>setSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-white"><X className="w-5 h-5"/></button>
        </div>

        {/* Driver card */}
        <div className="p-4 mx-3 mt-4 rounded-xl bg-slate-800/60 border border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-slate-900 font-bold text-sm shadow-md">
              {profile?.name?.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="text-white font-semibold text-sm truncate">{profile?.name}</p>
              <p className="text-slate-400 text-xs truncate">{profile?.vehicleNumber}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isTripActive?'bg-green-400 animate-pulse':'bg-slate-600'}`}/>
            <span className={`text-xs font-medium ${isTripActive?'text-green-400':'text-slate-500'}`}>
              {isTripActive?'Live Tracking On':'Tracking Off'}
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 mt-2 space-y-1 overflow-y-auto">
          {TABS.map(tab=>{
            const Icon=tab.icon;
            const active=activeTab===tab.id;
            const badge=(tab.id==='payments'&&pendingPaymentsCount>0)?pendingPaymentsCount:null;
            return(
              <button key={tab.id} onClick={()=>{setActiveTab(tab.id);setSidebarOpen(false);}}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150
                  ${active?'bg-amber-400 text-slate-900 shadow-lg shadow-amber-400/20':'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                <Icon className="w-4 h-4 flex-shrink-0"/>
                <span>{tab.label}</span>
                {badge && <span className="ml-auto bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">{badge}</span>}
                {active && <ChevronRight className="w-4 h-4 ml-auto opacity-60"/>}
              </button>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-slate-800">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors">
            <LogOut className="w-4 h-4"/><span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={()=>setSidebarOpen(true)} className="lg:hidden text-slate-400 hover:text-white">
              <Menu className="w-5 h-5"/>
            </button>
            <div>
              <h1 className="text-white font-semibold text-sm">{TABS.find(t=>t.id===activeTab)?.label}</h1>
              <p className="text-slate-500 text-xs hidden sm:block">{getTodayStr()}</p>
            </div>
          </div>
          <button
            onClick={toggleTrip}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200
              ${isTripActive?'bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25':'bg-green-500/15 text-green-400 border border-green-500/30 hover:bg-green-500/25'}`}>
            <span className={`w-2 h-2 rounded-full ${isTripActive?'bg-red-400 animate-pulse':'bg-green-400'}`}/>
            {isTripActive?'End Trip':'Start Trip'}
          </button>
        </header>

        {/* Tab content — scrollable */}
        <main className="flex-1 overflow-y-auto bg-slate-950 p-4 lg:p-6">

          {/* ── OVERVIEW ── */}
          {activeTab==='overview' && (
            <div className="space-y-5 max-w-4xl mx-auto">

              {/* Stat cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  {label:'Passengers',value:passengers.length,icon:Users,color:'text-blue-400',bg:'bg-blue-400/10'},
                  {label:'Total Seats',value:profile?.totalSeats||'—',icon:Car,color:'text-amber-400',bg:'bg-amber-400/10'},
                  {label:'Price / km',value:profile?.pricePerKm?`Rs.${profile.pricePerKm}`:'—',icon:CreditCard,color:'text-green-400',bg:'bg-green-400/10'},
                  {label:'Pending Pay.',value:pendingPaymentsCount,icon:Clock,color:'text-red-400',bg:'bg-red-400/10'},
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

              {/* Today's ride summary */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="w-4 h-4 text-amber-400"/>
                  <h2 className="text-white font-semibold text-sm">Today's Ride Summary</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {['Morning','Evening'].map(period=>{
                    const assigned=passengers.length;
                    const absent=passengers.filter(p=>p.absences?.some(a=>a.date===getTodayStr()&&(a.period===period||a.period==='Both'))).length;
                    const extra=passengers.reduce((s,p)=>s+(p.extraBookings?.filter(eb=>eb.date===getTodayStr()&&(eb.period===period||eb.period==='Both')).reduce((ss,eb)=>ss+eb.seats,0)||0),0);
                    const present=assigned-absent;
                    const free=profile?.totalSeats-(present+extra);
                    const total=present+extra;
                    const over=profile?.totalSeats&&total>profile.totalSeats;
                    return(
                      <div key={period} className={`rounded-xl p-4 border ${over?'bg-red-500/10 border-red-500/30':'bg-slate-800/60 border-slate-700/50'}`}>
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-white font-medium text-sm">{period==='Morning'?'🌅':'🌆'} {period}</span>
                          {over
                            ?<span className="text-red-400 text-xs font-bold flex items-center gap-1"><AlertCircle className="w-3 h-3"/>Overbooked</span>
                            :<span className="text-green-400 text-xs font-medium">{free??'—'} free</span>}
                        </div>
                        <div className="space-y-1.5 text-xs text-slate-400">
                          <div className="flex justify-between"><span>Active</span><span className="text-white font-medium">{present}</span></div>
                          <div className="flex justify-between"><span>Absent</span><span className="text-amber-400 font-medium">{absent}</span></div>
                          <div className="flex justify-between"><span>Extra bookings</span><span className="text-blue-400 font-medium">{extra}</span></div>
                          <div className="flex justify-between border-t border-slate-700 pt-1.5 mt-1.5">
                            <span className="font-semibold text-slate-300">Occupancy</span>
                            <span className={`font-bold ${over?'text-red-400':'text-white'}`}>{total} / {profile?.totalSeats||'—'}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Routes overview */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-amber-400"/>
                    <h2 className="text-white font-semibold text-sm">My Routes</h2>
                  </div>
                  <button onClick={()=>setActiveTab('settings')} className="text-xs text-amber-400 hover:text-amber-300 font-medium">Edit →</button>
                </div>
                {profile?.routes?.length>0 ? (
                  <div className="space-y-2">
                    {profile.routes.map((r,i)=>(
                      <div key={i} className="flex items-center justify-between p-3 bg-slate-800/60 rounded-xl border border-slate-700/50">
                        <div>
                          <p className="text-white text-sm font-medium">{r.route||'Unnamed'} {r.via?<span className="text-slate-400 font-normal">via {r.via}</span>:''}</p>
                        </div>
                        <span className="text-xs text-slate-400 bg-slate-700 px-2 py-1 rounded-lg">{r.startTime||'—'}</span>
                      </div>
                    ))}
                  </div>
                ):<p className="text-slate-500 text-sm text-center py-4 italic">No routes configured.</p>}
              </div>
            </div>
          )}

          {/* ── LIVE MAP ── */}
          {activeTab==='tracking' && (
            <div className="max-w-4xl mx-auto space-y-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="p-4 flex items-center justify-between border-b border-slate-800">
                  <div>
                    <h2 className="text-white font-semibold text-sm">Live Location Broadcast</h2>
                    <p className="text-slate-500 text-xs mt-0.5">Your passengers can see your location in real-time</p>
                  </div>
                  <button onClick={toggleTrip}
                    className={`px-5 py-2 rounded-xl text-xs font-bold transition-all
                      ${isTripActive?'bg-red-500 text-white hover:bg-red-600':'bg-green-500 text-white hover:bg-green-600'}`}>
                    {isTripActive?'End Tracking':'Start Tracking'}
                  </button>
                </div>
                <div className="h-96 w-full relative">
                  {isTripActive && currentLocation ? (
                    <MapContainer center={[currentLocation.lat,currentLocation.lng]} zoom={14} style={{height:'100%',width:'100%',zIndex:0}}>
                      <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
                      <Marker position={[currentLocation.lat,currentLocation.lng]} icon={vehicleIcon} zIndexOffset={1000}>
                        <Popup>🚐 Broadcasting LIVE</Popup>
                      </Marker>
                      {routePolylines.map((poly,i)=>(
                        <Polyline key={i} positions={poly.points.map(p=>[p.lat,p.lng])} color="#f59e0b" weight={4} opacity={0.7}/>
                      ))}
                      {passengers.map(p=>(
                        <React.Fragment key={p._id}>
                          {p.pickupLocation?.lat&&<Marker position={[p.pickupLocation.lat,p.pickupLocation.lng]} icon={pickupIcon}><Popup>📍 {p.name}: Pickup</Popup></Marker>}
                          {p.dropoffLocation?.lat&&<Marker position={[p.dropoffLocation.lat,p.dropoffLocation.lng]} icon={dropoffIcon}><Popup>🏁 {p.name}: Drop-off</Popup></Marker>}
                        </React.Fragment>
                      ))}
                    </MapContainer>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-500">
                      <Navigation className="w-12 h-12 opacity-20"/>
                      <p className="text-sm">{isTripActive?'Acquiring GPS signal…':'Start tracking to broadcast your location'}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── PASSENGERS ── */}
          {activeTab==='passengers' && (
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white font-semibold">Passengers <span className="ml-2 text-xs bg-amber-400/20 text-amber-400 px-2 py-0.5 rounded-full">{passengers.length}</span></h2>
              </div>
              {loadingPassengers ? (
                <div className="text-slate-500 text-sm text-center py-10">Loading passengers…</div>
              ) : passengers.length===0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center text-slate-500 text-sm italic">
                  No passengers have selected your vehicle yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {passengers.map(passenger=>{
                    const todayAbsence=passenger.absences?.find(a=>a.date===getTodayStr());
                    return(
                      <div key={passenger._id} className={`bg-slate-900 border rounded-2xl p-4 transition-shadow hover:shadow-lg hover:shadow-slate-900 ${todayAbsence?'border-red-500/40':'border-slate-800'}`}>
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-white text-sm font-bold">
                              {passenger.name?.charAt(0)}
                            </div>
                            <div>
                              <p className="text-white font-semibold text-sm">{passenger.name}</p>
                              <p className="text-slate-500 text-xs">{passenger.phoneNumber}</p>
                            </div>
                          </div>
                          {todayAbsence&&<span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-medium">Absent</span>}
                        </div>
                        <p className="text-slate-400 text-xs flex items-center gap-1.5 mb-2"><Mail className="w-3 h-3"/>{passenger.email}</p>
                        {(passenger.pickupLocation||passenger.dropoffLocation)&&(
                          <div className="mt-2 pt-2 border-t border-slate-800 space-y-1">
                            {passenger.pickupLocation&&<p className="text-xs text-slate-400 flex items-start gap-1.5"><MapPin className="w-3 h-3 text-green-400 flex-shrink-0 mt-0.5"/>Pickup: {passenger.pickupLocation?.address||passenger.pickupLocation}</p>}
                            {passenger.dropoffLocation&&<p className="text-xs text-slate-400 flex items-start gap-1.5"><MapPin className="w-3 h-3 text-red-400 flex-shrink-0 mt-0.5"/>Drop-off: {passenger.dropoffLocation?.address||passenger.dropoffLocation}</p>}
                          </div>
                        )}
                        {passenger.absences?.filter(a=>a.date>getTodayStr()).length>0&&(
                          <div className="mt-2 pt-2 border-t border-slate-800">
                            <p className="text-xs text-slate-500 mb-1.5">Upcoming absences</p>
                            <div className="flex flex-wrap gap-1">
                              {passenger.absences.filter(a=>a.date>getTodayStr()).sort((a,b)=>a.date.localeCompare(b.date)).map(a=>(
                                <span key={a.date} className="text-xs bg-orange-400/10 text-orange-400 border border-orange-400/20 px-2 py-0.5 rounded-full">
                                  {new Date(a.date).toLocaleDateString(undefined,{month:'short',day:'numeric'})} {a.period!=='Both'&&`(${a.period})`}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {passenger.extraBookings?.length>0&&(
                          <div className="mt-2 pt-2 border-t border-slate-800">
                            <p className="text-xs text-slate-500 mb-1.5">Extra bookings</p>
                            <div className="space-y-1">
                              {passenger.extraBookings.sort((a,b)=>a.date.localeCompare(b.date)).map((eb,idx)=>(
                                <div key={idx} className="bg-slate-800 rounded-lg p-2 text-xs">
                                  <div className="flex justify-between mb-0.5">
                                    <span className="text-white font-medium">{new Date(eb.date).toLocaleDateString(undefined,{month:'short',day:'numeric'})} · {eb.period}</span>
                                    <span className="text-amber-400 font-bold">{eb.seats} seat{eb.seats>1?'s':''}</span>
                                  </div>
                                  {eb.price&&<p className="text-green-400 font-semibold">Rs. {Math.round(eb.price)} <span className="text-slate-500 font-normal">({eb.distanceKm?.toFixed(1)} km)</span></p>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── PAYMENTS ── */}
          {activeTab==='payments' && (
            <div className="max-w-3xl mx-auto space-y-6">

              {/* Passenger payment approvals */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <h2 className="text-white font-semibold text-sm mb-1">Passenger Payment Approvals</h2>
                <p className="text-slate-500 text-xs mb-5">Review monthly payments submitted by your passengers.</p>
                {allPayments.length===0&&<p className="text-slate-500 text-sm text-center py-6 italic">No payment submissions yet.</p>}
                {allPayments.map(passenger=>passenger.payments?.length>0&&(
                  <div key={passenger.passengerId} className="mb-5">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-full bg-amber-400/20 text-amber-400 text-xs font-bold flex items-center justify-center">{passenger.name?.charAt(0)}</div>
                      <span className="text-white text-sm font-medium">{passenger.name}</span>
                      <span className="text-slate-500 text-xs">{passenger.email}</span>
                    </div>
                    <div className="space-y-2 pl-9">
                      {passenger.payments.map(p=>(
                        <div key={p._id} className="bg-slate-800 rounded-xl p-4 border border-slate-700/50">
                          <div className="flex items-start gap-3">
                            {p.imageUrl&&(
                              <a href={p.imageUrl} target="_blank" rel="noreferrer">
                                <img src={p.imageUrl} alt="receipt" className="w-16 h-16 object-cover rounded-lg border border-slate-700 hover:opacity-80 transition-opacity flex-shrink-0"/>
                              </a>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <p className="text-white font-semibold text-sm">{p.month} · LKR {p.amount?.toLocaleString()}</p>
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1
                                  ${p.status==='approved'?'bg-green-500/15 text-green-400':p.status==='rejected'?'bg-red-500/15 text-red-400':'bg-amber-500/15 text-amber-400'}`}>
                                  {p.status==='approved'?<CheckCircle className="w-3 h-3"/>:p.status==='rejected'?<XCircle className="w-3 h-3"/>:<Clock className="w-3 h-3"/>}
                                  {p.status==='approved'?'Approved':p.status==='rejected'?'Rejected':'Pending'}
                                </span>
                              </div>
                              <p className="text-slate-500 text-xs mt-0.5">Submitted {p.submittedAt?new Date(p.submittedAt).toLocaleDateString():'N/A'}</p>
                              {p.note&&<p className="text-slate-400 text-xs mt-1 italic">Note: {p.note}</p>}
                              {p.status==='pending'&&(
                                <div className="mt-3 space-y-2">
                                  <input type="text" placeholder="Optional note…" value={reviewNotes[p._id]||''} onChange={e=>setReviewNotes(n=>({...n,[p._id]:e.target.value}))}
                                    className="w-full px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400"/>
                                  <div className="flex gap-2">
                                    <button onClick={()=>reviewPayment(passenger.passengerId,p._id,'approved')} className="flex-1 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded-lg transition-colors">✅ Approve</button>
                                    <button onClick={()=>reviewPayment(passenger.passengerId,p._id,'rejected')} className="flex-1 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-bold rounded-lg transition-colors">❌ Reject</button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* System fee payments */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <h2 className="text-white font-semibold text-sm mb-1">System Fee Payment</h2>
                <p className="text-slate-500 text-xs mb-5">Upload your monthly system fee receipt for admin review.</p>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">Payment Month</label>
                      <input type="month" value={sysPayMonth} onChange={e=>setSysPayMonth(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"/>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">Amount (LKR)</label>
                      <input type="number" value={sysPayAmount} onChange={e=>setSysPayAmount(e.target.value)} placeholder="e.g. 5000"
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent placeholder-slate-600"/>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Receipt Photo</label>
                    <label className="flex flex-col items-center justify-center w-full h-28 bg-slate-800 border-2 border-dashed border-slate-700 rounded-xl cursor-pointer hover:border-amber-400/50 transition-colors">
                      {sysPayPreview
                        ?<img src={sysPayPreview} alt="Preview" className="h-full object-cover rounded-xl"/>
                        :<><Upload className="w-6 h-6 text-slate-500 mb-2"/><span className="text-slate-500 text-xs">Click to upload receipt</span></>}
                      <input type="file" accept="image/*" className="hidden" onChange={e=>{const f=e.target.files[0];setSysPayFile(f||null);setSysPayPreview(f?URL.createObjectURL(f):null);}}/>
                    </label>
                  </div>
                  <button onClick={uploadSystemPayment} disabled={sysPayUploading}
                    className="w-full py-3 bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold text-sm rounded-xl transition-colors disabled:opacity-50">
                    {sysPayUploading?'Uploading…':'Submit Payment'}
                  </button>
                </div>

                {systemPayments.length>0&&(
                  <div className="mt-5 pt-5 border-t border-slate-800">
                    <h3 className="text-sm font-medium text-slate-400 mb-3">Submission History</h3>
                    <div className="space-y-2">
                      {systemPayments.map(p=>(
                        <div key={p._id} className="flex items-center gap-3 p-3 bg-slate-800 rounded-xl">
                          {p.imageUrl&&<a href={p.imageUrl} target="_blank" rel="noreferrer"><img src={p.imageUrl} alt="receipt" className="w-12 h-12 object-cover rounded-lg border border-slate-700"/></a>}
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium">{p.month} · LKR {p.amount?.toLocaleString()}</p>
                            <p className="text-slate-500 text-xs">{p.submittedAt?new Date(p.submittedAt).toLocaleDateString():'N/A'}</p>
                            {p.note&&<p className="text-slate-400 text-xs italic mt-0.5">Admin: {p.note}</p>}
                          </div>
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold
                            ${p.status==='approved'?'bg-green-500/15 text-green-400':p.status==='rejected'?'bg-red-500/15 text-red-400':'bg-amber-500/15 text-amber-400'}`}>
                            {p.status==='approved'?'Approved':p.status==='rejected'?'Rejected':'Pending'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── SETTINGS ── */}
          {activeTab==='settings' && (
            <div className="max-w-3xl mx-auto space-y-5">

              {/* Personal info */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <h2 className="text-white font-semibold text-sm mb-4 flex items-center gap-2"><User className="w-4 h-4 text-amber-400"/>Personal Information</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[{icon:User,label:'Name',value:profile?.name},{icon:Phone,label:'Phone',value:profile?.phoneNumber},{icon:Mail,label:'Email',value:profile?.email},{icon:Car,label:'Vehicle',value:`${profile?.vehicleNumber} · ${profile?.vehicleType}`}].map(f=>(
                    <div key={f.label} className="flex items-center gap-3 p-3 bg-slate-800 rounded-xl">
                      <f.icon className="w-4 h-4 text-slate-400 flex-shrink-0"/>
                      <div className="min-w-0">
                        <p className="text-slate-500 text-xs">{f.label}</p>
                        <p className="text-white text-sm font-medium truncate capitalize">{f.value||'—'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Routes */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-white font-semibold text-sm flex items-center gap-2"><Navigation className="w-4 h-4 text-amber-400"/>Route Configuration</h2>
                  {!isEditingRoute&&<button onClick={()=>setIsEditingRoute(true)} className="text-amber-400 text-xs font-semibold hover:text-amber-300">Edit</button>}
                </div>
                {isEditingRoute?(
                  <div className="space-y-4">
                    {routeData.routes.map((r,index)=>(
                      <div key={index} className="bg-slate-800 rounded-xl p-4 border border-slate-700 relative">
                        <button onClick={()=>{const nr=[...routeData.routes];nr.splice(index,1);setRouteData({...routeData,routes:nr});}}
                          className="absolute top-3 right-3 w-6 h-6 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center text-xs hover:bg-red-500/30">×</button>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pr-8">
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">Route</label>
                            <input type="text" value={r.route||''} onChange={e=>{const nr=[...routeData.routes];nr[index].route=e.target.value;setRouteData({...routeData,routes:nr});}}
                              placeholder="e.g. Colombo - Kandy"
                              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent placeholder-slate-500"/>
                          </div>
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">Via</label>
                            <div className="flex gap-2">
                              <input type="text" value={r.via||''} onChange={e=>{const nr=[...routeData.routes];nr[index].via=e.target.value;setRouteData({...routeData,routes:nr});}}
                                placeholder="e.g. Kurunegala"
                                className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent placeholder-slate-500"/>
                              <button onClick={()=>handleFindAlternatives(index)} className="px-3 bg-amber-400 text-slate-900 font-bold rounded-lg text-xs hover:bg-amber-300 transition-colors whitespace-nowrap">Find</button>
                            </div>
                          </div>
                          {r.alternatives?.length>0&&(
                            <div className="sm:col-span-2">
                              <label className="block text-xs text-slate-400 mb-1">Select Path</label>
                              <select value={r.selectedAlternativeIndex||0} onChange={e=>{const nr=[...routeData.routes];const idx=parseInt(e.target.value);nr[index].selectedAlternativeIndex=idx;nr[index].polylineOverride=nr[index].alternatives[idx].polyline;setRouteData({...routeData,routes:nr});}}
                                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
                                {r.alternatives.map((alt,i)=><option key={i} value={i}>Path {i+1} — {(alt.distance/1000).toFixed(1)} km, {Math.round(alt.duration/60)} min {i===0?'(Fastest)':''}</option>)}
                              </select>
                            </div>
                          )}
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">Start Time</label>
                            <input type="text" value={r.startTime||''} onChange={e=>{const nr=[...routeData.routes];nr[index].startTime=e.target.value;setRouteData({...routeData,routes:nr});}}
                              placeholder="e.g. 08:00 AM"
                              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent placeholder-slate-500"/>
                          </div>
                        </div>
                      </div>
                    ))}
                    <button onClick={()=>setRouteData({...routeData,routes:[...routeData.routes,{route:'',via:'',startTime:''}]})}
                      className="w-full py-3 bg-slate-800 border-2 border-dashed border-slate-700 rounded-xl text-slate-400 text-sm font-medium hover:border-amber-400/50 hover:text-amber-400 transition-colors">
                      + Add Route
                    </button>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Total Seats</label>
                        <input type="number" value={routeData.totalSeats} onChange={e=>setRouteData({...routeData,totalSeats:e.target.value})}
                          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"/>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Price per Km (Rs.)</label>
                        <input type="number" value={routeData.pricePerKm} onChange={e=>setRouteData({...routeData,pricePerKm:e.target.value})}
                          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"/>
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button onClick={()=>setIsEditingRoute(false)} className="px-4 py-2 bg-slate-700 text-slate-300 text-sm rounded-xl hover:bg-slate-600 transition-colors">Cancel</button>
                      <button onClick={handleSaveRoute} className="px-4 py-2 bg-amber-400 text-slate-900 text-sm font-bold rounded-xl hover:bg-amber-300 transition-colors">Save Routes</button>
                    </div>
                  </div>
                ):(
                  <div className="space-y-2">
                    {profile?.routes?.length>0?profile.routes.map((r,i)=>(
                      <div key={i} className="flex items-center justify-between p-3 bg-slate-800 rounded-xl">
                        <div>
                          <p className="text-white text-sm font-medium">{r.route||'Unnamed'} {r.via&&<span className="text-slate-400 font-normal">via {r.via}</span>}</p>
                        </div>
                        <span className="text-xs text-slate-400 bg-slate-700 px-2 py-1 rounded-lg">{r.startTime||'—'}</span>
                      </div>
                    )):<p className="text-slate-500 text-sm italic">No routes set.</p>}
                    <div className="flex gap-3 mt-3">
                      <div className="flex-1 p-3 bg-slate-800 rounded-xl"><p className="text-xs text-slate-500">Seats</p><p className="text-white font-bold">{profile?.totalSeats||'—'}</p></div>
                      <div className="flex-1 p-3 bg-slate-800 rounded-xl"><p className="text-xs text-slate-500">Price/km</p><p className="text-white font-bold">{profile?.pricePerKm?`Rs. ${profile.pricePerKm}`:'—'}</p></div>
                    </div>
                  </div>
                )}
              </div>

              {/* Bank details */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-white font-semibold text-sm flex items-center gap-2"><CreditCard className="w-4 h-4 text-amber-400"/>Bank Details</h2>
                  {!isEditingBank&&<button onClick={()=>setIsEditingBank(true)} className="text-amber-400 text-xs font-semibold hover:text-amber-300">Edit</button>}
                </div>
                {isEditingBank?(
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[{key:'bankName',label:'Bank Name',ph:'e.g. Commercial Bank'},{key:'accountName',label:'Account Name',ph:'e.g. John Doe'},{key:'accountNumber',label:'Account Number',ph:'e.g. 1234567890'},{key:'branchName',label:'Branch',ph:'e.g. Colombo 03'}].map(f=>(
                        <div key={f.key}>
                          <label className="block text-xs text-slate-400 mb-1">{f.label}</label>
                          <input type="text" value={bankDetails[f.key]} onChange={e=>setBankDetails({...bankDetails,[f.key]:e.target.value})} placeholder={f.ph}
                            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder-slate-500"/>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button onClick={()=>{setIsEditingBank(false);setBankDetails({bankName:profile.bankDetails?.bankName||'',accountName:profile.bankDetails?.accountName||'',accountNumber:profile.bankDetails?.accountNumber||'',branchName:profile.bankDetails?.branchName||''}); }}
                        className="px-4 py-2 bg-slate-700 text-slate-300 text-sm rounded-xl hover:bg-slate-600 transition-colors">Cancel</button>
                      <button onClick={handleSaveBankDetails} className="px-4 py-2 bg-amber-400 text-slate-900 text-sm font-bold rounded-xl hover:bg-amber-300 transition-colors">Save</button>
                    </div>
                  </div>
                ):(
                  profile?.bankDetails?.accountNumber?(
                    <div className="flex items-center gap-4 p-4 bg-slate-800 rounded-xl">
                      <div className="w-10 h-10 bg-amber-400/15 rounded-xl flex items-center justify-center flex-shrink-0">
                        <CreditCard className="w-5 h-5 text-amber-400"/>
                      </div>
                      <div>
                        <p className="text-white font-bold text-sm">{profile.bankDetails.bankName||'Bank'}</p>
                        <p className="text-slate-300 font-mono text-sm mt-0.5">{profile.bankDetails.accountNumber}</p>
                        <p className="text-slate-500 text-xs mt-0.5">{profile.bankDetails.accountName} · {profile.bankDetails.branchName}</p>
                      </div>
                    </div>
                  ):<p className="text-slate-500 text-sm italic">No bank details added yet.</p>
                )}
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}