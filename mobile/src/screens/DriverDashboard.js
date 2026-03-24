import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, TextInput, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Colors } from '../constants/Colors';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import axios from 'axios';
import * as Location from 'expo-location';
import { io } from 'socket.io-client';
import MapView, { Marker, UrlTile, Polyline } from 'react-native-maps';
import { geocodeAddress, fetchRoutePolyline } from '../services/mapServices';

const API_URL = process.env.EXPO_PUBLIC_API_URL + '/auth';

export default function DriverDashboard({ route, navigation }) {
  const { user: initialUser, token } = route.params || {};
  const [user, setUser] = useState(initialUser);
  const [passengers, setPassengers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditingRoute, setIsEditingRoute] = useState(false);
  const [routeData, setRouteData] = useState({
    routes: initialUser?.routes || [],
    totalSeats: initialUser?.totalSeats ? String(initialUser.totalSeats) : ''
  });

  const [isTripActive, setIsTripActive] = useState(initialUser?.isTripActive || false);
  const [currentLocation, setCurrentLocation] = useState(initialUser?.currentLocation || null);
  const socketRef = React.useRef(null);
  const locationSubRef = React.useRef(null);
  const [routePolylines, setRoutePolylines] = useState(
    (initialUser?.routes || []).filter(r => r.polyline).map(r => ({ points: JSON.parse(r.polyline) }))
  );

  useEffect(() => {
    fetchPassengers();
  }, []);

  useEffect(() => {
    if (isTripActive && user) {
      startTracking();
    } else {
      stopTracking();
    }

    return () => stopTracking();
  }, [isTripActive, user]);

  const startTracking = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Allow location access to broadcast your live position.');
      setIsTripActive(false);
      return;
    }

    socketRef.current = io(process.env.EXPO_PUBLIC_API_URL.replace('/api', ''), { transports: ['websocket'] });

    locationSubRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 10000,
        distanceInterval: 10,
      },
      (location) => {
        const loc = {
          lat: location.coords.latitude,
          lng: location.coords.longitude,
          timestamp: new Date()
        };
        setCurrentLocation(loc);
        
        if (socketRef.current) {
          socketRef.current.emit('driver_location_update', {
            driverId: user.uid,
            ...loc
          });
        }

        axios.put(`${API_URL}/update-location`, loc, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => {});
      }
    );
  };

  const stopTracking = () => {
    if (locationSubRef.current) {
      locationSubRef.current.remove();
      locationSubRef.current = null;
    }
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  };

  const toggleTrip = async () => {
    try {
      const endpoint = isTripActive ? 'end-trip' : 'start-trip';
      const response = await axios.put(`${API_URL}/${endpoint}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsTripActive(response.data.isTripActive);
      if (!response.data.isTripActive) {
        setCurrentLocation(null);
      }
    } catch (error) {
      Alert.alert('Error', 'Could not toggle trip state.');
    }
  };

  const fetchPassengers = async () => {
    try {
      const response = await axios.get(`${API_URL}/passengers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPassengers(response.data);
    } catch (error) {
      console.error('Failed to fetch passengers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    navigation.replace('Login');
  };

  const handleSaveRoute = async () => {
    try {
      // Geocode start/end of each route and fetch OSRM polylines
      const enrichedRoutes = await Promise.all((routeData.routes || []).map(async (r) => {
        if (!r.route) return r;
        const parts = r.route.split(/ - | to |,/i);
        if (parts.length < 2) return r;
        const [startGeo, endGeo] = await Promise.all([
          geocodeAddress(parts[0].trim()),
          geocodeAddress(parts[parts.length - 1].trim())
        ]);
        if (startGeo && endGeo) {
          const polylinePoints = await fetchRoutePolyline(startGeo, endGeo);
          return { ...r, polyline: polylinePoints ? JSON.stringify(polylinePoints) : undefined };
        }
        return r;
      }));

      const response = await axios.put(`${API_URL}/update-route`, {
        routes: enrichedRoutes,
        totalSeats: parseInt(routeData.totalSeats) || 0
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data);
      const polys = (response.data.routes || [])
        .filter(r => r.polyline)
        .map(r => ({ points: JSON.parse(r.polyline) }));
      setRoutePolylines(polys);
      setIsEditingRoute(false);
    } catch (error) {
      console.error('Failed to update route:', error);
      Alert.alert('Error', 'Failed to update route information');
    }
  };

  const getTodayStr = () => {
    const d = new Date();
    const tzOffset = d.getTimezoneOffset() * 60000;
    return (new Date(d - tzOffset)).toISOString().split('T')[0];
  };

  const renderPassenger = ({ item }) => {
    const todayAbsence = item.absences?.find(a => a.date === getTodayStr());
    const isAbsentToday = !!todayAbsence;
    const upcomingAbsences = item.absences?.filter(a => a.date > getTodayStr()).sort((a,b) => a.date.localeCompare(b.date)) || [];

    return (
      <View style={[styles.passengerCard, isAbsentToday && styles.passengerCardAbsent]}>
        <View style={styles.passengerHeaderRow}>
          <View style={styles.passengerHeader}>
            <MaterialIcons name="person" size={24} color={isAbsentToday ? 'red' : Colors.light.primary} />
            <Text style={[styles.passengerName, isAbsentToday && { color: 'red' }]}>{item.name}</Text>
          </View>
          {isAbsentToday && (
            <View style={styles.absentBadge}>
              <Text style={styles.absentBadgeText}>ABSENT {todayAbsence.period !== 'Both' && `(${todayAbsence.period.toUpperCase()})`}</Text>
            </View>
          )}
        </View>
        <View style={styles.passengerInfo}>
          <MaterialIcons name="phone" size={16} color="#666" style={styles.iconSpaced} />
          <Text style={styles.passengerText}>{item.phoneNumber}</Text>
        </View>
      <View style={styles.contactRow}>
        <MaterialIcons name="email" size={16} color={Colors.light.primary} />
        <Text style={styles.contactText}>{item.email}</Text>
      </View>

      {(item.pickupLocation || item.dropoffLocation) && (
        <View style={styles.locationContainer}>
          {item.pickupLocation && (
            <View style={styles.locationRow}>
              <MaterialIcons name="my-location" size={16} color="green" />
              <View style={styles.locationTextContainer}>
                <Text style={styles.locationLabel}>Pickup</Text>
                <Text style={styles.locationText}>{item.pickupLocation}</Text>
              </View>
            </View>
          )}
          {item.dropoffLocation && (
            <View style={styles.locationRow}>
              <MaterialIcons name="location-pin" size={16} color="red" />
              <View style={styles.locationTextContainer}>
                <Text style={styles.locationLabel}>Drop-off</Text>
                <Text style={styles.locationText}>{item.dropoffLocation}</Text>
              </View>
            </View>
          )}
        </View>
      )}

      {upcomingAbsences.length > 0 && (
        <View style={styles.upcomingAbsencesContainer}>
          <Text style={styles.upcomingAbsencesLabel}>Upcoming Absences</Text>
          <View style={styles.upcomingAbsencesList}>
            {upcomingAbsences.map(a => (
              <View key={a.date} style={styles.upcomingAbsenceChip}>
                <Text style={styles.upcomingAbsenceText}>{new Date(a.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} {a.period !== 'Both' && `(${a.period})`}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Driver Dashboard</Text>
          <TouchableOpacity onPress={handleLogout}>
            <MaterialIcons name="logout" size={24} color="white" />
          </TouchableOpacity>
        </View>
        <Text style={styles.welcomeText}>Welcome, {user?.name || 'Driver'}</Text>
      </View>

      <FlatList
        style={{ flex: 1 }}
        data={passengers}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Vehicle Details</Text>
              <View style={styles.infoRow}>
                <FontAwesome5 name="hashtag" size={18} color={Colors.light.primary} />
                <Text style={styles.infoText}>{user?.vehicleNumber || 'N/A'}</Text>
              </View>
              <View style={styles.infoRow}>
                <MaterialIcons name="directions-car" size={20} color={Colors.light.primary} />
                <Text style={styles.infoText}>{user?.vehicleType || 'N/A'}</Text>
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitleNoMargin}>Route Information</Text>
                {!isEditingRoute && (
                  <TouchableOpacity onPress={() => setIsEditingRoute(true)}>
                    <Text style={styles.editText}>Edit</Text>
                  </TouchableOpacity>
                )}
              </View>

              {isEditingRoute ? (
                <View style={styles.editSection}>
                  {routeData.routes.map((r, index) => (
                    <View key={index} style={styles.routeEditCard}>
                      <TouchableOpacity 
                        style={styles.removeRouteBtn}
                        onPress={() => {
                          const newRoutes = [...routeData.routes];
                          newRoutes.splice(index, 1);
                          setRouteData({...routeData, routes: newRoutes});
                        }}
                      >
                        <MaterialIcons name="close" size={20} color="red" />
                      </TouchableOpacity>
                      <Text style={styles.inputLabel}>Route (e.g., Colombo - Kandy)</Text>
                      <TextInput style={styles.input} value={r.route} onChangeText={t => {
                          const newRoutes = [...routeData.routes];
                          newRoutes[index].route = t;
                          setRouteData({...routeData, routes: newRoutes});
                      }} placeholder="Enter route" />
                      
                      <Text style={styles.inputLabel}>Start Time (e.g., 08:00 AM)</Text>
                      <TextInput style={styles.input} value={r.startTime} onChangeText={t => {
                          const newRoutes = [...routeData.routes];
                          newRoutes[index].startTime = t;
                          setRouteData({...routeData, routes: newRoutes});
                      }} placeholder="Enter start time" />
                    </View>
                  ))}
                  
                  <TouchableOpacity 
                    style={styles.addRouteBtn}
                    onPress={() => setRouteData({...routeData, routes: [...routeData.routes, { route: '', startTime: '' }]})}
                  >
                    <Text style={styles.addRouteBtnText}>+ Add Route</Text>
                  </TouchableOpacity>

                  <Text style={[styles.inputLabel, {marginTop: 15}]}>Total Seats</Text>
                  <TextInput style={styles.input} value={routeData.totalSeats} onChangeText={t => setRouteData({...routeData, totalSeats: t})} placeholder="Enter total seats" keyboardType="numeric" />
                  
                  <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsEditingRoute(false)}>
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.saveBtn} onPress={handleSaveRoute}>
                      <Text style={styles.saveBtnText}>Save</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.viewSection}>
                  {(user?.routes && user.routes.length > 0) ? user.routes.map((r, index) => (
                    <View key={index} style={styles.routeViewCard}>
                      <View style={styles.infoRow}>
                        <MaterialIcons name="map" size={20} color={Colors.light.primary} />
                        <Text style={styles.infoText}>{r.route || 'Not set'}</Text>
                      </View>
                      <View style={styles.infoRow}>
                        <MaterialIcons name="access-time" size={20} color={Colors.light.primary} />
                        <Text style={styles.infoText}>{r.startTime || 'Not set'}</Text>
                      </View>
                    </View>
                  )) : (
                    <Text style={styles.emptyText}>No routes set</Text>
                  )}
                  <View style={[styles.infoRow, {marginTop: 10, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 10}]}>
                    <MaterialIcons name="event-seat" size={20} color={Colors.light.primary} />
                    <Text style={[styles.infoText, {fontWeight: 'bold'}]}>{user?.totalSeats ? `${user.totalSeats} seats total` : 'Total seats not set'}</Text>
                  </View>
                </View>
              )}
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitleNoMargin}>Live Trip Tracking</Text>
                <TouchableOpacity 
                  style={[styles.startTripBtn, isTripActive ? styles.endTripBtn : {}]}
                  onPress={toggleTrip}
                >
                  <Text style={styles.startTripBtnText}>{isTripActive ? 'End Trip' : 'Start Trip'}</Text>
                </TouchableOpacity>
              </View>

              {isTripActive ? (
                <View style={styles.mapContainer}>
                  {currentLocation ? (
                    <MapView 
                      style={styles.map} 
                      region={{
                        latitude: currentLocation.lat,
                        longitude: currentLocation.lng,
                        latitudeDelta: 0.01,
                        longitudeDelta: 0.01
                      }}
                      mapType={Platform.OS === "android" ? "none" : "standard"}
                    >
                      {Platform.OS === 'android' && (
                        <UrlTile
                          urlTemplate="https://a.tile.openstreetmap.org/{z}/{x}/{y}.png"
                          maximumZ={19}
                          flipY={false}
                        />
                      )}
                      {/* Driver live position */}
                      <Marker coordinate={{latitude: currentLocation.lat, longitude: currentLocation.lng}}>
                        <View style={styles.markerContainer}>
                          <View style={styles.markerDot} />
                        </View>
                      </Marker>
                      {/* Route polylines */}
                      {routePolylines.map((poly, i) => (
                        <Polyline
                          key={i}
                          coordinates={poly.points}
                          strokeColor="#3B82F6"
                          strokeWidth={3}
                        />
                      ))}
                      {/* Passenger pickup & dropoff markers */}
                      {passengers.map(p => (
                        <React.Fragment key={p._id}>
                          {p.pickupLocation?.lat && (
                            <Marker
                              coordinate={{ latitude: p.pickupLocation.lat, longitude: p.pickupLocation.lng }}
                              title={`${p.name}: Pickup`}
                              pinColor="green"
                            />
                          )}
                          {p.dropoffLocation?.lat && (
                            <Marker
                              coordinate={{ latitude: p.dropoffLocation.lat, longitude: p.dropoffLocation.lng }}
                              title={`${p.name}: Drop-off`}
                              pinColor="red"
                            />
                          )}
                        </React.Fragment>
                      ))}
                    </MapView>
                  ) : (
                    <View style={styles.mapLoading}>
                      <ActivityIndicator size="large" color={Colors.light.primary} />
                      <Text style={styles.mapLoadingText}>Acquiring GPS...</Text>
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.mapInactive}>
                  <Text style={styles.mapInactiveText}>Trip is currently inactive.</Text>
                </View>
              )}
            </View>

            {user?.totalSeats && !loading && (
              <View style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitleNoMargin}>Today's Ride Summary</Text>
                  <View style={styles.dateBadge}>
                    <Text style={styles.dateBadgeText}>{getTodayStr()}</Text>
                  </View>
                </View>
                
                {['Morning', 'Evening'].map(period => {
                  const assigned = passengers.length;
                  const absent = passengers.filter(p => p.absences?.some(a => a.date === getTodayStr() && (a.period === period || a.period === 'Both'))).length;
                  const extra = passengers.reduce((sum, p) => sum + (p.extraBookings?.filter(eb => eb.date === getTodayStr() && (eb.period === period || eb.period === 'Both')).reduce((s, eb) => s + eb.seats, 0) || 0), 0);
                  const present = assigned - absent;
                  const free = user.totalSeats - present - extra;
                  const totalOccupied = present + extra;
                  const overbooked = totalOccupied > user.totalSeats;

                  return (
                    <View key={period} style={[styles.summaryBox, overbooked ? styles.summaryBoxRed : styles.summaryBoxGray]}>
                      <View style={styles.summaryHeader}>
                        <Text style={styles.summaryPeriodTitle}>{period === 'Morning' ? '🌅' : '🌆'} {period} Route</Text>
                        <View style={[styles.statusBadge, overbooked ? styles.statusBadgeRed : styles.statusBadgeGreen]}>
                          <Text style={[styles.statusBadgeText, overbooked ? styles.statusBadgeTextRed : styles.statusBadgeTextGreen]}>
                            {overbooked ? `OVERBOOKED (${Math.abs(free)})` : `${free} SEATS FREE`}
                          </Text>
                        </View>
                      </View>
                      
                      <View style={styles.summaryStatRow}>
                        <Text style={styles.summaryStatLabel}>Active Passengers</Text>
                        <Text style={styles.summaryStatValue}>{present} <Text style={styles.summaryStatDetail}>({assigned} tot, {absent} abs)</Text></Text>
                      </View>
                      <View style={styles.summaryStatRow}>
                        <Text style={styles.summaryStatLabel}>Extra Friend Bookings</Text>
                        <Text style={[styles.summaryStatValue, {color: Colors.light.primary}]}>{extra}</Text>
                      </View>
                      <View style={[styles.summaryStatRow, styles.summaryStatRowTop]}>
                        <Text style={[styles.summaryStatLabel, {fontWeight: 'bold', color: '#333'}]}>Total Occupancy</Text>
                        <Text style={[styles.summaryStatValue, {fontWeight: 'bold', color: overbooked ? '#d32f2f' : '#333'}]}>{totalOccupied} / {user.totalSeats}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            <View style={styles.sectionHeaderContainer}>
              <Text style={styles.sectionTitle}>My Passengers</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{passengers.length}</Text>
              </View>
            </View>
            
            {loading && <ActivityIndicator size="large" color={Colors.light.primary} style={{ marginTop: 20 }} />}
            {!loading && passengers.length === 0 && (
              <Text style={styles.emptyText}>No passengers have selected your vehicle yet.</Text>
            )}
          </>
        }
        renderItem={renderPassenger}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.secondary },
  header: { backgroundColor: Colors.light.primary, padding: 20, paddingTop: 50, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: 'white' },
  welcomeText: { fontSize: 18, color: '#e6f4ea', marginTop: 10 },
  content: { padding: 20, paddingTop: 10, paddingBottom: 40 },
  card: { backgroundColor: 'white', borderRadius: 15, padding: 20, marginBottom: 20, elevation: 2 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 10 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 10 },
  cardTitleNoMargin: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  editText: { color: Colors.light.primary, fontWeight: 'bold', fontSize: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  
  dateBadge: { backgroundColor: '#f0f0f0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 15 },
  dateBadgeText: { fontSize: 12, fontWeight: 'bold', color: '#555' },
  summaryBox: { padding: 15, borderRadius: 10, borderWidth: 1, marginBottom: 15 },
  summaryBoxGray: { backgroundColor: '#f8f9fa', borderColor: '#eee' },
  summaryBoxRed: { backgroundColor: '#ffebee', borderColor: '#ffcdd2' },
  summaryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  summaryPeriodTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusBadgeGreen: { backgroundColor: '#e8f5e9' },
  statusBadgeRed: { backgroundColor: '#ffcdd2' },
  statusBadgeText: { fontSize: 10, fontWeight: 'bold' },
  statusBadgeTextGreen: { color: '#2e7d32' },
  statusBadgeTextRed: { color: '#c62828' },
  summaryStatRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  summaryStatRowTop: { borderTopWidth: 1, borderTopColor: '#ddd', paddingTop: 6, marginTop: 4 },
  summaryStatLabel: { fontSize: 13, color: '#666' },
  summaryStatValue: { fontSize: 14, fontWeight: 'bold', color: '#444' },
  summaryStatDetail: { fontSize: 12, fontWeight: 'normal', color: '#999' },
  infoText: { fontSize: 16, color: '#555', marginLeft: 10 },
  
  editSection: { marginTop: 5 },
  viewSection: { marginTop: 5 },
  routeEditCard: { backgroundColor: '#f9f9f9', padding: 15, borderRadius: 10, marginBottom: 15, borderWidth: 1, borderColor: '#eee', position: 'relative' },
  removeRouteBtn: { position: 'absolute', top: 10, right: 10, zIndex: 10, padding: 5 },
  routeViewCard: { backgroundColor: '#f9f9f9', padding: 15, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: '#eee' },
  addRouteBtn: { alignSelf: 'center', marginBottom: 15, paddingVertical: 5 },
  addRouteBtnText: { color: Colors.light.primary, fontWeight: 'bold', fontSize: 16 },
  inputLabel: { fontSize: 14, color: '#666', marginBottom: 5 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 16, marginBottom: 15, backgroundColor: 'white' },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 },
  cancelBtn: { padding: 10, marginRight: 10 },
  cancelBtnText: { color: '#666', fontWeight: 'bold', fontSize: 16 },
  saveBtn: { backgroundColor: Colors.light.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  saveBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  locationContainer: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#eee' },
  locationRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  locationTextContainer: { marginLeft: 8 },
  locationLabel: { fontSize: 12, fontWeight: 'bold', color: '#666' },
  locationText: { fontSize: 13, color: '#444' },
  
  sectionHeaderContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, marginTop: 10 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  badge: { backgroundColor: Colors.light.primary, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 10 },
  badgeText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  
  passengerCard: { backgroundColor: 'white', borderRadius: 12, padding: 15, marginBottom: 12, elevation: 1, borderLeftWidth: 4, borderLeftColor: Colors.light.primary },
  passengerCardAbsent: { borderLeftColor: 'red', backgroundColor: '#fffcfc' },
  passengerHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  passengerHeader: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.light.secondary, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarAbsent: { backgroundColor: '#ffeaea' },
  avatarText: { fontSize: 18, fontWeight: 'bold', color: Colors.light.primary },
  passengerName: { fontSize: 16, fontWeight: 'bold', color: '#333', marginLeft: 10 },
  passengerDate: { fontSize: 12, color: '#888', marginTop: 2 },
  absentBadge: { backgroundColor: '#ffeaea', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#ffcccc' },
  absentBadgeText: { color: 'red', fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5 },
  passengerInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 5, marginLeft: 34 },
  iconSpaced: { marginRight: 8 },
  passengerText: { fontSize: 14, color: '#666' },
  emptyText: { textAlign: 'center', color: '#777', fontSize: 16, marginTop: 20, fontStyle: 'italic' },
  upcomingAbsencesContainer: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#eee' },
  upcomingAbsencesLabel: { fontSize: 12, fontWeight: 'bold', color: '#888', textTransform: 'uppercase', marginBottom: 6 },
  upcomingAbsencesList: { flexDirection: 'row', flexWrap: 'wrap' },
  upcomingAbsenceChip: { backgroundColor: '#fff3e0', borderWidth: 1, borderColor: '#ffe0b2', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginRight: 6, marginBottom: 4 },
  upcomingAbsenceText: { color: '#e65100', fontSize: 11, fontWeight: 'bold' }
});
