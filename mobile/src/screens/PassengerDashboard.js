import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Alert,
  ScrollView, Image, ActivityIndicator, Platform, Dimensions,
  StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import axios from 'axios';
import { MaterialIcons, FontAwesome5, Ionicons } from '@expo/vector-icons';
import { io } from 'socket.io-client';
import MapView, { Marker, UrlTile, Polyline } from 'react-native-maps';
import { geocodeAddress, fetchRouteAlternatives, reverseGeocode } from '../services/mapServices';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';

const { width: SW } = Dimensions.get('window');

// ─── Design tokens ───────────────────────────────────────────────
const C = {
  bg:        '#0a0f1a',   // deepest bg
  surface:   '#111827',   // cards
  surface2:  '#1f2937',   // inputs / inner cards
  border:    '#1f2937',
  border2:   '#374151',
  amber:     '#f59e0b',
  amberDim:  'rgba(245,158,11,0.15)',
  green:     '#10b981',
  greenDim:  'rgba(16,185,129,0.15)',
  red:       '#ef4444',
  redDim:    'rgba(239,68,68,0.15)',
  blue:      '#3b82f6',
  blueDim:   'rgba(59,130,246,0.15)',
  orange:    '#f97316',
  orangeDim: 'rgba(249,115,22,0.15)',
  text:      '#f9fafb',
  textSub:   '#9ca3af',
  textMuted: '#6b7280',
  white:     '#ffffff',
};

// ─── Bottom tab config ────────────────────────────────────────────
const TABS = [
  { id: 'overview',  label: 'Overview',  icon: 'grid-outline' },
  { id: 'tracking',  label: 'Live Map',  icon: 'navigate-outline' },
  { id: 'absences',  label: 'Absences',  icon: 'calendar-outline' },
  { id: 'bookings',  label: 'Extra',     icon: 'people-outline' },
  { id: 'payments',  label: 'Payments',  icon: 'card-outline' },
  { id: 'settings',  label: 'Locations', icon: 'location-outline' },
];

// ─── Reusable primitives ──────────────────────────────────────────
const Card = ({ children, style }) => (
  <View style={[s.card, style]}>{children}</View>
);

const SectionTitle = ({ children, color = C.amber }) => (
  <Text style={[s.sectionTitle, { color }]}>{children}</Text>
);

const Pill = ({ label, active, color = C.amber, onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    style={[s.pill, active && { backgroundColor: color + '25', borderColor: color }]}
  >
    <Text style={[s.pillText, active && { color }]}>{label}</Text>
  </TouchableOpacity>
);

const PrimaryBtn = ({ label, onPress, disabled, color = C.amber, icon, loading }) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled}
    style={[s.primaryBtn, { backgroundColor: color, opacity: disabled ? 0.5 : 1 }]}
  >
    {loading
      ? <ActivityIndicator color={C.bg} size="small" />
      : <>
          {icon && <MaterialIcons name={icon} size={18} color={C.bg} style={{ marginRight: 8 }} />}
          <Text style={s.primaryBtnText}>{label}</Text>
        </>
    }
  </TouchableOpacity>
);

const GhostBtn = ({ label, onPress }) => (
  <TouchableOpacity onPress={onPress} style={s.ghostBtn}>
    <Text style={s.ghostBtnText}>{label}</Text>
  </TouchableOpacity>
);

const StyledInput = ({ label, ...props }) => (
  <View style={{ marginBottom: 14 }}>
    {label && <Text style={s.inputLabel}>{label}</Text>}
    <TextInput
      style={s.input}
      placeholderTextColor={C.textMuted}
      {...props}
    />
  </View>
);

const StatusBadge = ({ status }) => {
  const map = {
    approved: { bg: C.greenDim,  text: C.green,  label: '✓ Approved' },
    rejected: { bg: C.redDim,    text: C.red,    label: '✕ Rejected' },
    pending:  { bg: C.amberDim,  text: C.amber,  label: '⏳ Pending'  },
  };
  const t = map[status] || map.pending;
  return (
    <View style={[s.statusBadge, { backgroundColor: t.bg }]}>
      <Text style={[s.statusBadgeText, { color: t.text }]}>{t.label}</Text>
    </View>
  );
};

