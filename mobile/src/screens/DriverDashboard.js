import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, TextInput, Alert, Platform,
  ScrollView, Image, StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MaterialIcons, FontAwesome5, Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import * as Location from 'expo-location';
import { io } from 'socket.io-client';
import MapView, { Marker, UrlTile, Polyline } from 'react-native-maps';
import { geocodeAddress, fetchRoutePolyline, fetchRouteAlternatives } from '../services/mapServices';
import * as ImagePicker from 'expo-image-picker';

const API = process.env.EXPO_PUBLIC_API_URL + '/auth';

// ─── Design tokens (same as PassengerDashboard) ──────────────────
const C = {
  bg:        '#0a0f1a',
  surface:   '#111827',
  surface2:  '#1f2937',
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
};

const TABS = [
  { id: 'overview',   label: 'Overview',  icon: 'grid-outline' },
  { id: 'tracking',   label: 'Live Map',  icon: 'navigate-outline' },
  { id: 'passengers', label: 'Riders',    icon: 'people-outline' },
  { id: 'payments',   label: 'Payments',  icon: 'card-outline' },
  { id: 'settings',   label: 'Settings',  icon: 'settings-outline' },
];

// ─── Primitives ───────────────────────────────────────────────────
const Card = ({ children, style }) => <View style={[s.card, style]}>{children}</View>;

const SectionTitle = ({ children, color = C.amber }) => (
  <Text style={[s.sectionTitle, { color }]}>{children}</Text>
);

const Pill = ({ label, active, color = C.amber, onPress, style }) => (
  <TouchableOpacity onPress={onPress}
    style={[s.pill, active && { backgroundColor: color + '25', borderColor: color }, style]}>
    <Text style={[s.pillText, active && { color }]}>{label}</Text>
  </TouchableOpacity>
);

const PrimaryBtn = ({ label, onPress, disabled, color = C.amber, icon, loading }) => (
  <TouchableOpacity onPress={onPress} disabled={disabled}
    style={[s.primaryBtn, { backgroundColor: color, opacity: disabled ? 0.5 : 1 }]}>
    {loading
      ? <ActivityIndicator color={C.bg} size="small" />
      : <>
          {icon && <MaterialIcons name={icon} size={18} color={C.bg} style={{ marginRight: 8 }} />}
          <Text style={s.primaryBtnText}>{label}</Text>
        </>}
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
    <TextInput style={s.input} placeholderTextColor={C.textMuted} {...props} />
  </View>
);

const StatusBadge = ({ status }) => {
  const map = {
    approved: { bg: C.greenDim, text: C.green,  label: '✓ Approved' },
    rejected: { bg: C.redDim,   text: C.red,    label: '✕ Rejected' },
    pending:  { bg: C.amberDim, text: C.amber,  label: '⏳ Pending' },
  };
  const t = map[status] || map.pending;
  return (
    <View style={[s.statusBadge, { backgroundColor: t.bg }]}>
      <Text style={[s.statusBadgeText, { color: t.text }]}>{t.label}</Text>
    </View>
  );
};

