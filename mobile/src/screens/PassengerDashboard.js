import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ScrollView } from 'react-native';
import axios from 'axios';
import { Colors } from '../constants/Colors';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';

export default function PassengerDashboard({ route, navigation }) {
  const { user, token } = route.params || {};
  const [driverProfile, setDriverProfile] = useState(null);
  const [currentUser, setCurrentUser] = useState(user);
  const [isEditingLocations, setIsEditingLocations] = useState(false);
  const [locationData, setLocationData] = useState({
    pickupLocation: user?.pickupLocation || '',
    dropoffLocation: user?.dropoffLocation || ''
  });
  const [absences, setAbsences] = useState(user?.absences || []);
  const [selectedDateType, setSelectedDateType] = useState('Today');
  const [specificDate, setSpecificDate] = useState('');
  const [newAbsencePeriod, setNewAbsencePeriod] = useState('Both');

  useEffect(() => {
    fetchDriverDetails();
  }, []);

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

  const handleSaveLocations = async () => {
    try {
      const response = await axios.put(`${process.env.EXPO_PUBLIC_API_URL}/auth/update-locations`, {
        pickupLocation: locationData.pickupLocation,
        dropoffLocation: locationData.dropoffLocation
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

  const handleLogout = () => {
    navigation.replace('Login');
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
              <TextInput style={styles.input} value={locationData.pickupLocation} onChangeText={t => setLocationData({...locationData, pickupLocation: t})} placeholder="e.g., Dematagoda Station" />
              
              <Text style={styles.inputLabel}>Drop-off Location</Text>
              <TextInput style={styles.input} value={locationData.dropoffLocation} onChangeText={t => setLocationData({...locationData, dropoffLocation: t})} placeholder="e.g., Kandy Town" />
              
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsEditingLocations(false)}>
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
  toggleBtnText: { fontSize: 12, fontWeight: 'bold', color: '#666' },
  toggleBtnTextActive: { color: 'white' },
  toggleBtnTextActiveOrange: { color: '#e65100' },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 10 },
  dateInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 15, backgroundColor: '#fff' },
  submitAbsenceBtn: { backgroundColor: Colors.light.primary, paddingVertical: 14, borderRadius: 8, alignItems: 'center', marginTop: 5, flexDirection: 'row', justifyContent: 'center' },
  submitAbsenceBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },

  recordedAbsenceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  recordedAbsenceText: { fontSize: 15, fontWeight: 'bold', color: '#444' },
  recordedAbsencePeriod: { fontSize: 11, fontWeight: 'bold', color: '#e65100', textTransform: 'uppercase', marginTop: 3 },
  removeText: { color: 'red', fontWeight: 'bold', fontSize: 13 }
});
