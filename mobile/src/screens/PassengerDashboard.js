import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ScrollView, Image, ActivityIndicator } from 'react-native';
import axios from 'axios';
import { Colors } from '../constants/Colors';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { io } from 'socket.io-client';
import MapView, { Marker, UrlTile, Polyline } from 'react-native-maps';
import { geocodeAddress, fetchRouteAlternatives, reverseGeocode } from '../services/mapServices';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';

export default function PassengerDashboard({ route, navigation }) {
  const { user, token } = route.params || {};
  const [driverProfile, setDriverProfile] = useState(null);
  const [currentUser, setCurrentUser] = useState(user);
  const [isEditingLocations, setIsEditingLocations] = useState(false);
  const [locationData, setLocationData] = useState({
    pickupLocation: user?.pickupLocation?.address || user?.pickupLocation || '',
    dropoffLocation: user?.dropoffLocation?.address || user?.dropoffLocation || ''
  });
  const [absences, setAbsences] = useState(user?.absences || []);
  const [selectedDateType, setSelectedDateType] = useState('Today');
  const [specificDate, setSpecificDate] = useState('');
  const [newAbsencePeriod, setNewAbsencePeriod] = useState('Both');

  const [extraBookings, setExtraBookings] = useState(user?.extraBookings || []);
  const [bookingDateType, setBookingDateType] = useState('Today');
  const [bookingSpecificDate, setBookingSpecificDate] = useState('');
  const [bookingPeriod, setBookingPeriod] = useState('Morning');
  const [bookSeats, setBookSeats] = useState('1');
  const [availableSeatsCheck, setAvailableSeatsCheck] = useState(null);
  const [extraPickup, setExtraPickup] = useState('');
  const [extraDropoff, setExtraDropoff] = useState('');
  const [extraDistance, setExtraDistance] = useState(null);
  const [extraPrice, setExtraPrice] = useState(null);
  const [calculatingPrice, setCalculatingPrice] = useState(false);
  const [mapPickingMode, setMapPickingMode] = useState(null); // 'pickup' | 'dropoff' | null

  const [driverLocation, setDriverLocation] = useState(null);
  const [isDriverActive, setIsDriverActive] = useState(false);
  const socketRef = React.useRef(null);

  // Payment state
  const [payments, setPayments] = useState([]);
  const [paymentMonth, setPaymentMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentImage, setPaymentImage] = useState(null); // { uri, type, name }
  const [paymentUploading, setPaymentUploading] = useState(false);

  useEffect(() => {
    fetchDriverDetails();
    fetchPayments();
  }, []);

  useEffect(() => {
    if (driverProfile && driverProfile.isTripActive) {
      setIsDriverActive(true);
      if (driverProfile.currentLocation) {
        setDriverLocation(driverProfile.currentLocation);
      }

      socketRef.current = io(process.env.EXPO_PUBLIC_API_URL.replace('/api', ''), { transports: ['websocket'] });
      
      socketRef.current.on(`live_location_${driverProfile.uid}`, (loc) => {
        setIsDriverActive(true);
        setDriverLocation(loc);
      });
    } else {
      setIsDriverActive(false);
      setDriverLocation(null);
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [driverProfile]);

  const fetchDriverDetails = async () => {
    try {
      const response = await axios.get(`${process.env.EXPO_PUBLIC_API_URL}/auth/my-driver`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDriverProfile(response.data);
    } catch (error) {
      console.error('Failed to fetch driver details:', error);
    }
  };

  const fetchPayments = async () => {
    try {
      const response = await axios.get(
        `${process.env.EXPO_PUBLIC_API_URL.replace('/api', '')}/api/payments/my-payments`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPayments(response.data || []);
    } catch (err) {
      console.error('Failed to fetch payments:', err);
    }
  };

  const pickReceiptImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { Alert.alert('Permission needed', 'Please allow media access.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setPaymentImage({ uri: asset.uri, type: asset.mimeType || 'image/jpeg', name: asset.fileName || 'receipt.jpg' });
    }
  };

  const uploadPayment = async () => {
    if (!paymentImage || !paymentAmount || !paymentMonth) {
      Alert.alert('Missing fields', 'Please pick a month, enter amount, and select a receipt image.');
      return;
    }
    setPaymentUploading(true);
    try {
      const formData = new FormData();
      formData.append('month', paymentMonth);
      formData.append('amount', paymentAmount);
      formData.append('receipt', { uri: paymentImage.uri, type: paymentImage.type, name: paymentImage.name });
      const response = await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL.replace('/api', '')}/api/payments/upload`,
        formData,
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } }
      );
      setPayments(response.data.payments ? [...response.data.payments].sort((a,b) => b.month.localeCompare(a.month)) : []);
      setPaymentImage(null);
      setPaymentAmount('');
      Alert.alert('Success', 'Payment receipt submitted!');
    } catch (err) {
      console.error('Upload payment failed:', err);
      Alert.alert('Error', 'Failed to upload payment. Check Cloudinary credentials.');
    } finally {
      setPaymentUploading(false);
    }
  };

  const handleSaveLocations = async () => {
    try {
      const [pickupGeo, dropoffGeo] = await Promise.all([
        geocodeAddress(locationData.pickupLocation),
        geocodeAddress(locationData.dropoffLocation)
      ]);
      const pickupPayload = pickupGeo
        ? { address: locationData.pickupLocation, lat: pickupGeo.lat, lng: pickupGeo.lng }
        : locationData.pickupLocation;
      const dropoffPayload = dropoffGeo
        ? { address: locationData.dropoffLocation, lat: dropoffGeo.lat, lng: dropoffGeo.lng }
        : locationData.dropoffLocation;

      const response = await axios.put(`${process.env.EXPO_PUBLIC_API_URL}/auth/update-locations`, {
        pickupLocation: pickupPayload,
        dropoffLocation: dropoffPayload
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCurrentUser(response.data);
      setIsEditingLocations(false);
    } catch (error) {
      console.error('Failed to update locations:', error);
      Alert.alert('Error', 'Failed to update locations');
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
      const response = await axios.put(`${process.env.EXPO_PUBLIC_API_URL}/auth/update-absences`, {
        absences: newAbsences
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCurrentUser(response.data);
      setAbsences(response.data.absences || []);
      setExtraBookings(response.data.extraBookings || []);
    } catch (error) {
      console.error('Failed to update absences:', error);
      Alert.alert('Error', 'Failed to update absences');
    }
  };

  const removeAbsence = async (dateStr) => {
    const newAbsences = absences.filter(a => a.date !== dateStr);
    try {
      const response = await axios.put(`${process.env.EXPO_PUBLIC_API_URL}/auth/update-absences`, {
        absences: newAbsences
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCurrentUser(response.data);
      setAbsences(response.data.absences || []);
      setExtraBookings(response.data.extraBookings || []);
    } catch (error) {
      console.error('Failed to remove absence:', error);
      Alert.alert('Error', 'Failed to remove absence');
    }
  };

  const handleSubmitAbsence = () => {
    let dateStr = '';
    if (selectedDateType === 'Today') dateStr = getDateStr(0);
    else if (selectedDateType === 'Tomorrow') dateStr = getDateStr(1);
    else {
      if (!specificDate) {
        Alert.alert('Missing Date', 'Please enter a specific date.');
        return;
      }
      const regex = /^\d{4}-\d{2}-\d{2}$/;
      if (!regex.test(specificDate)) {
        Alert.alert('Invalid Date', 'Please format as YYYY-MM-DD');
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
      if (!bookingSpecificDate) { Alert.alert('Missing Date', 'Please select a specific date.'); return; }
      const regex = /^\d{4}-\d{2}-\d{2}$/;
      if (!regex.test(bookingSpecificDate)) { Alert.alert('Invalid Date', 'Please format as YYYY-MM-DD'); return; }
      dateStr = bookingSpecificDate;
    }
    try {
      const { data } = await axios.get(`${process.env.EXPO_PUBLIC_API_URL}/auth/ride-availability?date=${dateStr}&period=${bookingPeriod}`, { headers: { Authorization: `Bearer ${token}` } });
      setAvailableSeatsCheck({ ...data, dateStr, period: bookingPeriod });
    } catch (err) {
      console.error(err); Alert.alert('Error', 'Could not check availability. Has driver configured seats?');
    }
  };

  const calculateExtraPrice = async () => {
    if (!extraPickup || !extraDropoff) {
      Alert.alert('Missing Info', 'Please enter both pickup and drop-off locations.');
      return;
    }
    setCalculatingPrice(true);
    try {
      const [startGeo, endGeo] = await Promise.all([
        geocodeAddress(extraPickup),
        geocodeAddress(extraDropoff)
      ]);
      if (startGeo && endGeo) {
        const alts = await fetchRouteAlternatives(startGeo, endGeo);
        if (alts && alts.length > 0) {
          const distKm = alts[0].distance / 1000;
          setExtraDistance(distKm);
          setExtraPrice(distKm * (availableSeatsCheck?.pricePerKm || 0));
        } else {
          Alert.alert('Error', 'Could not calculate distance between these locations.');
        }
      } else {
        Alert.alert('Error', 'Could not find locations. Try adding more details (e.g., City).');
      }
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Error calculating price.');
    } finally {
      setCalculatingPrice(false);
    }
  };

  const confirmExtraBooking = async () => {
    if (!availableSeatsCheck) return;
    const seats = parseInt(bookSeats, 10);
    if (isNaN(seats) || seats < 1 || seats > availableSeatsCheck.availableSeats) { Alert.alert('Error', 'Invalid or unavailable seat count'); return; }
    if (!extraPickup || !extraDropoff || extraPrice === null) {
      Alert.alert('Missing Info', 'Please enter locations and calculate the price first.');
      return;
    }
    try {
      const newBookings = [...extraBookings, { 
        date: availableSeatsCheck.dateStr, 
        period: availableSeatsCheck.period, 
        seats,
        pickupLocation: { address: extraPickup },
        dropoffLocation: { address: extraDropoff },
        distanceKm: extraDistance,
        price: extraPrice
      }];
      const { data } = await axios.put(`${process.env.EXPO_PUBLIC_API_URL}/auth/update-extra-bookings`, { extraBookings: newBookings }, { headers: { Authorization: `Bearer ${token}` } });
      setExtraBookings(data.extraBookings || []);
      setAvailableSeatsCheck(null);
      setBookSeats('1');
      setExtraPickup('');
      setExtraDropoff('');
      setExtraPrice(null);
      setExtraDistance(null);
      Alert.alert('Success', 'Successfully booked extra seats!');
    } catch (err) {
      console.error(err); Alert.alert('Error', 'Could not complete booking');
    }
  };

  const cancelExtraBooking = async (index) => {
    try {
      const newBookings = [...extraBookings]; newBookings.splice(index, 1);
      const { data } = await axios.put(`${process.env.EXPO_PUBLIC_API_URL}/auth/update-extra-bookings`, { extraBookings: newBookings }, { headers: { Authorization: `Bearer ${token}` } });
      setExtraBookings(data.extraBookings || []);
    } catch (err) { console.error(err); }
  };

  const handleLogout = () => {
    navigation.replace('Login');
  };

  const handleUseCurrentLocation = async (type) => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Permission to access location was denied');
      return;
    }

    try {
      let location = await Location.getCurrentPositionAsync({});
      const address = await reverseGeocode(location.coords.latitude, location.coords.longitude);
      if (address) {
        setLocationData(prev => ({
          ...prev,
          [type + 'Location']: address
        }));
      } else {
        Alert.alert('Error', 'Could not determine address for your current location.');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to get current location.');
    }
  };

  const handleMapPress = async (e) => {
    if (mapPickingMode) {
      const { latitude, longitude } = e.nativeEvent.coordinate;
      const address = await reverseGeocode(latitude, longitude);
      if (address) {
        setLocationData(prev => ({
          ...prev,
          [mapPickingMode + 'Location']: address
        }));
        setMapPickingMode(null);
      }
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Passenger Dashboard</Text>
          <TouchableOpacity onPress={handleLogout}>
            <MaterialIcons name="logout" size={24} color="white" />
          </TouchableOpacity>
        </View>
        <Text style={styles.welcomeText}>Welcome, {user?.name || 'Passenger'}</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Personal Info</Text>
          <View style={styles.infoRow}>
            <MaterialIcons name="phone" size={20} color={Colors.light.primary} />
            <Text style={styles.infoText}>{currentUser?.phoneNumber || 'N/A'}</Text>
          </View>
          <View style={styles.infoRow}>
            <MaterialIcons name="email" size={20} color={Colors.light.primary} />
            <Text style={styles.infoText}>{currentUser?.email || 'N/A'}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Trip Details</Text>
          <View style={styles.infoRow}>
            <FontAwesome5 name="hashtag" size={18} color={Colors.light.primary} />
            <Text style={styles.infoText}>Target Vehicle: <Text style={{fontWeight: 'bold'}}>{currentUser?.chosenVehicleNumber || 'N/A'}</Text></Text>
          </View>
          
          {driverProfile && (
            <View style={styles.driverSection}>
              <Text style={styles.miniTitle}>Driver</Text>
              <View style={styles.infoRow}>
                <MaterialIcons name="person" size={20} color={Colors.light.primary} />
                <Text style={styles.infoText}>{driverProfile.name}</Text>
              </View>
              <View style={styles.infoRow}>
                <MaterialIcons name="phone" size={20} color={Colors.light.primary} />
                <Text style={styles.infoText}>{driverProfile.phoneNumber}</Text>
              </View>
              <View style={styles.infoRow}>
                <MaterialIcons name="directions-car" size={20} color={Colors.light.primary} />
                <Text style={[styles.infoText, {textTransform: 'capitalize'}]}>{driverProfile.vehicleType}</Text>
              </View>
              
              <Text style={[styles.miniTitle, {marginTop: 15}]}>Route Information</Text>
              {(driverProfile.routes && driverProfile.routes.length > 0) ? driverProfile.routes.map((r, i) => (
                <View key={i} style={styles.routeViewCard}>
                  <Text style={styles.routeIndexText}>Route {i + 1}</Text>
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
                 <Text style={[styles.infoText, {fontStyle: 'italic', marginBottom: 10}]}>No routes recorded</Text>
              )}
              <View style={[styles.infoRow, {borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 10, marginTop: 5}]}>
                <MaterialIcons name="event-seat" size={20} color={Colors.light.primary} />
                <Text style={styles.infoText}>{driverProfile.totalSeats || 'Not set'} seats configured</Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitleNoMargin}>Live Trip Tracking</Text>
            {isDriverActive && (
              <View style={styles.liveBadgeBadge}>
                <View style={styles.liveBadgeDot} />
                <Text style={styles.liveBadgeText}>LIVE</Text>
              </View>
            )}
          </View>

          {isDriverActive ? (
            <View style={styles.mapContainer}>
              {driverLocation ? (
                <MapView 
                  style={styles.map} 
                  region={{
                    latitude: driverLocation.lat,
                    longitude: driverLocation.lng,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01
                  }}
                  mapType={Platform.OS === "android" ? "none" : "standard"}
                  onPress={handleMapPress}
                >
                  {Platform.OS === 'android' && (
                    <UrlTile
                      urlTemplate="https://a.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      maximumZ={19}
                      flipY={false}
                    />
                  )}
                  {/* Driver live position */}
                  <Marker coordinate={{latitude: driverLocation.lat, longitude: driverLocation.lng}} zIndex={1000}>
                    <View style={{ backgroundColor: '#f59e0b', padding: 6, borderRadius: 20, borderWidth: 2, borderColor: 'white', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.4, shadowRadius: 4, elevation: 6 }}>
                      <FontAwesome5 name="bus" size={16} color="white" />
                    </View>
                  </Marker>
                  {/* Passenger's own pickup & dropoff pins */}
                  {currentUser?.pickupLocation?.lat && (
                    <Marker
                      coordinate={{ latitude: currentUser.pickupLocation.lat, longitude: currentUser.pickupLocation.lng }}
                      title="Your Pickup"
                    >
                      <View style={{ backgroundColor: '#10b981', padding: 5, borderRadius: 20, borderWidth: 2, borderColor: 'white', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3, elevation: 5 }}>
                        <MaterialIcons name="person-pin-circle" size={20} color="white" />
                      </View>
                    </Marker>
                  )}
                  {currentUser?.dropoffLocation?.lat && (
                    <Marker
                      coordinate={{ latitude: currentUser.dropoffLocation.lat, longitude: currentUser.dropoffLocation.lng }}
                      title="Your Drop-off"
                    >
                      <View style={{ backgroundColor: '#ef4444', padding: 5, borderRadius: 20, borderWidth: 2, borderColor: 'white', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3, elevation: 5 }}>
                        <MaterialIcons name="location-on" size={20} color="white" />
                      </View>
                    </Marker>
                  )}
                  
                  {/* Driver's Planned Routes */}
                  {driverProfile?.routes && driverProfile.routes.map((r, i) => {
                    if (r.polyline) {
                      const points = JSON.parse(r.polyline);
                      return (
                        <Polyline
                          key={`route-${i}`}
                          coordinates={points}
                          strokeColor="#3B82F6"
                          strokeWidth={4}
                        />
                      );
                    }
                    return null;
                  })}
                </MapView>
              ) : (
                <View style={styles.mapLoading}>
                  <ActivityIndicator size="large" color={Colors.light.primary} />
                  <Text style={styles.mapLoadingText}>Connecting to driver GPS...</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.mapInactive}>
              <Text style={styles.mapInactiveText}>{driverProfile ? "Driver has not started the trip." : "No driver assigned."}</Text>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitleNoMargin}>My Trip Locations</Text>
            {!isEditingLocations && (
              <TouchableOpacity onPress={() => setIsEditingLocations(true)}>
                <Text style={styles.editText}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>

          {isEditingLocations ? (
            <View style={styles.editSection}>
              <Text style={styles.inputLabel}>Pickup Location</Text>
              <View style={styles.inputWithButtons}>
                <TextInput style={[styles.input, {flex: 1}]} value={locationData.pickupLocation} onChangeText={t => setLocationData({...locationData, pickupLocation: t})} placeholder="e.g., Dematagoda Station" />
                <TouchableOpacity style={styles.iconBtn} onPress={() => handleUseCurrentLocation('pickup')}>
                  <MaterialIcons name="my-location" size={20} color={Colors.light.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.iconBtn, mapPickingMode === 'pickup' && styles.iconBtnActive]} onPress={() => setMapPickingMode('pickup')}>
                  <MaterialIcons name="map" size={20} color={mapPickingMode === 'pickup' ? 'white' : Colors.light.primary} />
                </TouchableOpacity>
              </View>
              
              <Text style={styles.inputLabel}>Drop-off Location</Text>
              <View style={styles.inputWithButtons}>
                <TextInput style={[styles.input, {flex: 1}]} value={locationData.dropoffLocation} onChangeText={t => setLocationData({...locationData, dropoffLocation: t})} placeholder="e.g., Kandy Town" />
                <TouchableOpacity style={styles.iconBtn} onPress={() => handleUseCurrentLocation('dropoff')}>
                  <MaterialIcons name="my-location" size={20} color={Colors.light.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.iconBtn, mapPickingMode === 'dropoff' && styles.iconBtnActive]} onPress={() => setMapPickingMode('dropoff')}>
                  <MaterialIcons name="map" size={20} color={mapPickingMode === 'dropoff' ? 'white' : Colors.light.primary} />
                </TouchableOpacity>
              </View>

              {mapPickingMode && (
                <View style={[styles.mapContainer, { height: 250, borderWidth: 2, borderColor: Colors.light.primary }]}>
                  <MapView
                    style={styles.map}
                    initialRegion={{
                      latitude: currentUser?.pickupLocation?.lat || 6.9271,
                      longitude: currentUser?.pickupLocation?.lng || 79.8612,
                      latitudeDelta: 0.05,
                      longitudeDelta: 0.05
                    }}
                    onPress={handleMapPress}
                    mapType={Platform.OS === "android" ? "none" : "standard"}
                  >
                    {Platform.OS === 'android' && (
                      <UrlTile
                        urlTemplate="https://a.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        maximumZ={19}
                        flipY={false}
                      />
                    )}
                    {currentUser?.pickupLocation?.lat && (
                      <Marker
                        coordinate={{ latitude: currentUser.pickupLocation.lat, longitude: currentUser.pickupLocation.lng }}
                        title="Current Pickup"
                      >
                        <View style={{ backgroundColor: '#10b981', padding: 5, borderRadius: 20, borderWidth: 2, borderColor: 'white' }}>
                          <MaterialIcons name="person-pin-circle" size={20} color="white" />
                        </View>
                      </Marker>
                    )}
                    {currentUser?.dropoffLocation?.lat && (
                      <Marker
                        coordinate={{ latitude: currentUser.dropoffLocation.lat, longitude: currentUser.dropoffLocation.lng }}
                        title="Current Drop-off"
                      >
                        <View style={{ backgroundColor: '#ef4444', padding: 5, borderRadius: 20, borderWidth: 2, borderColor: 'white' }}>
                          <MaterialIcons name="location-on" size={20} color="white" />
                        </View>
                      </Marker>
                    )}
                  </MapView>
                  <View style={styles.pickingInstructionsFloating}>
                     <MaterialIcons name="touch-app" size={20} color="white" />
                     <Text style={styles.pickingTextFloating}>Tap map to select {mapPickingMode}</Text>
                  </View>
                </View>
              )}

              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => { setIsEditingLocations(false); setMapPickingMode(null); }}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveLocations}>
                  <Text style={styles.saveBtnText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.viewSection}>
              <View style={styles.infoRow}>
                <MaterialIcons name="my-location" size={20} color={Colors.light.primary} />
                <Text style={styles.infoText}>Pickup: <Text style={{fontWeight: 'bold'}}>{currentUser?.pickupLocation || 'Not set'}</Text></Text>
              </View>
              <View style={styles.infoRow}>
                <MaterialIcons name="location-pin" size={20} color={Colors.light.primary} />
                <Text style={styles.infoText}>Drop-off: <Text style={{fontWeight: 'bold'}}>{currentUser?.dropoffLocation || 'Not set'}</Text></Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Manage Absences</Text>
          <Text style={styles.subText}>Let your driver know if you won't be travelling on specific days.</Text>
          
          <View style={styles.formContainer}>
            <Text style={styles.inputLabel}>1. Select Date</Text>
            <View style={styles.toggleRow}>
              {['Today', 'Tomorrow', 'Specific'].map(type => (
                <TouchableOpacity 
                  key={type}
                  style={[styles.toggleBtn, selectedDateType === type && styles.toggleBtnActive]}
                  onPress={() => setSelectedDateType(type)}
                >
                  <Text style={[styles.toggleBtnText, selectedDateType === type && styles.toggleBtnTextActive]}>{type}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {selectedDateType === 'Specific' && (
              <TextInput 
                style={[styles.dateInput, {marginBottom: 15}]} 
                value={specificDate}
                onChangeText={setSpecificDate}
                placeholder="YYYY-MM-DD"
              />
            )}

            <View style={styles.divider} />

            <Text style={styles.inputLabel}>2. Select Period</Text>
            <View style={styles.toggleRow}>
              {['Morning', 'Evening', 'Both'].map(period => (
                <TouchableOpacity 
                  key={period}
                  style={[styles.toggleBtn, newAbsencePeriod === period && styles.toggleBtnActiveOrange]}
                  onPress={() => setNewAbsencePeriod(period)}
                >
                  <Text style={[styles.toggleBtnText, newAbsencePeriod === period && styles.toggleBtnTextActiveOrange]}>{period === 'Both' ? 'Full Day' : `${period} Route`}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.submitAbsenceBtn} onPress={handleSubmitAbsence}>
              <MaterialIcons name="event-busy" size={20} color="white" style={{ position: 'absolute', left: 20 }} />
              <Text style={styles.submitAbsenceBtnText}>Submit Absence</Text>
            </TouchableOpacity>
          </View>

          {absences.length > 0 && (
            <View style={{marginTop: 15}}>
              <Text style={styles.miniTitle}>Recorded Absences</Text>
              {absences.map(absence => (
                <View key={absence.date} style={styles.recordedAbsenceRow}>
                  <View>
                    <Text style={styles.recordedAbsenceText}>{absence.date}</Text>
                    <Text style={styles.recordedAbsencePeriod}>{absence.period} Route{absence.period === 'Both' ? 's' : ''}</Text>
                  </View>
                  <TouchableOpacity onPress={() => removeAbsence(absence.date)}>
                    <Text style={styles.removeText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Book Extra Seats</Text>
          <Text style={styles.subText}>Reserve seats for friends natively calculating Driver capacities!</Text>
          
          <View style={styles.formContainer}>
            <Text style={styles.inputLabel}>1. Select Booking Date</Text>
            <View style={styles.toggleRow}>
              {['Today', 'Tomorrow', 'Specific'].map(type => (
                <TouchableOpacity 
                  key={type}
                  style={[styles.toggleBtn, bookingDateType === type && styles.toggleBtnActive]}
                  onPress={() => {setBookingDateType(type); setAvailableSeatsCheck(null);}}
                >
                  <Text style={[styles.toggleBtnText, bookingDateType === type && styles.toggleBtnTextActive]}>{type}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {bookingDateType === 'Specific' && (
              <TextInput 
                style={[styles.dateInput, {marginBottom: 15}]} 
                value={bookingSpecificDate}
                onChangeText={(t) => {setBookingSpecificDate(t); setAvailableSeatsCheck(null);}}
                placeholder="YYYY-MM-DD"
              />
            )}

            <View style={styles.divider} />

            <Text style={styles.inputLabel}>2. Select Period</Text>
            <View style={styles.toggleRow}>
              {['Morning', 'Evening'].map(period => (
                <TouchableOpacity 
                  key={period}
                  style={[styles.toggleBtn, bookingPeriod === period && styles.toggleBtnActiveGreen]}
                  onPress={() => {setBookingPeriod(period); setAvailableSeatsCheck(null);}}
                >
                  <Text style={[styles.toggleBtnText, bookingPeriod === period && styles.toggleBtnTextActiveGreen]}>{`${period} Route`}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {!availableSeatsCheck ? (
              <TouchableOpacity style={styles.checkAvailabilityBtn} onPress={checkAvailability}>
                <Text style={styles.checkAvailabilityBtnText}>Check Free Seats</Text>
              </TouchableOpacity>
            ) : (
              <View style={{marginTop: 10}}>
                {availableSeatsCheck.availableSeats > 0 ? (
                  <View style={styles.availableBox}>
                    <Text style={styles.availableSeatsTitle}>🔥 {availableSeatsCheck.availableSeats} Seats Available!</Text>
                    <View style={styles.bookActionRow}>
                      <Text style={{fontWeight: 'bold', marginRight: 10}}>Seats needed:</Text>
                      <TextInput 
                        style={[styles.seatCountInput, {width: 60}]} 
                        keyboardType="numeric" 
                        value={bookSeats}
                        onChangeText={handleSeatCountChange}
                      />
                    </View>
                    
                    {parseInt(bookSeats) > 1 && (
                      <TouchableOpacity 
                        style={{flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 10, borderRadius: 8, marginTop: 10, borderWidth: 1, borderColor: '#e5e7eb', elevation: 1}}
                        onPress={handleSameForAllChange}
                      >
                        <View style={{width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: '#2563eb', marginRight: 10, backgroundColor: sameForAll ? '#2563eb' : 'transparent', justifyContent: 'center', alignItems: 'center'}}>
                          {sameForAll && <MaterialIcons name="check" size={14} color="#fff" />}
                        </View>
                        <Text style={{fontSize: 13, color: '#374151', flex: 1, fontWeight: '500'}}>Use same Pickup & Drop-off locations for all passengers</Text>
                      </TouchableOpacity>
                    )}

                    <View style={{marginTop: 15, maxHeight: 300}}>
                      <ScrollView nestedScrollEnabled={true}>
                        {extraLocations.map((loc, idx) => (
                          <View key={idx} style={{padding: 10, backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 8, marginBottom: 10}}>
                            {!sameForAll && <Text style={{fontWeight: 'bold', color: '#15803d', marginBottom: 5}}>Passenger {idx + 1}</Text>}
                            <Text style={styles.inputLabel}>Pickup Location</Text>
                            <TextInput style={styles.input} value={loc.pickup} onChangeText={t => {
                               const newLocs = [...extraLocations]; newLocs[idx].pickup = t; setExtraLocations(newLocs); setExtraPrice(null);
                            }} placeholder="e.g. Dematagoda Station" />
                            
                            <Text style={styles.inputLabel}>Drop-off Location</Text>
                            <TextInput style={styles.input} value={loc.dropoff} onChangeText={t => {
                               const newLocs = [...extraLocations]; newLocs[idx].dropoff = t; setExtraLocations(newLocs); setExtraPrice(null);
                            }} placeholder="e.g. Kandy Town" />
                          </View>
                        ))}
                      </ScrollView>
                    </View>

                    {extraPrice === null ? (
                      <TouchableOpacity style={[styles.bookConfirmBtn, {backgroundColor: '#2563eb', marginTop: 10, width: '100%', alignItems: 'center'}]} onPress={calculateExtraPrice} disabled={calculatingPrice}>
                        <Text style={styles.bookConfirmBtnText}>{calculatingPrice ? 'Calculating...' : 'Calculate Price & Distance'}</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={{marginTop: 10, width: '100%'}}>
                        <View style={{flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#fff', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#dcfce7', marginBottom: 10}}>
                          <View>
                            <Text style={{fontSize: 10, color: '#6b7280', fontWeight: 'bold'}}>TOTAL DISTANCE</Text>
                            <Text style={{fontWeight: 'bold', fontSize: 16}}>{extraDistance.toFixed(1)} km</Text>
                          </View>
                          <View style={{alignItems: 'flex-end'}}>
                            <Text style={{fontSize: 10, color: '#6b7280', fontWeight: 'bold'}}>TOTAL PRICE (@ Rs.{availableSeatsCheck.pricePerKm}/km)</Text>
                            <Text style={{fontWeight: 'bold', fontSize: 18, color: '#15803d'}}>Rs. {Math.round(extraPrice)}</Text>
                          </View>
                        </View>
                        <TouchableOpacity style={[styles.bookConfirmBtn, {marginTop: 5, width: '100%', alignItems: 'center'}]} onPress={confirmExtraBooking}>
                          <Text style={styles.bookConfirmBtnText}>Confirm & Book Now!</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={styles.unavailableBox}>
                    <MaterialIcons name="error-outline" size={20} color="red" />
                    <Text style={styles.unavailableText}>No seats available for this ride.</Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {extraBookings.length > 0 && (
            <View style={{marginTop: 15}}>
              <Text style={styles.miniTitle}>My Temporary Bookings</Text>
              {extraBookings.slice().sort((a,b)=>a.date.localeCompare(b.date)).map((booking, index) => (
                <View key={index} style={[styles.recordedAbsenceRow, {borderBottomColor: '#d4edda'}]}>
                  <View>
                    <Text style={styles.recordedAbsenceText}>{typeof booking.date === 'string' ? new Date(booking.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : ''} - <Text style={{color: '#28a745'}}>{booking.seats} Seat(s)</Text></Text>
                    <Text style={[styles.recordedAbsencePeriod, {color: '#28a745'}]}>{booking.period} Route</Text>
                    {booking.pickupLocation && (
                      <View style={{marginTop: 5, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: '#dcfce7'}}>
                        <Text style={{fontSize: 12, color: '#4b5563'}}><Text style={{fontWeight: 'bold'}}>From:</Text> {booking.pickupLocation.address}</Text>
                        <Text style={{fontSize: 12, color: '#4b5563'}}><Text style={{fontWeight: 'bold'}}>To:</Text> {booking.dropoffLocation?.address}</Text>
                        {booking.price && <Text style={{fontSize: 12, color: '#15803d', fontWeight: 'bold', marginTop: 2}}>Total: Rs. {booking.price} ({booking.distanceKm?.toFixed(1)} km)</Text>}
                      </View>
                    )}
                  </View>
                  <TouchableOpacity onPress={() => cancelExtraBooking(index)}>
                    <Text style={styles.removeText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ── Driver Bank Details ── */}
        {driverProfile && (
          <View style={[styles.card, {marginTop: 16}]}>
            <Text style={styles.cardTitle}>💳 Driver's Bank Details</Text>
            {driverProfile.bankDetails?.accountNumber ? (
              <View style={{backgroundColor: '#e3f2fd', padding: 15, borderRadius: 10, borderColor: '#bbdefb', borderWidth: 1}}>
                <Text style={{fontWeight: 'bold', fontSize: 16, color: '#1565c0'}}>{driverProfile.bankDetails.bankName || 'Unknown Bank'}</Text>
                <Text style={{fontSize: 16, color: '#333', marginTop: 4, letterSpacing: 1, fontWeight: 'bold'}}>{driverProfile.bankDetails.accountNumber}</Text>
                <Text style={{fontSize: 14, color: '#555', marginTop: 8}}>Acc Name: <Text style={{color: '#333', fontWeight: 'bold'}}>{driverProfile.bankDetails.accountName || '-'}</Text></Text>
                <Text style={{fontSize: 14, color: '#555', marginTop: 2}}>Branch: <Text style={{color: '#333', fontWeight: 'bold'}}>{driverProfile.bankDetails.branchName || '-'}</Text></Text>
              </View>
            ) : (
              <Text style={{color: '#999', fontStyle: 'italic', textAlign: 'center', padding: 10}}>Your driver has not provided bank details yet. Contact them for payment instructions.</Text>
            )}
          </View>
        )}

        {/* ── Monthly Payments ── */}
        <View style={[styles.card, {marginTop: 16}]}>
          <Text style={styles.cardTitle}>💳 Monthly Payments</Text>
          <Text style={{fontSize: 12, color: '#888', marginBottom: 12}}>Upload your monthly payment receipt. Driver will verify it.</Text>

          {/* Month input */}
          <Text style={styles.miniTitle}>Payment Month (YYYY-MM)</Text>
          <TextInput
            style={styles.input}
            value={paymentMonth}
            onChangeText={setPaymentMonth}
            placeholder="2026-03"
            placeholderTextColor="#aaa"
          />

          {/* Amount input */}
          <Text style={[styles.miniTitle, {marginTop: 10}]}>Amount (LKR)</Text>
          <TextInput
            style={styles.input}
            value={paymentAmount}
            onChangeText={setPaymentAmount}
            placeholder="e.g. 3500"
            keyboardType="numeric"
            placeholderTextColor="#aaa"
          />

          {/* Image picker */}
          <TouchableOpacity style={[styles.saveBtn, {marginTop: 12, backgroundColor: '#6366f1'}]} onPress={pickReceiptImage}>
            <Text style={styles.saveBtnText}>📷 Pick Receipt Image</Text>
          </TouchableOpacity>

          {paymentImage && (
            <Image source={{ uri: paymentImage.uri }} style={{ width: '100%', height: 150, borderRadius: 10, marginTop: 10, resizeMode: 'cover' }} />
          )}

          <TouchableOpacity
            style={[styles.saveBtn, {marginTop: 12, opacity: paymentUploading ? 0.6 : 1}]}
            onPress={uploadPayment}
            disabled={paymentUploading}
          >
            {paymentUploading
              ? <ActivityIndicator color="white" />
              : <Text style={styles.saveBtnText}>Submit Receipt</Text>
            }
          </TouchableOpacity>

          {/* Payment history */}
          {payments.length > 0 && (
            <View style={{marginTop: 16}}>
              <Text style={styles.miniTitle}>Payment History</Text>
              {payments.map((p, i) => (
                <View key={i} style={{flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0'}}>
                  {p.imageUrl && (
                    <Image source={{ uri: p.imageUrl }} style={{ width: 52, height: 52, borderRadius: 8 }} />
                  )}
                  <View style={{flex: 1}}>
                    <Text style={{fontWeight: 'bold', fontSize: 13, color: '#333'}}>{p.month}  •  LKR {p.amount?.toLocaleString()}</Text>
                    <Text style={{fontSize: 11, color: '#888'}}>
                      {p.submittedAt ? new Date(p.submittedAt).toLocaleDateString() : ''}
                    </Text>
                    {p.note ? <Text style={{fontSize: 11, color: '#666', fontStyle: 'italic'}}>Note: {p.note}</Text> : null}
                  </View>
                  <View style={{
                    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10,
                    backgroundColor: p.status === 'approved' ? '#e8f5e9' : p.status === 'rejected' ? '#ffebee' : '#fff8e1'
                  }}>
                    <Text style={{
                      fontSize: 10, fontWeight: 'bold',
                      color: p.status === 'approved' ? '#2e7d32' : p.status === 'rejected' ? '#c62828' : '#e65100'
                    }}>
                      {p.status === 'approved' ? '✅ Approved' : p.status === 'rejected' ? '❌ Rejected' : '⏳ Pending'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.secondary },
  header: { backgroundColor: Colors.light.primary, padding: 20, paddingTop: 50, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: 'white' },
  welcomeText: { fontSize: 18, color: '#e6f4ea', marginTop: 10 },
  content: { padding: 20, marginTop: 10 },
  card: { backgroundColor: 'white', borderRadius: 15, padding: 20, marginBottom: 15, elevation: 2 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 10 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 10 },
  cardTitleNoMargin: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  editText: { color: Colors.light.primary, fontWeight: 'bold', fontSize: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  infoText: { fontSize: 16, color: '#555', marginLeft: 10 },
  driverSection: { marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#eee' },
  miniTitle: { fontSize: 14, fontWeight: 'bold', color: '#888', textTransform: 'uppercase', marginBottom: 10, letterSpacing: 1 },
  routeViewCard: { backgroundColor: '#f9f9f9', padding: 12, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#eee' },
  routeIndexText: { fontSize: 13, fontWeight: 'bold', color: '#888', marginBottom: 5 },
  editSection: { marginTop: 5 },
  viewSection: { marginTop: 5 },
  inputLabel: { fontSize: 14, color: '#666', marginBottom: 5 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 16, marginBottom: 15, backgroundColor: '#f9f9f9' },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 },
  cancelBtn: { padding: 10, marginRight: 10 },
  cancelBtnText: { color: '#666', fontWeight: 'bold', fontSize: 16 },
  saveBtn: { backgroundColor: Colors.light.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  saveBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  
  subText: { fontSize: 13, color: '#666', marginBottom: 15 },
  formContainer: { backgroundColor: '#f9f9f9', padding: 15, borderRadius: 10, marginBottom: 15, borderWidth: 1, borderColor: '#eee' },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  toggleBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', marginHorizontal: 4, borderRadius: 6 },
  toggleBtnActive: { backgroundColor: Colors.light.primary, borderColor: Colors.light.primary },
  toggleBtnActiveOrange: { backgroundColor: '#fff3e0', borderColor: '#ffe0b2' },
  toggleBtnActiveGreen: { backgroundColor: '#e8f5e9', borderColor: '#c8e6c9' },
  toggleBtnText: { fontSize: 12, fontWeight: 'bold', color: '#666' },
  toggleBtnTextActive: { color: 'white' },
  toggleBtnTextActiveOrange: { color: '#e65100' },
  toggleBtnTextActiveGreen: { color: '#2e7d32' },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 10 },
  dateInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 15, backgroundColor: '#fff' },
  submitAbsenceBtn: { backgroundColor: Colors.light.primary, paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginTop: 5, flexDirection: 'row', justifyContent: 'center' },
  submitAbsenceBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },

  checkAvailabilityBtn: { backgroundColor: '#333', paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginTop: 5 },
  checkAvailabilityBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  availableBox: { backgroundColor: '#e8f5e9', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#c8e6c9' },
  availableSeatsTitle: { fontWeight: 'bold', fontSize: 16, color: '#2e7d32', marginBottom: 10 },
  bookActionRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  seatCountInput: { width: 60, height: 45, backgroundColor: 'white', borderWidth: 1, borderColor: '#c8e6c9', borderRadius: 8, textAlign: 'center', fontSize: 16, fontWeight: 'bold' },
  bookConfirmBtn: { flex: 1, backgroundColor: '#4caf50', height: 45, justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
  bookConfirmBtnText: { color: 'white', fontWeight: 'bold', fontSize: 15 },
  unavailableBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#ffebee', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#ffcdd2' },
  unavailableText: { fontWeight: 'bold', color: '#c62828' },

  recordedAbsenceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  recordedAbsenceText: { fontSize: 15, fontWeight: 'bold', color: '#444' },
  recordedAbsencePeriod: { fontSize: 11, fontWeight: 'bold', color: '#e65100', textTransform: 'uppercase', marginTop: 3 },
  removeText: { color: 'red', fontWeight: 'bold', fontSize: 13 },
  
  liveBadgeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e8f5e9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  liveBadgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4caf50', marginRight: 4 },
  liveBadgeText: { color: '#2e7d32', fontSize: 10, fontWeight: 'bold' },
  mapContainer: { height: 200, width: '100%', borderRadius: 10, overflow: 'hidden', marginTop: 10, backgroundColor: '#f5f5f5' },
  map: { flex: 1 },
  mapLoading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  mapLoadingText: { marginTop: 10, color: '#666', fontStyle: 'italic', fontSize: 12 },
  mapInactive: { height: 80, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fafafa', borderWidth: 1, borderColor: '#eee', borderStyle: 'dashed', borderRadius: 10, marginTop: 10 },
  mapInactiveText: { color: '#888', fontStyle: 'italic', fontSize: 13 },
  markerContainer: { width: 30, height: 30, backgroundColor: 'rgba(0,150,255,0.2)', borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  markerDot: { width: 12, height: 12, backgroundColor: '#007AFF', borderRadius: 6, borderWidth: 2, borderColor: '#fff' },
  
  inputWithButtons: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 15 },
  iconBtn: { padding: 10, backgroundColor: '#f0f0f0', borderRadius: 8, borderWidth: 1, borderColor: '#ddd', height: 45, justifyContent: 'center' },
  iconBtnActive: { backgroundColor: Colors.light.primary, borderColor: Colors.light.primary },
  pickingInstructions: { backgroundColor: Colors.light.primary, padding: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 15 },
  pickingText: { color: 'white', fontSize: 13, fontWeight: 'bold', flex: 1 },
  pickingInstructionsFloating: { position: 'absolute', bottom: 10, left: 10, right: 10, backgroundColor: 'rgba(59, 130, 246, 0.9)', padding: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 8, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 },
  pickingTextFloating: { color: 'white', fontSize: 12, fontWeight: 'bold', flex: 1 },
});