// ─── Main ─────────────────────────────────────────────────────────
export default function DriverDashboard({ route, navigation }) {
  const { user: initialUser, token } = route.params || {};
  const [activeTab,       setActiveTab]       = useState('overview');
  const [user,            setUser]            = useState(initialUser);
  const [passengers,      setPassengers]      = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [isEditingRoute,  setIsEditingRoute]  = useState(false);
  const [routeData,       setRouteData]       = useState({
    routes:      initialUser?.routes || [],
    totalSeats:  initialUser?.totalSeats  ? String(initialUser.totalSeats)  : '',
    pricePerKm:  initialUser?.pricePerKm  ? String(initialUser.pricePerKm)  : '',
  });
  const [isTripActive,    setIsTripActive]    = useState(initialUser?.isTripActive || false);
  const [currentLocation, setCurrentLocation] = useState(initialUser?.currentLocation || null);
  const [routePolylines,  setRoutePolylines]  = useState(() => {
    return (initialUser?.routes || [])
      .filter(r => r.polyline)
      .map(r => {
        try {
          const points = JSON.parse(r.polyline);
          if (Array.isArray(points) && points.length > 0) {
            const validPoints = points.map(p => ({
              latitude: p.latitude || p.lat,
              longitude: p.longitude || p.lng
            })).filter(c => 
              typeof c.latitude === 'number' && !isNaN(c.latitude) && 
              typeof c.longitude === 'number' && !isNaN(c.longitude)
            );
            return validPoints.length > 0 ? { points: validPoints } : null;
          }
        } catch (e) { console.error('Initial polyline parse error:', e); }
        return null;
      })
      .filter(Boolean);
  });
  const [allPayments,     setAllPayments]     = useState([]);
  const [reviewNotes,     setReviewNotes]     = useState({});
  const [isEditingBank,   setIsEditingBank]   = useState(false);
  const [bankDetails,     setBankDetails]     = useState({
    bankName:      initialUser?.bankDetails?.bankName      || '',
    accountName:   initialUser?.bankDetails?.accountName   || '',
    accountNumber: initialUser?.bankDetails?.accountNumber || '',
    branchName:    initialUser?.bankDetails?.branchName    || '',
  });
  const [systemPayments,  setSystemPayments]  = useState([]);
  const [sysPayMonth,     setSysPayMonth]     = useState(() => new Date().toISOString().slice(0, 7));
  const [sysPayAmount,    setSysPayAmount]    = useState('');
  const [sysPayImage,     setSysPayImage]     = useState(null);
  const [sysPayUploading, setSysPayUploading] = useState(false);

  const socketRef     = useRef(null);
  const locationSubRef = useRef(null);

  // ── init ─────────────────────────────────────────────────────
  useEffect(() => { fetchPassengers(); fetchAllPayments(); }, []);

  useEffect(() => {
    if (isTripActive && user) startTracking();
    else stopTracking();
    return () => stopTracking();
  }, [isTripActive, user]);

  // ── tracking ──────────────────────────────────────────────────
  const startTracking = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Allow location access to broadcast your position.');
      setIsTripActive(false); return;
    }
    socketRef.current = io(process.env.EXPO_PUBLIC_API_URL.replace('/api', ''), { transports: ['websocket'] });
    locationSubRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 10000, distanceInterval: 10 },
      loc => {
        const l = { lat: loc.coords.latitude, lng: loc.coords.longitude, timestamp: new Date() };
        setCurrentLocation(l);
        socketRef.current?.emit('driver_location_update', { driverId: user.uid, ...l });
        axios.put(`${API}/update-location`, l, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
      }
    );
  };

  const stopTracking = () => {
    locationSubRef.current?.remove(); locationSubRef.current = null;
    socketRef.current?.disconnect(); socketRef.current = null;
  };

  const toggleTrip = async () => {
    try {
      const ep = isTripActive ? 'end-trip' : 'start-trip';
      const { data } = await axios.put(`${API}/${ep}`, {}, { headers: { Authorization: `Bearer ${token}` } });
      setIsTripActive(data.isTripActive);
      if (!data.isTripActive) setCurrentLocation(null);
    } catch { Alert.alert('Error', 'Could not toggle trip state.'); }
  };

  // ── data fetchers ─────────────────────────────────────────────
  const fetchPassengers = async () => {
    try {
      const { data } = await axios.get(`${API}/passengers`, { headers: { Authorization: `Bearer ${token}` } });
      setPassengers(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchAllPayments = async () => {
    try {
      const [allRes, sysRes] = await Promise.all([
        axios.get(`${process.env.EXPO_PUBLIC_API_URL.replace('/api', '')}/api/payments/all-payments`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${process.env.EXPO_PUBLIC_API_URL.replace('/api', '')}/api/payments/admin/my-payments`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setAllPayments(allRes.data || []);
      setSystemPayments(sysRes.data || []);
    } catch (e) { console.error(e); }
  };

  // ── actions ───────────────────────────────────────────────────
  const reviewPayment = async (passengerId, paymentId, status) => {
    try {
      await axios.put(
        `${process.env.EXPO_PUBLIC_API_URL.replace('/api', '')}/api/payments/review/${passengerId}/${paymentId}`,
        { status, note: reviewNotes[paymentId] || '' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchAllPayments();
    } catch { Alert.alert('Error', 'Failed to update payment status.'); }
  };

  const handleSaveBankDetails = async () => {
    try {
      const { data } = await axios.put(`${API}/update-bank-details`, { bankDetails }, { headers: { Authorization: `Bearer ${token}` } });
      setUser(data); setIsEditingBank(false);
      Alert.alert('Success', 'Bank details updated.');
    } catch { Alert.alert('Error', 'Failed to update bank details.'); }
  };

  const handleSaveRoute = async () => {
    try {
      const enriched = await Promise.all((routeData.routes || []).map(async r => {
        if (r.polylineOverride) return { route:r.route, via:r.via, startTime:r.startTime, polyline:r.polylineOverride };
        if (!r.route) return r;
        const parts = r.route.split(/ - | to |,/i);
        if (parts.length < 2) return r;
        const [sg, eg] = await Promise.all([geocodeAddress(parts[0].trim()), geocodeAddress(parts[parts.length-1].trim())]);
        let via = null;
        if (r.via?.trim()) {
          const geos = await Promise.all(r.via.split(',').map(v => geocodeAddress(v.trim())));
          via = geos.filter(Boolean); if (!via.length) via = null;
        }
        if (sg && eg) {
          const pts = await fetchRoutePolyline(sg, eg, via);
          return { ...r, polyline: pts ? JSON.stringify(pts) : undefined };
        }
        return r;
      }));
      const { data } = await axios.put(`${API}/update-route`, {
        routes: enriched,
        totalSeats: parseInt(routeData.totalSeats) || 0,
        pricePerKm: parseFloat(routeData.pricePerKm) || 0,
      }, { headers: { Authorization: `Bearer ${token}` } });
      setUser(data);
      const newPolylines = (data.routes || [])
        .filter(r => r.polyline)
        .map(r => {
          try {
            const points = JSON.parse(r.polyline);
            if (Array.isArray(points) && points.length > 0) {
              const validPoints = points.filter(c => 
                c && typeof c.latitude === 'number' && !isNaN(c.latitude) && 
                typeof c.longitude === 'number' && !isNaN(c.longitude)
              );
              return validPoints.length > 0 ? { points: validPoints } : null;
            }
          } catch (e) { console.error('Save route polyline parse error:', e); }
          return null;
        })
        .filter(Boolean);
      setRoutePolylines(newPolylines);
      setIsEditingRoute(false);
    } catch { Alert.alert('Error', 'Failed to update route.'); }
  };

  const handleFindAlternatives = async index => {
    const r = routeData.routes[index];
    if (!r.route) { Alert.alert('Error', 'Enter a route first.'); return; }
    const parts = r.route.split(/ - | to |,/i);
    if (parts.length < 2) { Alert.alert('Error', "Use format: Colombo - Kandy"); return; }
    try {
      const [sg, eg] = await Promise.all([geocodeAddress(parts[0].trim()), geocodeAddress(parts[parts.length-1].trim())]);
      let via = null;
      if (r.via?.trim()) {
        const geos = await Promise.all(r.via.split(',').map(v => geocodeAddress(v.trim())));
        via = geos.filter(Boolean); if (!via.length) via = null;
      }
      if (sg && eg) {
        const alts = await fetchRouteAlternatives(sg, eg, via);
        if (alts?.length) {
          const nr = [...routeData.routes];
          nr[index] = { ...nr[index], alternatives:alts, selectedAlternativeIndex:0, polylineOverride:alts[0].polyline };
          setRouteData({ ...routeData, routes: nr });
        } else Alert.alert('Error', 'Could not generate alternatives.');
      } else Alert.alert('Error', 'Could not verify locations.');
    } catch { Alert.alert('Error', 'Failed fetching alternatives.'); }
  };

  const pickSystemPaymentImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes:ImagePicker.MediaType.Images, allowsEditing:true, quality:0.8 });
    if (!res.canceled) {
      const a = res.assets[0];
      setSysPayImage({ uri:a.uri, type:'image/jpeg', name:`sys_payment_${Date.now()}.jpg` });
    }
  };

  const uploadSystemPayment = async () => {
    if (!sysPayMonth || !sysPayAmount || !sysPayImage) {
      Alert.alert('Missing Fields', 'Fill in month, amount, and pick a receipt.'); return;
    }
    setSysPayUploading(true);
    try {
      const fd = new FormData();
      fd.append('month', sysPayMonth); fd.append('amount', sysPayAmount); fd.append('receipt', sysPayImage);
      const { data } = await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL.replace('/api', '')}/api/payments/admin/upload`,
        fd, { headers: { Authorization:`Bearer ${token}`, 'Content-Type':'multipart/form-data' } }
      );
      setSystemPayments(data.systemPayments || []); setSysPayAmount(''); setSysPayImage(null);
      Alert.alert('Success', 'System payment uploaded!');
    } catch { Alert.alert('Error', 'Failed to upload receipt.'); }
    finally { setSysPayUploading(false); }
  };

  const getTodayStr = () => {
    const d = new Date();
    return (new Date(d - d.getTimezoneOffset()*60000)).toISOString().split('T')[0];
  };

  const pendingPaymentsCount = allPayments.reduce((sum, p) => sum + (p.payments?.filter(pay=>pay.status==='pending').length||0), 0);

  // ── TAB SCREENS ───────────────────────────────────────────────

  const renderOverview = () => (
    <ScrollView contentContainerStyle={s.tabContent} showsVerticalScrollIndicator={false}>
      {/* Stat row */}
      <View style={s.statRow}>
        {[
          { label:'Passengers', value:passengers.length,       icon:'people',         color:C.blue },
          { label:'Seats',      value:user?.totalSeats||'—',   icon:'event-seat',     color:C.amber },
          { label:'Price/km',   value:user?.pricePerKm ? `Rs.${user.pricePerKm}` : '—', icon:'attach-money', color:C.green },
          { label:'Pending',    value:pendingPaymentsCount,    icon:'schedule',       color:C.red },
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

      {/* Today's ride summary */}
      <Card>
        <SectionTitle>Today's Summary</SectionTitle>
        {user?.totalSeats && !loading ? (
          ['Morning','Evening'].map(period => {
            const assigned = passengers.length;
            const absent   = passengers.filter(p => p.absences?.some(a => a.date===getTodayStr() && (a.period===period||a.period==='Both'))).length;
            const extra    = passengers.reduce((sum, p) => sum + (p.extraBookings?.filter(eb => eb.date===getTodayStr() && (eb.period===period||eb.period==='Both')).reduce((s,eb)=>s+eb.seats,0)||0), 0);
            const present  = assigned - absent;
            const total    = present + extra;
            const over     = total > user.totalSeats;
            return (
              <View key={period} style={[s.summaryBox, { borderColor: over ? C.red+'60' : C.border2, backgroundColor: over ? C.redDim : C.surface2 }]}>
                <View style={s.summaryHeader}>
                  <Text style={s.summaryPeriod}>{period==='Morning'?'🌅':'🌆'} {period}</Text>
                  <View style={[s.miniChip, { backgroundColor: over?C.redDim:C.greenDim }]}>
                    <Text style={[s.miniChipText, { color:over?C.red:C.green }]}>
                      {over ? `Overbooked +${total-user.totalSeats}` : `${user.totalSeats-total} free`}
                    </Text>
                  </View>
                </View>
                <View style={s.summaryRow}><Text style={s.summaryLabel}>Active</Text><Text style={s.summaryValue}>{present}</Text></View>
                <View style={s.summaryRow}><Text style={s.summaryLabel}>Absent</Text><Text style={[s.summaryValue,{color:C.amber}]}>{absent}</Text></View>
                <View style={s.summaryRow}><Text style={s.summaryLabel}>Extra bookings</Text><Text style={[s.summaryValue,{color:C.blue}]}>{extra}</Text></View>
                <View style={[s.summaryRow, s.summaryRowBorder]}>
                  <Text style={[s.summaryLabel,{color:C.text,fontWeight:'700'}]}>Occupancy</Text>
                  <Text style={[s.summaryValue,{color:over?C.red:C.text,fontWeight:'800'}]}>{total} / {user.totalSeats}</Text>
                </View>
              </View>
            );
          })
        ) : (
          <Text style={s.emptyText}>Set total seats in Settings to see summary.</Text>
        )}
      </Card>

      {/* Routes quick view */}
      <Card>
        <View style={s.cardHeaderRow}>
          <SectionTitle>My Routes</SectionTitle>
          <TouchableOpacity onPress={()=>setActiveTab('settings')}>
            <Text style={s.editLink}>Edit →</Text>
          </TouchableOpacity>
        </View>
        {user?.routes?.length > 0 ? user.routes.map((r,i) => (
          <View key={i} style={s.routeChip}>
            <MaterialIcons name="route" size={14} color={C.amber}/>
            <Text style={s.routeChipText}>{r.route||'—'} {r.via?`via ${r.via}`:''}</Text>
            <Text style={s.routeTime}>{r.startTime||'—'}</Text>
          </View>
        )) : <Text style={s.emptyText}>No routes configured.</Text>}
      </Card>
    </ScrollView>
  );

  const renderTracking = () => (
    <View style={{ flex:1 }}>
      <View style={s.trackingHeader}>
        <View style={{ flex:1 }}>
          <Text style={s.trackingTitle}>Live Location Broadcast</Text>
          <Text style={s.trackingSub}>{isTripActive ? 'Passengers can see your location' : 'Start trip to broadcast your position'}</Text>
        </View>
        <TouchableOpacity onPress={toggleTrip}
          style={[s.tripToggleBtn, { backgroundColor: isTripActive ? C.redDim : C.greenDim, borderColor: isTripActive ? C.red : C.green }]}>
          <View style={[s.liveDot, { backgroundColor: isTripActive ? C.red : C.green }]}/>
          <Text style={[s.tripToggleText, { color: isTripActive ? C.red : C.green }]}>
            {isTripActive ? 'End Trip' : 'Start Trip'}
          </Text>
        </TouchableOpacity>
      </View>

      {isTripActive && currentLocation ? (
        <>
          <MapView
            style={{ flex:1 }}
            region={{ latitude:currentLocation.lat, longitude:currentLocation.lng, latitudeDelta:0.01, longitudeDelta:0.01 }}
            mapType={Platform.OS==='android'?'none':'standard'}
          >
            {Platform.OS==='android' && <UrlTile urlTemplate="https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png" maximumZ={19} flipY={false}/>}
            <Marker coordinate={{ latitude:currentLocation.lat, longitude:currentLocation.lng }} zIndex={1000}>
              <View style={s.vehicleMarker}><FontAwesome5 name="bus" size={16} color="white"/></View>
            </Marker>
            {routePolylines.map((poly,i) => {
              if (!poly || !poly.points || poly.points.length < 1) return null;
              return (
                <Polyline key={i} coordinates={poly.points} strokeColor={C.amber} strokeWidth={4}/>
              );
            })}
            {passengers.map(p => (
              <React.Fragment key={p._id}>
                {p.pickupLocation?.lat && (
                  <Marker coordinate={{ latitude:p.pickupLocation.lat, longitude:p.pickupLocation.lng }} title={`${p.name}: Pickup`}>
                    <View style={[s.pinMarker,{backgroundColor:C.green}]}><MaterialIcons name="person-pin-circle" size={18} color="white"/></View>
                  </Marker>
                )}
                {p.dropoffLocation?.lat && (
                  <Marker coordinate={{ latitude:p.dropoffLocation.lat, longitude:p.dropoffLocation.lng }} title={`${p.name}: Drop-off`}>
                    <View style={[s.pinMarker,{backgroundColor:C.red}]}><MaterialIcons name="location-on" size={18} color="white"/></View>
                  </Marker>
                )}
              </React.Fragment>
            ))}
          </MapView>
          {Platform.OS === 'android' && (
            <View style={s.mapAttribution}>
              <Text style={s.mapAttributionText}>© OpenStreetMap contributors, © CARTO</Text>
            </View>
          )}
        </>
      ) : (
        <View style={s.mapPlaceholder}>
          <MaterialIcons name="navigation" size={52} color={C.textMuted}/>
          <Text style={s.mapPlaceholderText}>
            {isTripActive ? 'Acquiring GPS signal…' : 'Start trip to broadcast location'}
          </Text>
          {!isTripActive && (
            <TouchableOpacity onPress={toggleTrip} style={[s.primaryBtn, { marginTop:20, paddingHorizontal:28 }]}>
              <Text style={s.primaryBtnText}>Start Tracking</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );

  const renderPassengerCard = ({ item }) => {
    const todayAbs = item.absences?.find(a => a.date === getTodayStr());
    const upcoming = item.absences?.filter(a => a.date > getTodayStr()).sort((a,b)=>a.date.localeCompare(b.date)) || [];
    return (
      <View style={[s.passengerCard, todayAbs && { borderLeftColor:C.red }]}>
        <View style={s.passengerHeaderRow}>
          <View style={s.passengerLeft}>
            <View style={s.passengerAvatar}>
              <Text style={s.passengerAvatarText}>{item.name?.charAt(0)}</Text>
            </View>
            <View>
              <Text style={[s.passengerName, todayAbs && { color:C.red }]}>{item.name}</Text>
              <Text style={s.passengerSub}>{item.phoneNumber}</Text>
            </View>
          </View>
          {todayAbs && (
            <View style={[s.miniChip,{backgroundColor:C.redDim}]}>
              <Text style={[s.miniChipText,{color:C.red}]}>ABSENT{todayAbs.period!=='Both'?` (${todayAbs.period})`:''}</Text>
            </View>
          )}
        </View>

        <Text style={s.passengerEmail}>{item.email}</Text>

        {(item.pickupLocation || item.dropoffLocation) && (
          <View style={s.locationBlock}>
            {item.pickupLocation && (
              <View style={s.locationRow}>
                <MaterialIcons name="my-location" size={13} color={C.green}/>
                <Text style={s.locationText}>{item.pickupLocation?.address || item.pickupLocation}</Text>
              </View>
            )}
            {item.dropoffLocation && (
              <View style={s.locationRow}>
                <MaterialIcons name="location-pin" size={13} color={C.red}/>
                <Text style={s.locationText}>{item.dropoffLocation?.address || item.dropoffLocation}</Text>
              </View>
            )}
          </View>
        )}

        {upcoming.length > 0 && (
          <View style={s.absenceBlock}>
            <Text style={s.absenceBlockLabel}>UPCOMING ABSENCES</Text>
            <View style={{ flexDirection:'row', flexWrap:'wrap', gap:4 }}>
              {upcoming.map(a => (
                <View key={a.date} style={[s.miniChip,{backgroundColor:C.orangeDim}]}>
                  <Text style={[s.miniChipText,{color:C.orange}]}>
                    {new Date(a.date).toLocaleDateString(undefined,{month:'short',day:'numeric'})} {a.period!=='Both'?`(${a.period})`:''}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {item.extraBookings?.length > 0 && (
          <View style={s.absenceBlock}>
            <Text style={s.absenceBlockLabel}>EXTRA BOOKINGS</Text>
            {item.extraBookings.sort((a,b)=>a.date.localeCompare(b.date)).map((eb,idx) => (
              <View key={idx} style={s.extraBookingRow}>
                <View style={s.extraBookingTop}>
                  <Text style={s.extraBookingDate}>
                    {new Date(eb.date).toLocaleDateString(undefined,{month:'short',day:'numeric'})} · {eb.period}
                  </Text>
                  <View style={[s.miniChip,{backgroundColor:C.greenDim}]}>
                    <Text style={[s.miniChipText,{color:C.green}]}>{eb.seats} seat{eb.seats>1?'s':''}</Text>
                  </View>
                </View>
                {eb.pickupLocation && (
                  <View style={s.extraLocationLine}>
                    <Text style={s.extraLocationText}>From: {eb.pickupLocation.address}</Text>
                    <Text style={s.extraLocationText}>To: {eb.dropoffLocation?.address}</Text>
                    {eb.price && <Text style={[s.extraLocationText,{color:C.green,fontWeight:'700'}]}>Rs. {Math.round(eb.price)} ({eb.distanceKm?.toFixed(1)} km)</Text>}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderPassengers = () => (
    <View style={{ flex:1 }}>
      <View style={s.listHeader}>
        <Text style={s.listHeaderTitle}>Passengers</Text>
        <View style={[s.miniChip,{backgroundColor:C.amberDim}]}>
          <Text style={[s.miniChipText,{color:C.amber}]}>{passengers.length}</Text>
        </View>
      </View>
      {loading ? (
        <View style={s.mapPlaceholder}>
          <ActivityIndicator size="large" color={C.amber}/>
        </View>
      ) : passengers.length === 0 ? (
        <View style={s.mapPlaceholder}>
          <MaterialIcons name="people" size={48} color={C.textMuted}/>
          <Text style={s.mapPlaceholderText}>No passengers have selected your vehicle yet.</Text>
        </View>
      ) : (
        <FlatList
          data={passengers}
          keyExtractor={item => item._id}
          renderItem={renderPassengerCard}
          contentContainerStyle={{ padding:14, paddingBottom:20 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );

  const renderPayments = () => (
    <ScrollView contentContainerStyle={s.tabContent} showsVerticalScrollIndicator={false}>

      {/* Passenger payment approvals */}
      <Card>
        <SectionTitle>Passenger Approvals</SectionTitle>
        <Text style={s.cardDesc}>Review monthly payments submitted by your passengers.</Text>

        {allPayments.length === 0 && <Text style={s.emptyText}>No payment submissions yet.</Text>}

        {allPayments.map(passenger => passenger.payments?.length > 0 && (
          <View key={passenger.passengerId} style={{ marginBottom:16 }}>
            <View style={s.paymentPassengerRow}>
              <View style={[s.passengerAvatar,{width:30,height:30,borderRadius:15}]}>
                <Text style={[s.passengerAvatarText,{fontSize:13}]}>{passenger.name?.charAt(0)}</Text>
              </View>
              <View style={{ marginLeft:8 }}>
                <Text style={s.paymentPassengerName}>{passenger.name}</Text>
                <Text style={s.paymentPassengerEmail}>{passenger.email}</Text>
              </View>
            </View>
            {passenger.payments.map(p => (
              <View key={p._id} style={s.paymentCard}>
                <View style={{ flexDirection:'row', gap:10 }}>
                  {p.imageUrl && <Image source={{ uri:p.imageUrl }} style={s.paymentThumb}/>}
                  <View style={{ flex:1 }}>
                    <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
                      <Text style={s.paymentTitle}>{p.month} · LKR {p.amount?.toLocaleString()}</Text>
                      <StatusBadge status={p.status}/>
                    </View>
                    <Text style={s.paymentDate}>{p.submittedAt ? new Date(p.submittedAt).toLocaleDateString() : ''}</Text>
                    {p.note && <Text style={s.paymentNote}>Note: {p.note}</Text>}
                  </View>
                </View>
                {p.status === 'pending' && (
                  <View style={{ marginTop:10 }}>
                    <TextInput
                      style={[s.input,{marginBottom:8}]}
                      placeholder="Optional note for passenger…"
                      placeholderTextColor={C.textMuted}
                      value={reviewNotes[p._id]||''}
                      onChangeText={t => setReviewNotes(n=>({...n,[p._id]:t}))}
                    />
                    <View style={{ flexDirection:'row', gap:8 }}>
                      <TouchableOpacity onPress={()=>reviewPayment(passenger.passengerId,p._id,'approved')}
                        style={[s.reviewBtn, { backgroundColor:C.greenDim, borderColor:C.green+'50' }]}>
                        <Text style={[s.reviewBtnText,{color:C.green}]}>✓ Approve</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={()=>reviewPayment(passenger.passengerId,p._id,'rejected')}
                        style={[s.reviewBtn, { backgroundColor:C.redDim, borderColor:C.red+'50' }]}>
                        <Text style={[s.reviewBtnText,{color:C.red}]}>✕ Reject</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            ))}
          </View>
        ))}
      </Card>

      {/* System fee payment */}
      <Card>
        <SectionTitle>System Fee Payment</SectionTitle>
        <Text style={s.cardDesc}>Upload your monthly system fee receipt for admin review.</Text>

        <View style={s.twoCol}>
          <View style={{ flex:1, marginRight:6 }}>
            <StyledInput label="Month (YYYY-MM)" placeholder="2026-03" value={sysPayMonth} onChangeText={setSysPayMonth}/>
          </View>
          <View style={{ flex:1, marginLeft:6 }}>
            <StyledInput label="Amount (LKR)" placeholder="5000" value={sysPayAmount} onChangeText={setSysPayAmount} keyboardType="numeric"/>
          </View>
        </View>

        <TouchableOpacity onPress={pickSystemPaymentImage} style={s.receiptPicker}>
          {sysPayImage
            ? <Image source={{ uri:sysPayImage.uri }} style={s.receiptPreview}/>
            : <>
                <MaterialIcons name="cloud-upload" size={28} color={C.textMuted}/>
                <Text style={s.receiptPickerText}>{sysPayImage ? '📸 Change Photo' : 'Tap to pick receipt'}</Text>
              </>}
        </TouchableOpacity>

        <PrimaryBtn label="Submit Payment" onPress={uploadSystemPayment} disabled={sysPayUploading} loading={sysPayUploading}/>

        {systemPayments.length > 0 && (
          <View style={{ marginTop:18, paddingTop:14, borderTopWidth:1, borderTopColor:C.border2 }}>
            <Text style={[s.inputLabel, { marginBottom:10 }]}>My History</Text>
            {systemPayments.map(p => (
              <View key={p._id} style={s.sysPayRow}>
                {p.imageUrl && <Image source={{ uri:p.imageUrl }} style={s.paymentThumb}/>}
                <View style={{ flex:1, marginLeft: p.imageUrl ? 10 : 0 }}>
                  <Text style={s.paymentTitle}>{p.month} · LKR {p.amount?.toLocaleString()}</Text>
                  <Text style={s.paymentDate}>{p.submittedAt ? new Date(p.submittedAt).toLocaleDateString() : 'N/A'}</Text>
                  {p.note && <Text style={s.paymentNote}>Admin: {p.note}</Text>}
                </View>
                <StatusBadge status={p.status}/>
              </View>
            ))}
          </View>
        )}
      </Card>
    </ScrollView>
  );

  const renderSettings = () => (
    <ScrollView contentContainerStyle={s.tabContent} showsVerticalScrollIndicator={false}>

      {/* Vehicle info */}
      <Card>
        <SectionTitle>Vehicle Details</SectionTitle>
        {[
          { icon:'person',         label:'Name',         value:user?.name },
          { icon:'phone',          label:'Phone',        value:user?.phoneNumber },
          { icon:'email',          label:'Email',        value:user?.email },
          { icon:'tag',            label:'Plate Number', value:user?.vehicleNumber },
          { icon:'directions-car', label:'Vehicle Type', value:user?.vehicleType },
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

      {/* Route configuration */}
      <Card>
        <View style={s.cardHeaderRow}>
          <SectionTitle>Route Configuration</SectionTitle>
          {!isEditingRoute && <TouchableOpacity onPress={()=>setIsEditingRoute(true)}><Text style={s.editLink}>Edit</Text></TouchableOpacity>}
        </View>

        {isEditingRoute ? (
          <>
            {routeData.routes.map((r, index) => (
              <View key={index} style={s.routeEditCard}>
                <TouchableOpacity onPress={()=>{const nr=[...routeData.routes];nr.splice(index,1);setRouteData({...routeData,routes:nr});}} style={s.removeRouteBtn}>
                  <MaterialIcons name="close" size={16} color={C.red}/>
                </TouchableOpacity>

                <StyledInput label="Route (e.g. Colombo - Kandy)" placeholder="Start - End"
                  value={r.route||''} onChangeText={t=>{const nr=[...routeData.routes];nr[index].route=t;setRouteData({...routeData,routes:nr});}}/>

                <Text style={s.inputLabel}>Via (optional)</Text>
                <View style={{ flexDirection:'row', gap:8, marginBottom:14 }}>
                  <TextInput style={[s.input,{flex:1,marginBottom:0}]} placeholderTextColor={C.textMuted}
                    value={r.via||''} onChangeText={t=>{const nr=[...routeData.routes];nr[index].via=t;setRouteData({...routeData,routes:nr});}}
                    placeholder="e.g. Kurunegala"/>
                  <TouchableOpacity onPress={()=>handleFindAlternatives(index)}
                    style={[s.primaryBtn,{paddingHorizontal:12,marginTop:0}]}>
                    <Text style={[s.primaryBtnText,{fontSize:12}]}>Find</Text>
                  </TouchableOpacity>
                </View>

                {r.alternatives?.length > 0 && (
                  <View style={s.altBox}>
                    <Text style={s.altBoxTitle}>Select Path</Text>
                    {r.alternatives.map((alt,i) => (
                      <TouchableOpacity key={i} onPress={()=>{const nr=[...routeData.routes];nr[index].selectedAlternativeIndex=i;nr[index].polylineOverride=alt.polyline;setRouteData({...routeData,routes:nr});}}
                        style={[s.altRow, r.selectedAlternativeIndex===i && s.altRowActive]}>
                        <Text style={[s.altRowText, r.selectedAlternativeIndex===i && {color:C.blue,fontWeight:'700'}]}>
                          Path {i+1} {i===0?'(Fastest)':''}
                        </Text>
                        <Text style={s.altRowSub}>{(alt.distance/1000).toFixed(1)}km · {Math.round(alt.duration/60)}m</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                <StyledInput label="Start Time" placeholder="e.g. 08:00 AM"
                  value={r.startTime||''} onChangeText={t=>{const nr=[...routeData.routes];nr[index].startTime=t;setRouteData({...routeData,routes:nr});}}/>
              </View>
            ))}

            <TouchableOpacity onPress={()=>setRouteData({...routeData,routes:[...routeData.routes,{route:'',via:'',startTime:''}]})} style={s.addRouteBtn}>
              <MaterialIcons name="add" size={18} color={C.amber}/>
              <Text style={s.addRouteBtnText}>Add Route</Text>
            </TouchableOpacity>

            <View style={s.twoCol}>
              <View style={{flex:1,marginRight:6}}>
                <StyledInput label="Total Seats" placeholder="e.g. 14" keyboardType="numeric" value={routeData.totalSeats} onChangeText={t=>setRouteData({...routeData,totalSeats:t})}/>
              </View>
              <View style={{flex:1,marginLeft:6}}>
                <StyledInput label="Price per Km (Rs.)" placeholder="e.g. 50" keyboardType="numeric" value={routeData.pricePerKm} onChangeText={t=>setRouteData({...routeData,pricePerKm:t})}/>
              </View>
            </View>

            <View style={s.actionRow}>
              <GhostBtn label="Cancel" onPress={()=>setIsEditingRoute(false)}/>
              <PrimaryBtn label="Save Routes" onPress={handleSaveRoute}/>
            </View>
          </>
        ) : (
          <>
            {user?.routes?.length > 0 ? user.routes.map((r,i) => (
              <View key={i} style={s.routeChip}>
                <MaterialIcons name="route" size={14} color={C.amber}/>
                <Text style={s.routeChipText}>{r.route||'—'} {r.via?`via ${r.via}`:''}</Text>
                <Text style={s.routeTime}>{r.startTime||'—'}</Text>
              </View>
            )) : <Text style={s.emptyText}>No routes set.</Text>}
            <View style={s.twoStatRow}>
              <View style={s.twoStatCard}><Text style={s.twoStatLabel}>Seats</Text><Text style={s.twoStatValue}>{user?.totalSeats||'—'}</Text></View>
              <View style={s.twoStatCard}><Text style={s.twoStatLabel}>Price/km</Text><Text style={s.twoStatValue}>{user?.pricePerKm?`Rs.${user.pricePerKm}`:'—'}</Text></View>
            </View>
          </>
        )}
      </Card>

      {/* Bank details */}
      <Card>
        <View style={s.cardHeaderRow}>
          <SectionTitle>Bank Details</SectionTitle>
          {!isEditingBank && <TouchableOpacity onPress={()=>setIsEditingBank(true)}><Text style={s.editLink}>Edit</Text></TouchableOpacity>}
        </View>

        {isEditingBank ? (
          <>
            {[
              {key:'bankName',      label:'Bank Name',      ph:'e.g. Commercial Bank'},
              {key:'accountName',   label:'Account Name',   ph:'e.g. John Doe'},
              {key:'accountNumber', label:'Account Number', ph:'e.g. 1234567890', kb:'numeric'},
              {key:'branchName',    label:'Branch Name',    ph:'e.g. Colombo 03'},
            ].map(f => (
              <StyledInput key={f.key} label={f.label} placeholder={f.ph}
                value={bankDetails[f.key]} onChangeText={t=>setBankDetails({...bankDetails,[f.key]:t})}
                keyboardType={f.kb||'default'}/>
            ))}
            <View style={s.actionRow}>
              <GhostBtn label="Cancel" onPress={()=>setIsEditingBank(false)}/>
              <PrimaryBtn label="Save" onPress={handleSaveBankDetails}/>
            </View>
          </>
        ) : (
          user?.bankDetails?.accountNumber ? (
            <View style={s.bankCard}>
              <MaterialIcons name="account-balance" size={18} color={C.amber}/>
              <View style={{ marginLeft:12, flex:1 }}>
                <Text style={s.bankName}>{user.bankDetails.bankName||'Bank'}</Text>
                <Text style={s.bankAccNum}>{user.bankDetails.accountNumber}</Text>
                <Text style={s.bankSub}>{user.bankDetails.accountName} · {user.bankDetails.branchName}</Text>
              </View>
            </View>
          ) : (
            <Text style={s.emptyText}>No bank details added yet.</Text>
          )
        )}
      </Card>
    </ScrollView>
  );

  const screens = { overview:renderOverview, tracking:renderTracking, passengers:renderPassengers, payments:renderPayments, settings:renderSettings };

  // ── Render ────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg}/>

      {/* Header */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <View style={s.headerAvatar}>
            <Text style={s.headerAvatarText}>{user?.name?.charAt(0)}</Text>
          </View>
          <View>
            <Text style={s.headerName}>{user?.name||'Driver'}</Text>
            <Text style={s.headerSub}>{user?.vehicleNumber||'No vehicle'} · {user?.vehicleType||''}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={()=>navigation.replace('Login')} style={s.logoutBtn}>
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
          const badge = tab.id==='payments' && pendingPaymentsCount > 0 ? pendingPaymentsCount : null;
          return (
            <TouchableOpacity key={tab.id} onPress={()=>setActiveTab(tab.id)} style={s.tabItem}>
              <View style={{ position:'relative' }}>
                <Ionicons name={tab.icon} size={22} color={active ? C.amber : C.textMuted}/>
                {badge ? (
                  <View style={s.tabBadge}><Text style={s.tabBadgeText}>{badge}</Text></View>
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
  safe:         { flex:1, backgroundColor:C.bg },
  header:       { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:18, paddingVertical:12, backgroundColor:C.surface, borderBottomWidth:1, borderBottomColor:C.border },
  headerLeft:   { flexDirection:'row', alignItems:'center', gap:12 },
  headerAvatar: { width:38, height:38, borderRadius:19, backgroundColor:C.amber, alignItems:'center', justifyContent:'center' },
  headerAvatarText: { color:C.bg, fontWeight:'800', fontSize:16 },
  headerName:   { color:C.text, fontWeight:'700', fontSize:15 },
  headerSub:    { color:C.textMuted, fontSize:12, marginTop:1 },
  logoutBtn:    { padding:8 },

  tabBar:       { flexDirection:'row', backgroundColor:C.surface, borderTopWidth:1, borderTopColor:C.border, paddingBottom: Platform.OS==='ios'?16:6, paddingTop:6 },
  tabItem:      { flex:1, alignItems:'center', justifyContent:'center', paddingVertical:4, position:'relative' },
  tabLabel:     { fontSize:9.5, color:C.textMuted, marginTop:3, fontWeight:'600', letterSpacing:0.3 },
  tabIndicator: { position:'absolute', top:-6, width:20, height:2.5, backgroundColor:C.amber, borderRadius:2 },
  tabBadge:     { position:'absolute', top:-4, right:-8, backgroundColor:C.red, borderRadius:7, minWidth:14, height:14, alignItems:'center', justifyContent:'center', paddingHorizontal:2 },
  tabBadgeText: { color:'white', fontSize:8, fontWeight:'800' },

  tabContent:   { padding:14, paddingBottom:20 },
  card:         { backgroundColor:C.surface, borderRadius:16, padding:16, marginBottom:12, borderWidth:1, borderColor:C.border },
  sectionTitle: { fontSize:15, fontWeight:'800', letterSpacing:0.3, marginBottom:12 },
  cardDesc:     { fontSize:12, color:C.textMuted, marginBottom:14, lineHeight:18 },
  cardHeaderRow:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:12 },
  editLink:     { color:C.amber, fontWeight:'700', fontSize:13 },

  statRow:      { flexDirection:'row', gap:8, marginBottom:12 },
  statCard:     { flex:1, backgroundColor:C.surface, borderRadius:14, padding:12, borderWidth:1, borderColor:C.border, alignItems:'flex-start' },
  statIcon:     { width:32, height:32, borderRadius:10, alignItems:'center', justifyContent:'center', marginBottom:8 },
  statValue:    { color:C.text, fontWeight:'800', fontSize:18 },
  statLabel:    { color:C.textMuted, fontSize:10, marginTop:2, fontWeight:'600' },

  summaryBox:   { borderRadius:14, padding:14, marginBottom:10, borderWidth:1 },
  summaryHeader:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:10 },
  summaryPeriod:{ color:C.text, fontWeight:'700', fontSize:15 },
  summaryRow:   { flexDirection:'row', justifyContent:'space-between', marginBottom:6 },
  summaryRowBorder: { borderTopWidth:1, borderTopColor:C.border2, paddingTop:8, marginTop:4 },
  summaryLabel: { color:C.textMuted, fontSize:13 },
  summaryValue: { color:C.text, fontWeight:'600', fontSize:13 },

  routeChip:    { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:C.surface2, borderRadius:10, paddingHorizontal:10, paddingVertical:9, marginBottom:6 },
  routeChipText:{ flex:1, color:C.text, fontSize:13, fontWeight:'500' },
  routeTime:    { color:C.amber, fontSize:12, fontWeight:'700' },

  miniChip:     { paddingHorizontal:8, paddingVertical:3, borderRadius:8 },
  miniChipText: { fontSize:11, fontWeight:'700' },

  listHeader:   { flexDirection:'row', alignItems:'center', gap:10, padding:16, backgroundColor:C.surface, borderBottomWidth:1, borderBottomColor:C.border },
  listHeaderTitle: { color:C.text, fontWeight:'700', fontSize:16 },

  passengerCard:{ backgroundColor:C.surface, borderRadius:14, padding:14, marginBottom:10, borderWidth:1, borderColor:C.border, borderLeftWidth:4, borderLeftColor:C.amber },
  passengerHeaderRow: { flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 },
  passengerLeft:{ flexDirection:'row', alignItems:'center', gap:10 },
  passengerAvatar: { width:36, height:36, borderRadius:18, backgroundColor:C.surface2, alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:C.border2 },
  passengerAvatarText: { color:C.text, fontWeight:'800', fontSize:15 },
  passengerName:{ color:C.text, fontWeight:'700', fontSize:14 },
  passengerSub: { color:C.textMuted, fontSize:12, marginTop:1 },
  passengerEmail:{ color:C.textMuted, fontSize:12, marginBottom:6 },

  locationBlock:{ paddingTop:8, borderTopWidth:1, borderTopColor:C.border2, gap:4 },
  locationRow:  { flexDirection:'row', alignItems:'flex-start', gap:6 },
  locationText: { color:C.textSub, fontSize:12, flex:1 },

  absenceBlock: { marginTop:10, paddingTop:10, borderTopWidth:1, borderTopColor:C.border2 },
  absenceBlockLabel: { color:C.textMuted, fontSize:10, fontWeight:'800', letterSpacing:0.8, marginBottom:6 },

  extraBookingRow:{ backgroundColor:C.surface2, borderRadius:10, padding:10, marginBottom:6 },
  extraBookingTop:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:4 },
  extraBookingDate:{ color:C.text, fontWeight:'600', fontSize:13 },
  extraLocationLine:{ paddingLeft:8, borderLeftWidth:2, borderLeftColor:C.border2, gap:2 },
  extraLocationText:{ color:C.textMuted, fontSize:12 },

  paymentPassengerRow: { flexDirection:'row', alignItems:'center', marginBottom:10 },
  paymentPassengerName: { color:C.text, fontWeight:'700', fontSize:14 },
  paymentPassengerEmail: { color:C.textMuted, fontSize:11 },
  paymentCard:  { backgroundColor:C.surface2, borderRadius:12, padding:12, marginBottom:10, borderWidth:1, borderColor:C.border2 },
  paymentThumb: { width:52, height:52, borderRadius:8, borderWidth:1, borderColor:C.border2 },
  paymentTitle: { color:C.text, fontWeight:'700', fontSize:13, marginBottom:2 },
  paymentDate:  { color:C.textMuted, fontSize:11 },
  paymentNote:  { color:C.textMuted, fontSize:11, fontStyle:'italic', marginTop:3 },
  reviewBtn:    { flex:1, paddingVertical:10, borderRadius:10, alignItems:'center', borderWidth:1 },
  reviewBtnText:{ fontWeight:'800', fontSize:13 },

  sysPayRow:    { flexDirection:'row', alignItems:'center', paddingVertical:10, borderBottomWidth:1, borderBottomColor:C.border },

  receiptPicker:{ height:110, backgroundColor:C.surface2, borderRadius:12, borderWidth:1.5, borderColor:C.border2, borderStyle:'dashed', alignItems:'center', justifyContent:'center', marginBottom:14, overflow:'hidden' },
  receiptPickerText: { color:C.textMuted, fontSize:13, marginTop:6 },
  receiptPreview:{ width:'100%', height:'100%', resizeMode:'cover' },

  trackingHeader:{ padding:16, backgroundColor:C.surface, borderBottomWidth:1, borderBottomColor:C.border, flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  trackingTitle: { color:C.text, fontWeight:'700', fontSize:15 },
  trackingSub:   { color:C.textMuted, fontSize:12, marginTop:2 },
  tripToggleBtn: { flexDirection:'row', alignItems:'center', gap:6, paddingHorizontal:12, paddingVertical:8, borderRadius:12, borderWidth:1 },
  tripToggleText:{ fontWeight:'800', fontSize:12 },
  liveDot:       { width:7, height:7, borderRadius:3.5 },
  mapPlaceholder:{ flex:1, alignItems:'center', justifyContent:'center', gap:12 },
  mapPlaceholderText: { color:C.textMuted, fontSize:14, textAlign:'center', paddingHorizontal:20 },
  vehicleMarker: { backgroundColor:C.amber, padding:7, borderRadius:18, borderWidth:2, borderColor:'white' },
  pinMarker:     { padding:5, borderRadius:18, borderWidth:2, borderColor:'white' },

  inputLabel:   { color:C.textSub, fontSize:12, fontWeight:'600', marginBottom:6 },
  input:        { backgroundColor:C.surface2, borderWidth:1, borderColor:C.border2, borderRadius:10, padding:12, fontSize:14, color:C.text },
  primaryBtn:   { flexDirection:'row', alignItems:'center', justifyContent:'center', paddingVertical:14, borderRadius:12, marginTop:4 },
  primaryBtnText:{ color:C.bg, fontWeight:'800', fontSize:14 },
  ghostBtn:     { paddingVertical:14, paddingHorizontal:16 },
  ghostBtnText: { color:C.textMuted, fontWeight:'600', fontSize:14 },
  actionRow:    { flexDirection:'row', justifyContent:'flex-end', alignItems:'center', gap:8, marginTop:4 },
  twoCol:       { flexDirection:'row' },

  routeEditCard:{ backgroundColor:C.surface2, borderRadius:14, padding:14, marginBottom:12, borderWidth:1, borderColor:C.border2, position:'relative' },
  removeRouteBtn:{ position:'absolute', top:10, right:10, zIndex:10, width:28, height:28, backgroundColor:C.redDim, borderRadius:14, alignItems:'center', justifyContent:'center' },
  addRouteBtn:  { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:6, paddingVertical:12, backgroundColor:C.surface2, borderRadius:12, borderWidth:1.5, borderColor:C.border2, borderStyle:'dashed', marginBottom:14 },
  addRouteBtnText:{ color:C.amber, fontWeight:'700', fontSize:14 },

  altBox:       { backgroundColor:C.blueDim, borderRadius:12, padding:12, marginBottom:14, borderWidth:1, borderColor:C.blue+'40' },
  altBoxTitle:  { color:C.blue, fontWeight:'700', fontSize:13, marginBottom:8 },
  altRow:       { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingVertical:8, paddingHorizontal:10, borderRadius:8, marginBottom:4 },
  altRowActive: { backgroundColor:C.blue+'30' },
  altRowText:   { color:C.textSub, fontSize:13 },
  altRowSub:    { color:C.blue, fontSize:12, fontWeight:'600' },

  infoItem:     { flexDirection:'row', alignItems:'center', paddingVertical:10, borderBottomWidth:1, borderBottomColor:C.border },
  infoItemLabel:{ color:C.textMuted, fontSize:11, fontWeight:'600', marginBottom:2 },
  infoItemValue:{ color:C.text, fontSize:14, fontWeight:'500' },

  bankCard:     { flexDirection:'row', alignItems:'center', backgroundColor:C.amberDim, borderRadius:12, padding:14, borderWidth:1, borderColor:C.amber+'40' },
  bankName:     { color:C.amber, fontWeight:'800', fontSize:14 },
  bankAccNum:   { color:C.text, fontFamily:Platform.OS==='ios'?'Courier':'monospace', fontSize:14, marginTop:2 },
  bankSub:      { color:C.textMuted, fontSize:11, marginTop:3 },

  twoStatRow:   { flexDirection:'row', gap:8, marginTop:10 },
  twoStatCard:  { flex:1, backgroundColor:C.surface2, borderRadius:12, padding:12 },
  twoStatLabel: { color:C.textMuted, fontSize:11, fontWeight:'600' },
  twoStatValue: { color:C.text, fontWeight:'800', fontSize:16, marginTop:4 },

  statusBadge:      { paddingHorizontal:10, paddingVertical:4, borderRadius:10 },
  statusBadgeText:  { fontSize:11, fontWeight:'800' },
  emptyText: { color: C.textMuted, fontStyle: 'italic', fontSize: 13, textAlign:'center', paddingVertical:8 },
  mapAttribution: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  mapAttributionText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 7,
    fontWeight: '600',
  },
});