// ─── Main component ───────────────────────────────────────────────
export default function PassengerDashboard({ route, navigation }) {
  const { user, token } = route.params || {};

  const [activeTab,        setActiveTab]        = useState('overview');
  const [driverProfile,    setDriverProfile]    = useState(null);
  const [currentUser,      setCurrentUser]      = useState(user);
  const [driverLocation,   setDriverLocation]   = useState(null);
  const [isDriverActive,   setIsDriverActive]   = useState(false);
  const socketRef = useRef(null);

  // Locations
  const [isEditingLocations, setIsEditingLocations] = useState(false);
  const [locationData, setLocationData] = useState({
    pickupLocation:  user?.pickupLocation?.address  || user?.pickupLocation  || '',
    dropoffLocation: user?.dropoffLocation?.address || user?.dropoffLocation || '',
  });
  const [mapPickingMode, setMapPickingMode] = useState(null);

  // Absences
  const [absences,          setAbsences]          = useState(user?.absences || []);
  const [selectedDateType,  setSelectedDateType]  = useState('Today');
  const [specificDate,      setSpecificDate]      = useState('');
  const [newAbsencePeriod,  setNewAbsencePeriod]  = useState('Both');

  // Extra bookings
  const [extraBookings,      setExtraBookings]      = useState(user?.extraBookings || []);
  const [bookingDateType,    setBookingDateType]    = useState('Today');
  const [bookingSpecificDate,setBookingSpecificDate]= useState('');
  const [bookingPeriod,      setBookingPeriod]      = useState('Morning');
  const [bookSeats,          setBookSeats]          = useState('1');
  const [availableSeatsCheck,setAvailableSeatsCheck]= useState(null);
  const [extraPickup,        setExtraPickup]        = useState('');
  const [extraDropoff,       setExtraDropoff]       = useState('');
  const [extraDistance,      setExtraDistance]      = useState(null);
  const [extraPrice,         setExtraPrice]         = useState(null);
  const [calculatingPrice,   setCalculatingPrice]   = useState(false);

  // Payments
  const [payments,         setPayments]         = useState([]);
  const [paymentMonth,     setPaymentMonth]     = useState(() => new Date().toISOString().slice(0,7));
  const [paymentAmount,    setPaymentAmount]    = useState('');
  const [paymentImage,     setPaymentImage]     = useState(null);
  const [paymentUploading, setPaymentUploading] = useState(false);

  // ── init ──────────────────────────────────────────────────────
  useEffect(() => { fetchDriverDetails(); fetchPayments(); }, []);

  useEffect(() => {
    if (driverProfile?.isTripActive) {
      setIsDriverActive(true);
      if (driverProfile.currentLocation) setDriverLocation(driverProfile.currentLocation);
      socketRef.current = io(process.env.EXPO_PUBLIC_API_URL.replace('/api',''), { transports:['websocket'] });
      socketRef.current.on(`live_location_${driverProfile.uid}`, loc => { setIsDriverActive(true); setDriverLocation(loc); });
      socketRef.current.on(`trip_status_update_${driverProfile.uid}`, d => { setIsDriverActive(d.isTripActive); fetchDriverDetails(); });
    } else {
      setIsDriverActive(false); setDriverLocation(null);
    }
    return () => { socketRef.current?.disconnect(); socketRef.current = null; };
  }, [driverProfile]);

  const fetchDriverDetails = async () => {
    try {
      const r = await axios.get(`${process.env.EXPO_PUBLIC_API_URL}/auth/my-driver`, { headers:{Authorization:`Bearer ${token}`} });
      setDriverProfile(r.data);
    } catch {}
  };

  const fetchPayments = async () => {
    try {
      const r = await axios.get(`${process.env.EXPO_PUBLIC_API_URL.replace('/api','')}/api/payments/my-payments`, { headers:{Authorization:`Bearer ${token}`} });
      setPayments(r.data || []);
    } catch {}
  };

  // ── helpers ───────────────────────────────────────────────────
  const getDateStr = (offset=0) => {
    const d = new Date(); d.setDate(d.getDate()+offset);
    return (new Date(d - d.getTimezoneOffset()*60000)).toISOString().split('T')[0];
  };

  const handleLogout = () => navigation.replace('Login');

  // ── locations ─────────────────────────────────────────────────
  const handleUseCurrentLocation = async type => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission Denied', 'Location permission required.'); return; }
    try {
      const loc = await Location.getCurrentPositionAsync({});
      const addr = await reverseGeocode(loc.coords.latitude, loc.coords.longitude);
      if (addr) setLocationData(p => ({ ...p, [type+'Location']: addr }));
      else Alert.alert('Error', 'Could not determine address.');
    } catch { Alert.alert('Error', 'Failed to get location.'); }
  };

  const handleMapPress = async e => {
    if (!mapPickingMode) return;
    const { latitude, longitude } = e.nativeEvent.coordinate;
    const addr = await reverseGeocode(latitude, longitude);
    if (addr) { setLocationData(p => ({ ...p, [mapPickingMode+'Location']: addr })); setMapPickingMode(null); }
  };

  const handleSaveLocations = async () => {
    try {
      const [pg, dg] = await Promise.all([geocodeAddress(locationData.pickupLocation), geocodeAddress(locationData.dropoffLocation)]);
      const pp = pg ? { address:locationData.pickupLocation, lat:pg.lat, lng:pg.lng } : locationData.pickupLocation;
      const dp = dg ? { address:locationData.dropoffLocation, lat:dg.lat, lng:dg.lng } : locationData.dropoffLocation;
      const r = await axios.put(`${process.env.EXPO_PUBLIC_API_URL}/auth/update-locations`, { pickupLocation:pp, dropoffLocation:dp }, { headers:{Authorization:`Bearer ${token}`} });
      setCurrentUser(r.data); setIsEditingLocations(false);
    } catch { Alert.alert('Error', 'Failed to update locations.'); }
  };

  // ── absences ──────────────────────────────────────────────────
  const addAbsence = async (dateStr, periodStr) => {
    let newAbs = absences.filter(a=>a.date!==dateStr);
    newAbs.push({ date:dateStr, period:periodStr });
    newAbs.sort((a,b)=>a.date.localeCompare(b.date));
    try {
      const r = await axios.put(`${process.env.EXPO_PUBLIC_API_URL}/auth/update-absences`, { absences:newAbs }, { headers:{Authorization:`Bearer ${token}`} });
      setCurrentUser(r.data); setAbsences(r.data.absences||[]);
    } catch { Alert.alert('Error','Failed to update absences.'); }
  };

  const removeAbsence = async dateStr => {
    const newAbs = absences.filter(a=>a.date!==dateStr);
    try {
      const r = await axios.put(`${process.env.EXPO_PUBLIC_API_URL}/auth/update-absences`, { absences:newAbs }, { headers:{Authorization:`Bearer ${token}`} });
      setCurrentUser(r.data); setAbsences(r.data.absences||[]);
    } catch { Alert.alert('Error','Failed to remove absence.'); }
  };

  const handleSubmitAbsence = () => {
    let dateStr = selectedDateType==='Today' ? getDateStr(0) : selectedDateType==='Tomorrow' ? getDateStr(1) : specificDate;
    if (!dateStr) { Alert.alert('Missing Date','Please enter a date.'); return; }
    addAbsence(dateStr, newAbsencePeriod); setSpecificDate('');
  };

  // ── extra bookings ────────────────────────────────────────────
  const checkAvailability = async () => {
    let dateStr = bookingDateType==='Today' ? getDateStr(0) : bookingDateType==='Tomorrow' ? getDateStr(1) : bookingSpecificDate;
    if (!dateStr) { Alert.alert('Missing Date','Please select a date.'); return; }
    try {
      const { data } = await axios.get(`${process.env.EXPO_PUBLIC_API_URL}/auth/ride-availability?date=${dateStr}&period=${bookingPeriod}`, { headers:{Authorization:`Bearer ${token}`} });
      setAvailableSeatsCheck({ ...data, dateStr, period:bookingPeriod });
    } catch { Alert.alert('Error','Could not check availability.'); }
  };

  const calculateExtraPrice = async () => {
    if (!extraPickup||!extraDropoff) { Alert.alert('Missing Info','Enter both pickup and drop-off.'); return; }
    setCalculatingPrice(true);
    try {
      const [sg,eg] = await Promise.all([geocodeAddress(extraPickup), geocodeAddress(extraDropoff)]);
      if (sg&&eg) {
        const alts = await fetchRouteAlternatives(sg,eg);
        if (alts?.length) { const km=alts[0].distance/1000; setExtraDistance(km); setExtraPrice(km*(availableSeatsCheck?.pricePerKm||0)); }
        else Alert.alert('Error','Could not calculate distance.');
      } else Alert.alert('Error','Could not find locations.');
    } catch { Alert.alert('Error','Error calculating price.'); }
    finally { setCalculatingPrice(false); }
  };

  const confirmExtraBooking = async () => {
    if (!availableSeatsCheck) return;
    const seats = parseInt(bookSeats,10);
    if (isNaN(seats)||seats<1||seats>availableSeatsCheck.availableSeats) { Alert.alert('Error','Invalid seat count.'); return; }
    if (!extraPickup||!extraDropoff||extraPrice===null) { Alert.alert('Missing Info','Enter locations and calculate price first.'); return; }
    try {
      const nb = [...extraBookings, { date:availableSeatsCheck.dateStr, period:availableSeatsCheck.period, seats, pickupLocation:{address:extraPickup}, dropoffLocation:{address:extraDropoff}, distanceKm:extraDistance, price:extraPrice }];
      const { data } = await axios.put(`${process.env.EXPO_PUBLIC_API_URL}/auth/update-extra-bookings`, { extraBookings:nb }, { headers:{Authorization:`Bearer ${token}`} });
      setExtraBookings(data.extraBookings||[]); setAvailableSeatsCheck(null); setBookSeats('1'); setExtraPickup(''); setExtraDropoff(''); setExtraPrice(null); setExtraDistance(null);
      Alert.alert('Success','Extra seats booked!');
    } catch { Alert.alert('Error','Could not complete booking.'); }
  };

  const cancelExtraBooking = async index => {
    try {
      const nb = [...extraBookings]; nb.splice(index,1);
      const { data } = await axios.put(`${process.env.EXPO_PUBLIC_API_URL}/auth/update-extra-bookings`, { extraBookings:nb }, { headers:{Authorization:`Bearer ${token}`} });
      setExtraBookings(data.extraBookings||[]);
    } catch {}
  };

  // ── payments ──────────────────────────────────────────────────
  const pickReceiptImage = async () => {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) { Alert.alert('Permission needed','Please allow media access.'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes:ImagePicker.MediaType.Images, quality:0.8, allowsEditing:true });
    if (!res.canceled && res.assets[0]) {
      const a = res.assets[0];
      setPaymentImage({ uri:a.uri, type:a.mimeType||'image/jpeg', name:a.fileName||'receipt.jpg' });
    }
  };

  const uploadPayment = async () => {
    if (!paymentImage||!paymentAmount||!paymentMonth) { Alert.alert('Missing fields','Fill all fields and pick a receipt.'); return; }
    setPaymentUploading(true);
    try {
      const fd = new FormData();
      fd.append('month',paymentMonth); fd.append('amount',paymentAmount);
      fd.append('receipt', { uri:paymentImage.uri, type:paymentImage.type, name:paymentImage.name });
      const r = await axios.post(`${process.env.EXPO_PUBLIC_API_URL.replace('/api','')}/api/payments/upload`, fd, { headers:{Authorization:`Bearer ${token}`,'Content-Type':'multipart/form-data'} });
      setPayments(r.data.payments?[...r.data.payments].sort((a,b)=>b.month.localeCompare(a.month)):[]);
      setPaymentImage(null); setPaymentAmount('');
      Alert.alert('Success','Payment receipt submitted!');
    } catch { Alert.alert('Error','Failed to upload payment.'); }
    finally { setPaymentUploading(false); }
  };

  const pendingPay = payments.filter(p=>p.status==='pending').length;
  const upcomingAbs = absences.filter(a=>a.date>=getDateStr(0)).length;

  // ── TAB SCREENS ───────────────────────────────────────────────
  const renderOverview = () => (
    <ScrollView contentContainerStyle={s.tabContent} showsVerticalScrollIndicator={false}>
      {/* Stat row */}
      <View style={s.statRow}>
        {[
          { label:'Vehicle',   value:currentUser?.chosenVehicleNumber||'—', icon:'directions-car', color:C.amber },
          { label:'Absences',  value:upcomingAbs,  icon:'event-busy',  color:C.orange },
          { label:'Bookings',  value:extraBookings.length, icon:'group', color:C.blue },
          { label:'Pending',   value:pendingPay, icon:'schedule', color:C.red },
        ].map(c => (
          <View key={c.label} style={s.statCard}>
            <View style={[s.statIcon, { backgroundColor: c.color+'22' }]}>
              <MaterialIcons name={c.icon} size={18} color={c.color} />
            </View>
            <Text style={s.statValue}>{c.value}</Text>
            <Text style={s.statLabel}>{c.label}</Text>
          </View>
        ))}
      </View>

      {/* Driver card */}
      <Card>
        <SectionTitle>My Driver</SectionTitle>
        {driverProfile ? (
          <>
            <View style={s.driverRow}>
              <View style={s.avatar}>
                <Text style={s.avatarText}>{driverProfile.name?.charAt(0)}</Text>
              </View>
              <View style={{ flex:1 }}>
                <Text style={s.driverName}>{driverProfile.name}</Text>
                <Text style={s.driverSub}>{driverProfile.phoneNumber}</Text>
                <Text style={s.driverSub}>{driverProfile.vehicleType?.toUpperCase()}</Text>
              </View>
              <View style={[s.liveChip, { backgroundColor: isDriverActive ? C.greenDim : C.surface2 }]}>
                <View style={[s.liveDot, { backgroundColor: isDriverActive ? C.green : C.textMuted }]} />
                <Text style={[s.liveChipText, { color: isDriverActive ? C.green : C.textMuted }]}>
                  {isDriverActive ? 'LIVE' : 'OFFLINE'}
                </Text>
              </View>
            </View>

            {driverProfile.routes?.length > 0 && (
              <View style={{ marginTop:12 }}>
                {driverProfile.routes.map((r,i) => (
                  <View key={i} style={s.routeChip}>
                    <MaterialIcons name="route" size={14} color={C.amber} />
                    <Text style={s.routeChipText}>{r.route || '—'}</Text>
                    <Text style={s.routeTime}>{r.startTime || '—'}</Text>
                  </View>
                ))}
              </View>
            )}

            {driverProfile.bankDetails?.accountNumber && (
              <View style={[s.bankCard, { marginTop:12 }]}>
                <MaterialIcons name="account-balance" size={16} color={C.amber} />
                <View style={{ marginLeft:10, flex:1 }}>
                  <Text style={s.bankName}>{driverProfile.bankDetails.bankName}</Text>
                  <Text style={s.bankAccNum}>{driverProfile.bankDetails.accountNumber}</Text>
                  <Text style={s.bankSub}>{driverProfile.bankDetails.accountName} · {driverProfile.bankDetails.branchName}</Text>
                </View>
              </View>
            )}
          </>
        ) : (
          <Text style={s.emptyText}>No driver assigned.</Text>
        )}
      </Card>

      {/* Today absence alert */}
      {absences.find(a=>a.date===getDateStr(0)) && (
        <TouchableOpacity onPress={()=>setActiveTab('absences')} style={s.alertBanner}>
          <MaterialIcons name="event-busy" size={18} color={C.orange} />
          <Text style={s.alertBannerText}>You are absent today — {absences.find(a=>a.date===getDateStr(0))?.period}</Text>
          <MaterialIcons name="chevron-right" size={16} color={C.orange} />
        </TouchableOpacity>
      )}
    </ScrollView>
  );

  const renderTracking = () => (
    <View style={{ flex:1 }}>
      <View style={s.trackingHeader}>
        <View>
          <Text style={s.trackingTitle}>Driver's Live Location</Text>
          <Text style={s.trackingSub}>{isDriverActive ? 'Tracking in real-time' : driverProfile ? 'Driver has not started the trip' : 'No driver assigned'}</Text>
        </View>
        {isDriverActive && (
          <View style={s.liveChip}>
            <View style={[s.liveDot, { backgroundColor:C.green }]} />
            <Text style={[s.liveChipText, { color:C.green }]}>LIVE</Text>
          </View>
        )}
      </View>

      {isDriverActive && driverLocation ? (
        <MapView
          style={{ flex:1 }}
          region={{ latitude:driverLocation.lat, longitude:driverLocation.lng, latitudeDelta:0.01, longitudeDelta:0.01 }}
          mapType={Platform.OS==='android'?'none':'standard'}
        >
          {Platform.OS==='android' && <UrlTile urlTemplate="https://a.tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} flipY={false}/>}
          <Marker coordinate={{ latitude:driverLocation.lat, longitude:driverLocation.lng }} zIndex={1000}>
            <View style={s.vehicleMarker}><FontAwesome5 name="bus" size={16} color="white"/></View>
          </Marker>
          {currentUser?.pickupLocation?.lat && (
            <Marker coordinate={{ latitude:currentUser.pickupLocation.lat, longitude:currentUser.pickupLocation.lng }} title="Your Pickup">
              <View style={[s.pinMarker, { backgroundColor:C.green }]}><MaterialIcons name="person-pin-circle" size={18} color="white"/></View>
            </Marker>
          )}
          {currentUser?.dropoffLocation?.lat && (
            <Marker coordinate={{ latitude:currentUser.dropoffLocation.lat, longitude:currentUser.dropoffLocation.lng }} title="Your Drop-off">
              <View style={[s.pinMarker, { backgroundColor:C.red }]}><MaterialIcons name="location-on" size={18} color="white"/></View>
            </Marker>
          )}
          {driverProfile?.routes?.map((r,i) => r.polyline && (
            <Polyline key={i} coordinates={JSON.parse(r.polyline)} strokeColor={C.amber} strokeWidth={4}/>
          ))}
        </MapView>
      ) : (
        <View style={s.mapPlaceholder}>
          <MaterialIcons name="navigation" size={48} color={C.textMuted} />
          <Text style={s.mapPlaceholderText}>{isDriverActive ? 'Connecting to GPS…' : 'Waiting for driver to start'}</Text>
        </View>
      )}
    </View>
  );

  const renderAbsences = () => (
    <ScrollView contentContainerStyle={s.tabContent} showsVerticalScrollIndicator={false}>
      <Card>
        <SectionTitle>Report Absence</SectionTitle>
        <Text style={s.cardDesc}>Let your driver know when you won't be travelling.</Text>

        <Text style={s.stepLabel}>1. DATE</Text>
        <View style={s.pillRow}>
          {['Today','Tomorrow','Specific'].map(t => (
            <Pill key={t} label={t} active={selectedDateType===t} onPress={()=>setSelectedDateType(t)}/>
          ))}
        </View>
        {selectedDateType==='Specific' && (
          <StyledInput placeholder="YYYY-MM-DD" value={specificDate} onChangeText={setSpecificDate} keyboardType="numbers-and-punctuation"/>
        )}

        <View style={s.divider}/>

        <Text style={s.stepLabel}>2. PERIOD</Text>
        <View style={s.pillRow}>
          {['Morning','Evening','Both'].map(p => (
            <Pill key={p} label={p==='Both'?'Full Day':p} active={newAbsencePeriod===p} color={C.orange} onPress={()=>setNewAbsencePeriod(p)}/>
          ))}
        </View>

        <PrimaryBtn label="Submit Absence" onPress={handleSubmitAbsence} icon="event-busy"/>
      </Card>

      {absences.length > 0 && (
        <Card>
          <SectionTitle>Recorded Absences</SectionTitle>
          {absences.map(a => (
            <View key={a.date} style={s.listRow}>
              <View>
                <Text style={s.listRowTitle}>{new Date(a.date).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric',year:'numeric'})}</Text>
                <Text style={[s.listRowSub, { color:C.orange }]}>{a.period} {a.period!=='Both'?'Route':'Routes'}</Text>
              </View>
              <TouchableOpacity onPress={()=>removeAbsence(a.date)} style={s.removeBtn}>
                <MaterialIcons name="close" size={16} color={C.red}/>
              </TouchableOpacity>
            </View>
          ))}
        </Card>
      )}
    </ScrollView>
  );

  const renderBookings = () => (
    <ScrollView contentContainerStyle={s.tabContent} showsVerticalScrollIndicator={false}>
      <Card>
        <SectionTitle color={C.green}>Book Extra Seats</SectionTitle>
        <Text style={s.cardDesc}>Reserve seats for friends on your vehicle.</Text>

        <Text style={s.stepLabel}>1. DATE</Text>
        <View style={s.pillRow}>
          {['Today','Tomorrow','Specific'].map(t => (
            <Pill key={t} label={t} active={bookingDateType===t} onPress={()=>{setBookingDateType(t);setAvailableSeatsCheck(null);}}/>
          ))}
        </View>
        {bookingDateType==='Specific' && (
          <StyledInput placeholder="YYYY-MM-DD" value={bookingSpecificDate} onChangeText={t=>{setBookingSpecificDate(t);setAvailableSeatsCheck(null);}} keyboardType="numbers-and-punctuation"/>
        )}

        <View style={s.divider}/>

        <Text style={s.stepLabel}>2. PERIOD</Text>
        <View style={s.pillRow}>
          {['Morning','Evening'].map(p => (
            <Pill key={p} label={`${p} Route`} active={bookingPeriod===p} color={C.green} onPress={()=>{setBookingPeriod(p);setAvailableSeatsCheck(null);}}/>
          ))}
        </View>

        {!availableSeatsCheck ? (
          <PrimaryBtn label="Check Availability" onPress={checkAvailability} color={C.surface2} icon="search"/>
        ) : availableSeatsCheck.availableSeats > 0 ? (
          <View style={[s.availBox]}>
            <View style={s.availHeader}>
              <MaterialIcons name="check-circle" size={20} color={C.green}/>
              <Text style={s.availTitle}>{availableSeatsCheck.availableSeats} seats available!</Text>
            </View>

            <View style={s.seatCountRow}>
              <Text style={s.inputLabel}>Seats needed</Text>
              <TextInput style={s.seatInput} keyboardType="numeric" value={bookSeats} onChangeText={setBookSeats}/>
            </View>

            <StyledInput label="Pickup Location" placeholder="e.g. Dematagoda Station" value={extraPickup} onChangeText={t=>{setExtraPickup(t);setExtraPrice(null);}}/>
            <StyledInput label="Drop-off Location" placeholder="e.g. Kandy Town" value={extraDropoff} onChangeText={t=>{setExtraDropoff(t);setExtraPrice(null);}}/>

            {extraPrice === null ? (
              <PrimaryBtn label={calculatingPrice?'Calculating…':'Calculate Price'} onPress={calculateExtraPrice} disabled={calculatingPrice} color={C.blue} loading={calculatingPrice}/>
            ) : (
              <>
                <View style={s.priceRow}>
                  <View><Text style={s.priceLabel}>Distance</Text><Text style={s.priceValue}>{extraDistance.toFixed(1)} km</Text></View>
                  <View style={{alignItems:'flex-end'}}>
                    <Text style={s.priceLabel}>Total @ Rs.{availableSeatsCheck.pricePerKm}/km</Text>
                    <Text style={[s.priceValue, { color:C.green, fontSize:22 }]}>Rs. {Math.round(extraPrice)}</Text>
                  </View>
                </View>
                <PrimaryBtn label={`Confirm ${bookSeats} Seat${bookSeats>1?'s':''}`} onPress={confirmExtraBooking} color={C.green}/>
              </>
            )}
          </View>
        ) : (
          <View style={s.unavailBox}>
            <MaterialIcons name="cancel" size={20} color={C.red}/>
            <Text style={s.unavailText}>No seats available for this ride.</Text>
          </View>
        )}
      </Card>

      {extraBookings.length > 0 && (
        <Card>
          <SectionTitle color={C.green}>My Bookings</SectionTitle>
          {extraBookings.slice().sort((a,b)=>a.date.localeCompare(b.date)).map((b,i) => (
            <View key={i} style={s.listRow}>
              <View style={{ flex:1 }}>
                <View style={s.bookingBadgeRow}>
                  <Text style={s.listRowTitle}>{new Date(b.date).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}</Text>
                  <View style={[s.miniChip, { backgroundColor:C.greenDim }]}><Text style={[s.miniChipText, { color:C.green }]}>{b.seats} seat{b.seats>1?'s':''}</Text></View>
                  <View style={[s.miniChip, { backgroundColor:C.surface2 }]}><Text style={[s.miniChipText, { color:C.textSub }]}>{b.period}</Text></View>
                </View>
                {b.pickupLocation && (
                  <View style={s.locationLine}>
                    <Text style={s.locationLineText}>From: {b.pickupLocation.address}</Text>
                    <Text style={s.locationLineText}>To: {b.dropoffLocation?.address}</Text>
                    {b.price && <Text style={[s.locationLineText, { color:C.green, fontWeight:'700' }]}>Rs. {Math.round(b.price)}</Text>}
                  </View>
                )}
              </View>
              <TouchableOpacity onPress={()=>cancelExtraBooking(i)} style={s.removeBtn}>
                <MaterialIcons name="close" size={16} color={C.red}/>
              </TouchableOpacity>
            </View>
          ))}
        </Card>
      )}
    </ScrollView>
  );

  const renderPayments = () => (
    <ScrollView contentContainerStyle={s.tabContent} showsVerticalScrollIndicator={false}>
      <Card>
        <SectionTitle>Submit Payment</SectionTitle>
        <Text style={s.cardDesc}>Upload your monthly receipt — driver will verify it.</Text>

        <View style={s.twoCol}>
          <View style={{ flex:1, marginRight:6 }}>
            <StyledInput label="Month (YYYY-MM)" placeholder="2026-03" value={paymentMonth} onChangeText={setPaymentMonth}/>
          </View>
          <View style={{ flex:1, marginLeft:6 }}>
            <StyledInput label="Amount (LKR)" placeholder="3500" value={paymentAmount} onChangeText={setPaymentAmount} keyboardType="numeric"/>
          </View>
        </View>

        <TouchableOpacity onPress={pickReceiptImage} style={s.receiptPicker}>
          {paymentImage
            ? <Image source={{ uri:paymentImage.uri }} style={s.receiptPreview}/>
            : <>
                <MaterialIcons name="cloud-upload" size={28} color={C.textMuted}/>
                <Text style={s.receiptPickerText}>Tap to pick receipt</Text>
              </>
          }
        </TouchableOpacity>

        <PrimaryBtn label="Submit Receipt" onPress={uploadPayment} disabled={paymentUploading} loading={paymentUploading}/>
      </Card>

      {payments.length > 0 && (
        <Card>
          <SectionTitle>Payment History</SectionTitle>
          {payments.map((p,i) => (
            <View key={i} style={[s.listRow, { alignItems:'flex-start' }]}>
              {p.imageUrl && <Image source={{ uri:p.imageUrl }} style={s.paymentThumb}/>}
              <View style={{ flex:1, marginLeft: p.imageUrl ? 12 : 0 }}>
                <Text style={s.listRowTitle}>{p.month} · LKR {p.amount?.toLocaleString()}</Text>
                <Text style={s.listRowSub}>{p.submittedAt ? new Date(p.submittedAt).toLocaleDateString() : 'N/A'}</Text>
                {p.note && <Text style={[s.listRowSub, { fontStyle:'italic' }]}>Note: {p.note}</Text>}
              </View>
              <StatusBadge status={p.status}/>
            </View>
          ))}
        </Card>
      )}
    </ScrollView>
  );

  const renderSettings = () => (
    <ScrollView contentContainerStyle={s.tabContent} showsVerticalScrollIndicator={false}>
      {/* Personal info */}
      <Card>
        <SectionTitle>Personal Info</SectionTitle>
        {[
          { icon:'person', label:'Name',    value:currentUser?.name },
          { icon:'phone',  label:'Phone',   value:currentUser?.phoneNumber },
          { icon:'email',  label:'Email',   value:currentUser?.email },
          { icon:'directions-car', label:'Vehicle', value:currentUser?.chosenVehicleNumber },
        ].map(f => (
          <View key={f.label} style={s.infoItem}>
            <MaterialIcons name={f.icon} size={16} color={C.textMuted}/>
            <View style={{ marginLeft:10 }}>
              <Text style={s.infoItemLabel}>{f.label}</Text>
              <Text style={s.infoItemValue}>{f.value||'—'}</Text>
            </View>
          </View>
        ))}
      </Card>

      {/* Locations */}
      <Card>
        <View style={s.cardHeaderRow}>
          <SectionTitle>Trip Locations</SectionTitle>
          {!isEditingLocations && (
            <TouchableOpacity onPress={()=>setIsEditingLocations(true)}>
              <Text style={s.editLink}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>

        {isEditingLocations ? (
          <>
            {[
              { key:'pickup', label:'Pickup Location', placeholder:'e.g. Dematagoda Station' },
              { key:'dropoff', label:'Drop-off Location', placeholder:'e.g. Kandy Town' },
            ].map(f => (
              <View key={f.key} style={{ marginBottom:14 }}>
                <Text style={s.inputLabel}>{f.label}</Text>
                <View style={s.inputRow}>
                  <TextInput
                    style={[s.input, { flex:1 }]}
                    value={locationData[f.key+'Location']}
                    onChangeText={t=>setLocationData(p=>({...p,[f.key+'Location']:t}))}
                    placeholder={f.placeholder}
                    placeholderTextColor={C.textMuted}
                  />
                  <TouchableOpacity onPress={()=>handleUseCurrentLocation(f.key)} style={s.iconBtn}>
                    <MaterialIcons name="my-location" size={18} color={C.amber}/>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={()=>setMapPickingMode(mapPickingMode===f.key?null:f.key)} style={[s.iconBtn, mapPickingMode===f.key&&{ backgroundColor:C.amber }]}>
                    <MaterialIcons name="map" size={18} color={mapPickingMode===f.key?C.bg:C.amber}/>
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            {mapPickingMode && (
              <View style={{ height:200, borderRadius:12, overflow:'hidden', marginBottom:14, borderWidth:1.5, borderColor:C.amber }}>
                <MapView
                  style={{ flex:1 }}
                  initialRegion={{ latitude:currentUser?.pickupLocation?.lat||6.9271, longitude:currentUser?.pickupLocation?.lng||79.8612, latitudeDelta:0.05, longitudeDelta:0.05 }}
                  onPress={handleMapPress}
                  mapType={Platform.OS==='android'?'none':'standard'}
                >
                  {Platform.OS==='android' && <UrlTile urlTemplate="https://a.tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} flipY={false}/>}
                  {currentUser?.pickupLocation?.lat && <Marker coordinate={{ latitude:currentUser.pickupLocation.lat, longitude:currentUser.pickupLocation.lng }}><View style={[s.pinMarker,{backgroundColor:C.green}]}><MaterialIcons name="person-pin-circle" size={16} color="white"/></View></Marker>}
                  {currentUser?.dropoffLocation?.lat && <Marker coordinate={{ latitude:currentUser.dropoffLocation.lat, longitude:currentUser.dropoffLocation.lng }}><View style={[s.pinMarker,{backgroundColor:C.red}]}><MaterialIcons name="location-on" size={16} color="white"/></View></Marker>}
                </MapView>
                <View style={s.mapOverlayBanner}>
                  <MaterialIcons name="touch-app" size={16} color="white"/>
                  <Text style={s.mapOverlayText}>Tap to set {mapPickingMode}</Text>
                </View>
              </View>
            )}

            <View style={s.actionRow}>
              <GhostBtn label="Cancel" onPress={()=>{setIsEditingLocations(false);setMapPickingMode(null);}}/>
              <PrimaryBtn label="Save" onPress={handleSaveLocations}/>
            </View>
          </>
        ) : (
          <>
            {[
              { icon:'my-location', color:C.green, label:'Pickup',   value:currentUser?.pickupLocation?.address||currentUser?.pickupLocation },
              { icon:'location-pin', color:C.red,  label:'Drop-off', value:currentUser?.dropoffLocation?.address||currentUser?.dropoffLocation },
            ].map(f => (
              <View key={f.label} style={s.locationDisplay}>
                <MaterialIcons name={f.icon} size={18} color={f.color}/>
                <View style={{ marginLeft:10, flex:1 }}>
                  <Text style={s.infoItemLabel}>{f.label}</Text>
                  <Text style={s.infoItemValue}>{f.value||'Not set'}</Text>
                </View>
              </View>
            ))}
          </>
        )}
      </Card>
    </ScrollView>
  );

  const screens = { overview:renderOverview, tracking:renderTracking, absences:renderAbsences, bookings:renderBookings, payments:renderPayments, settings:renderSettings };

  // ── Render ────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg}/>

      {/* Top header */}
      <View style={s.header}>
        <View style={s.headerAvatarWrap}>
          <View style={s.headerAvatar}>
            <Text style={s.headerAvatarText}>{user?.name?.charAt(0)}</Text>
          </View>
          <View>
            <Text style={s.headerName}>{user?.name||'Passenger'}</Text>
            <Text style={s.headerSub}>Passenger · {currentUser?.chosenVehicleNumber||'No vehicle'}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={handleLogout} style={s.logoutBtn}>
          <MaterialIcons name="logout" size={20} color={C.textMuted}/>
        </TouchableOpacity>
      </View>

      {/* Screen */}
      <View style={{ flex:1 }}>
        {screens[activeTab]?.()}
      </View>

      {/* Bottom tab bar */}
      <View style={s.tabBar}>
        {TABS.map(tab => {
          const active = activeTab === tab.id;
          const badge = tab.id==='payments'&&pendingPay>0 ? pendingPay : tab.id==='absences'&&upcomingAbs>0 ? upcomingAbs : null;
          return (
            <TouchableOpacity key={tab.id} onPress={()=>setActiveTab(tab.id)} style={s.tabItem}>
              <View style={{ position:'relative' }}>
                <Ionicons
                  name={tab.icon}
                  size={22}
                  color={active ? C.amber : C.textMuted}
                />
                {badge ? (
                  <View style={s.tabBadge}>
                    <Text style={s.tabBadgeText}>{badge}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[s.tabLabel, active && { color:C.amber }]}>{tab.label}</Text>
              {active && <View style={s.tabIndicator}/>}
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:          { flex:1, backgroundColor:C.bg },
  header:        { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:18, paddingVertical:12, backgroundColor:C.surface, borderBottomWidth:1, borderBottomColor:C.border },
  headerAvatarWrap: { flexDirection:'row', alignItems:'center', gap:12 },
  headerAvatar:  { width:38, height:38, borderRadius:19, backgroundColor:C.amber, alignItems:'center', justifyContent:'center' },
  headerAvatarText: { color:C.bg, fontWeight:'800', fontSize:16 },
  headerName:    { color:C.text, fontWeight:'700', fontSize:15 },
  headerSub:     { color:C.textMuted, fontSize:12, marginTop:1 },
  logoutBtn:     { padding:8 },

  tabBar:        { flexDirection:'row', backgroundColor:C.surface, borderTopWidth:1, borderTopColor:C.border, paddingBottom: Platform.OS==='ios'?16:6, paddingTop:6 },
  tabItem:       { flex:1, alignItems:'center', justifyContent:'center', paddingVertical:4, position:'relative' },
  tabLabel:      { fontSize:9.5, color:C.textMuted, marginTop:3, fontWeight:'600', letterSpacing:0.3 },
  tabIndicator:  { position:'absolute', top:-6, width:20, height:2.5, backgroundColor:C.amber, borderRadius:2 },
  tabBadge:      { position:'absolute', top:-4, right:-8, backgroundColor:C.red, borderRadius:7, minWidth:14, height:14, alignItems:'center', justifyContent:'center', paddingHorizontal:2 },
  tabBadgeText:  { color:'white', fontSize:8, fontWeight:'800' },

  tabContent:    { padding:14, paddingBottom:20 },

  card:          { backgroundColor:C.surface, borderRadius:16, padding:16, marginBottom:12, borderWidth:1, borderColor:C.border },
  sectionTitle:  { fontSize:15, fontWeight:'800', letterSpacing:0.3, marginBottom:12 },
  cardDesc:      { fontSize:12, color:C.textMuted, marginBottom:14, lineHeight:18 },
  cardHeaderRow: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:12 },
  editLink:      { color:C.amber, fontWeight:'700', fontSize:13 },

  statRow:       { flexDirection:'row', gap:8, marginBottom:12 },
  statCard:      { flex:1, backgroundColor:C.surface, borderRadius:14, padding:12, borderWidth:1, borderColor:C.border, alignItems:'flex-start' },
  statIcon:      { width:32, height:32, borderRadius:10, alignItems:'center', justifyContent:'center', marginBottom:8 },
  statValue:     { color:C.text, fontWeight:'800', fontSize:18 },
  statLabel:     { color:C.textMuted, fontSize:10, marginTop:2, fontWeight:'600' },

  driverRow:     { flexDirection:'row', alignItems:'center', gap:12 },
  avatar:        { width:42, height:42, borderRadius:21, backgroundColor:C.surface2, alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:C.border2 },
  avatarText:    { color:C.text, fontWeight:'800', fontSize:16 },
  driverName:    { color:C.text, fontWeight:'700', fontSize:15 },
  driverSub:     { color:C.textMuted, fontSize:12, marginTop:1 },
  liveChip:      { flexDirection:'row', alignItems:'center', gap:5, backgroundColor:C.greenDim, paddingHorizontal:8, paddingVertical:4, borderRadius:10 },
  liveDot:       { width:6, height:6, borderRadius:3 },
  liveChipText:  { fontSize:10, fontWeight:'800', letterSpacing:0.5 },

  routeChip:     { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:C.surface2, borderRadius:10, paddingHorizontal:10, paddingVertical:8, marginBottom:6 },
  routeChipText: { flex:1, color:C.text, fontSize:13, fontWeight:'500' },
  routeTime:     { color:C.amber, fontSize:12, fontWeight:'700' },

  bankCard:      { flexDirection:'row', alignItems:'center', backgroundColor:C.amberDim, borderRadius:12, padding:12, borderWidth:1, borderColor:C.amber+'40' },
  bankName:      { color:C.amber, fontWeight:'800', fontSize:14 },
  bankAccNum:    { color:C.text, fontFamily: Platform.OS==='ios'?'Courier':'monospace', fontSize:14, marginTop:2 },
  bankSub:       { color:C.textMuted, fontSize:11, marginTop:3 },

  alertBanner:   { flexDirection:'row', alignItems:'center', gap:10, backgroundColor:C.orangeDim, borderRadius:14, padding:14, borderWidth:1, borderColor:C.orange+'50', marginBottom:12 },
  alertBannerText: { flex:1, color:C.orange, fontWeight:'600', fontSize:13 },

  trackingHeader: { padding:16, backgroundColor:C.surface, borderBottomWidth:1, borderBottomColor:C.border, flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  trackingTitle:  { color:C.text, fontWeight:'700', fontSize:15 },
  trackingSub:    { color:C.textMuted, fontSize:12, marginTop:2 },
  mapPlaceholder: { flex:1, alignItems:'center', justifyContent:'center', gap:12 },
  mapPlaceholderText: { color:C.textMuted, fontSize:14 },

  vehicleMarker: { backgroundColor:C.amber, padding:7, borderRadius:18, borderWidth:2, borderColor:'white' },
  pinMarker:     { padding:5, borderRadius:18, borderWidth:2, borderColor:'white' },

  stepLabel:     { color:C.textMuted, fontSize:10, fontWeight:'800', letterSpacing:1, marginBottom:8 },
  pillRow:       { flexDirection:'row', gap:6, marginBottom:14, flexWrap:'wrap' },
  pill:          { flex:1, minWidth:70, paddingVertical:10, alignItems:'center', backgroundColor:C.surface2, borderRadius:10, borderWidth:1, borderColor:C.border2 },
  pillText:      { fontSize:12, fontWeight:'700', color:C.textMuted },
  divider:       { height:1, backgroundColor:C.border2, marginVertical:14 },

  primaryBtn:    { flexDirection:'row', alignItems:'center', justifyContent:'center', paddingVertical:14, borderRadius:12, marginTop:4 },
  primaryBtnText:{ color:C.bg, fontWeight:'800', fontSize:14, letterSpacing:0.3 },
  ghostBtn:      { paddingVertical:14, paddingHorizontal:20 },
  ghostBtnText:  { color:C.textMuted, fontWeight:'600', fontSize:14 },
  actionRow:     { flexDirection:'row', justifyContent:'flex-end', alignItems:'center', gap:8, marginTop:4 },

  inputLabel:    { color:C.textSub, fontSize:12, fontWeight:'600', marginBottom:6 },
  input:         { backgroundColor:C.surface2, borderWidth:1, borderColor:C.border2, borderRadius:10, padding:12, fontSize:14, color:C.text },
  inputRow:      { flexDirection:'row', alignItems:'center', gap:6 },
  iconBtn:       { width:44, height:44, backgroundColor:C.surface2, borderRadius:10, borderWidth:1, borderColor:C.border2, alignItems:'center', justifyContent:'center' },
  twoCol:        { flexDirection:'row', gap:0 },

  availBox:      { marginTop:12, backgroundColor:C.greenDim, borderRadius:14, padding:14, borderWidth:1, borderColor:C.green+'40' },
  availHeader:   { flexDirection:'row', alignItems:'center', gap:8, marginBottom:12 },
  availTitle:    { color:C.green, fontWeight:'800', fontSize:15 },
  seatCountRow:  { flexDirection:'row', alignItems:'center', gap:12, marginBottom:14 },
  seatInput:     { width:60, height:44, backgroundColor:C.surface, borderWidth:1, borderColor:C.green+'60', borderRadius:10, textAlign:'center', fontSize:16, fontWeight:'800', color:C.text },
  priceRow:      { flexDirection:'row', justifyContent:'space-between', backgroundColor:C.surface, padding:12, borderRadius:12, marginBottom:12, borderWidth:1, borderColor:C.border2 },
  priceLabel:    { color:C.textMuted, fontSize:10, fontWeight:'700', marginBottom:3 },
  priceValue:    { color:C.text, fontWeight:'800', fontSize:16 },

  unavailBox:    { flexDirection:'row', alignItems:'center', gap:10, backgroundColor:C.redDim, borderRadius:12, padding:14, marginTop:12, borderWidth:1, borderColor:C.red+'40' },
  unavailText:   { color:C.red, fontWeight:'700', fontSize:13 },

  listRow:       { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingVertical:12, borderBottomWidth:1, borderBottomColor:C.border },
  listRowTitle:  { color:C.text, fontWeight:'600', fontSize:14 },
  listRowSub:    { color:C.textMuted, fontSize:12, marginTop:2 },
  removeBtn:     { width:30, height:30, backgroundColor:C.redDim, borderRadius:15, alignItems:'center', justifyContent:'center' },

  bookingBadgeRow: { flexDirection:'row', alignItems:'center', gap:6, flexWrap:'wrap', marginBottom:4 },
  miniChip:      { paddingHorizontal:8, paddingVertical:3, borderRadius:8 },
  miniChipText:  { fontSize:11, fontWeight:'700' },
  locationLine:  { paddingLeft:8, borderLeftWidth:2, borderLeftColor:C.border2, marginTop:4 },
  locationLineText: { color:C.textMuted, fontSize:12, marginBottom:2 },

  receiptPicker: { height:110, backgroundColor:C.surface2, borderRadius:12, borderWidth:1.5, borderColor:C.border2, borderStyle:'dashed', alignItems:'center', justifyContent:'center', marginBottom:14, overflow:'hidden' },
  receiptPickerText: { color:C.textMuted, fontSize:13, marginTop:6 },
  receiptPreview:{ width:'100%', height:'100%', resizeMode:'cover' },
  paymentThumb:  { width:48, height:48, borderRadius:8, borderWidth:1, borderColor:C.border2 },

  statusBadge:   { paddingHorizontal:10, paddingVertical:4, borderRadius:10 },
  statusBadgeText: { fontSize:11, fontWeight:'800' },

  infoItem:      { flexDirection:'row', alignItems:'center', paddingVertical:10, borderBottomWidth:1, borderBottomColor:C.border },
  infoItemLabel: { color:C.textMuted, fontSize:11, fontWeight:'600', marginBottom:2 },
  infoItemValue: { color:C.text, fontSize:14, fontWeight:'500' },
  locationDisplay: { flexDirection:'row', alignItems:'flex-start', paddingVertical:12, borderBottomWidth:1, borderBottomColor:C.border },

  mapOverlayBanner: { position:'absolute', bottom:10, left:10, right:10, backgroundColor:'rgba(245,158,11,0.92)', borderRadius:10, flexDirection:'row', alignItems:'center', gap:8, padding:10 },
  mapOverlayText: { color:C.bg, fontSize:13, fontWeight:'800' },

  emptyText:     { color:C.textMuted, fontStyle:'italic', fontSize:13 },
});