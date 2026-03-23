import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { Colors } from '../constants/Colors';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_API_URL + '/auth';

export default function DriverDashboard({ route, navigation }) {
  const { user, token } = route.params || {};
  const [passengers, setPassengers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPassengers();
  }, []);

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

  const renderPassenger = ({ item }) => (
    <View style={styles.passengerCard}>
      <View style={styles.passengerHeader}>
        <MaterialIcons name="person" size={24} color={Colors.light.primary} />
        <Text style={styles.passengerName}>{item.name}</Text>
      </View>
      <View style={styles.passengerInfo}>
        <MaterialIcons name="phone" size={16} color="#666" style={styles.iconSpaced} />
        <Text style={styles.passengerText}>{item.phoneNumber}</Text>
      </View>
      <View style={styles.passengerInfo}>
        <MaterialIcons name="email" size={16} color="#666" style={styles.iconSpaced} />
        <Text style={styles.passengerText}>{item.email}</Text>
      </View>
    </View>
  );

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
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  infoText: { fontSize: 16, color: '#555', marginLeft: 10 },
  
  sectionHeaderContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, marginTop: 10 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  badge: { backgroundColor: Colors.light.primary, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 10 },
  badgeText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  
  passengerCard: { backgroundColor: 'white', borderRadius: 12, padding: 15, marginBottom: 12, elevation: 1, borderLeftWidth: 4, borderLeftColor: Colors.light.primary },
  passengerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  passengerName: { fontSize: 18, fontWeight: 'bold', color: '#333', marginLeft: 10 },
  passengerInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 5, marginLeft: 34 },
  iconSpaced: { marginRight: 8 },
  passengerText: { fontSize: 14, color: '#666' },
  emptyText: { textAlign: 'center', color: '#777', fontSize: 16, marginTop: 20, fontStyle: 'italic' }
});
