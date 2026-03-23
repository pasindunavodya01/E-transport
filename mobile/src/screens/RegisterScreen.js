import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, isMockAuth, mockRegister } from '../firebase';
import axios from 'axios';
import { Colors } from '../constants/Colors';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';

const API_URL = process.env.EXPO_PUBLIC_API_URL + '/auth';

export default function RegisterScreen({ navigation }) {
  const [role, setRole] = useState('passenger');
  const [formData, setFormData] = useState({ name: '', phoneNumber: '', email: '', password: '', vehicleNumber: '', vehicleType: '', chosenVehicleNumber: '' });
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!formData.name || !formData.email || !formData.password || !formData.phoneNumber) {
      Alert.alert('Error', 'Please fill all basic basic fields');
      return;
    }

    setLoading(true);
    try {
      let userToken;
      if (isMockAuth) {
        const { user } = await mockRegister(formData.email);
        userToken = await user.getIdToken();
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        userToken = await userCredential.user.getIdToken();
      }

      await axios.post(`${API_URL}/register`, { role, ...formData }, {
        headers: { Authorization: `Bearer ${userToken}` }
      });

      Alert.alert('Success', 'Registration successful! Please login.');
      navigation.replace('Login');
    } catch (error) {
      Alert.alert('Registration Failed', error.response?.data?.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const updateForm = (key, value) => setFormData({ ...formData, [key]: value });

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Create Account</Text>
      </View>

      <View style={styles.formContainer}>
        <View style={styles.roleToggle}>
          <TouchableOpacity style={[styles.roleButton, role === 'passenger' && styles.roleButtonActive]} onPress={() => setRole('passenger')}>
            <Text style={[styles.roleText, role === 'passenger' && styles.roleTextActive]}>Passenger</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.roleButton, role === 'driver' && styles.roleButtonActive]} onPress={() => setRole('driver')}>
            <Text style={[styles.roleText, role === 'driver' && styles.roleTextActive]}>Driver</Text>
          </TouchableOpacity>
        </View>

        {/* Form Inputs */}
        <View style={styles.inputContainer}>
          <MaterialIcons name="person" size={24} color={Colors.light.primary} style={styles.icon} />
          <TextInput style={styles.input} placeholder="Full Name" value={formData.name} onChangeText={(text) => updateForm('name', text)} />
        </View>
        <View style={styles.inputContainer}>
          <MaterialIcons name="phone" size={24} color={Colors.light.primary} style={styles.icon} />
          <TextInput style={styles.input} placeholder="Phone Number" keyboardType="phone-pad" value={formData.phoneNumber} onChangeText={(text) => updateForm('phoneNumber', text)} />
        </View>
        <View style={styles.inputContainer}>
          <MaterialIcons name="email" size={24} color={Colors.light.primary} style={styles.icon} />
          <TextInput style={styles.input} placeholder="Email" keyboardType="email-address" value={formData.email} autoCapitalize="none" onChangeText={(text) => updateForm('email', text)} />
        </View>
        <View style={styles.inputContainer}>
          <MaterialIcons name="lock" size={24} color={Colors.light.primary} style={styles.icon} />
          <TextInput style={styles.input} placeholder="Password" secureTextEntry value={formData.password} onChangeText={(text) => updateForm('password', text)} />
        </View>

        {role === 'driver' && (
          <View>
            <View style={styles.inputContainer}>
              <FontAwesome5 name="hashtag" size={20} color={Colors.light.primary} style={styles.icon} />
              <TextInput style={styles.input} placeholder="Vehicle Number" value={formData.vehicleNumber} onChangeText={(text) => updateForm('vehicleNumber', text)} />
            </View>
            <View style={styles.inputContainer}>
              <MaterialIcons name="directions-car" size={24} color={Colors.light.primary} style={styles.icon} />
              <TextInput style={styles.input} placeholder="Vehicle Type (e.g. Sedan)" value={formData.vehicleType} onChangeText={(text) => updateForm('vehicleType', text)} />
            </View>
          </View>
        )}

        {role === 'passenger' && (
          <View style={styles.inputContainer}>
             <FontAwesome5 name="hashtag" size={20} color={Colors.light.primary} style={styles.icon} />
             <TextInput style={styles.input} placeholder="Target Vehicle Number" value={formData.chosenVehicleNumber} onChangeText={(text) => updateForm('chosenVehicleNumber', text)} />
          </View>
        )}

        <TouchableOpacity style={styles.registerButton} onPress={handleRegister} disabled={loading}>
          {loading ? <ActivityIndicator color="white" /> : <Text style={styles.registerButtonText}>Register</Text>}
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.loginLink} onPress={() => navigation.navigate('Login')}>
          <Text style={styles.loginText}>Already have an account? <Text style={styles.loginTextBold}>Login</Text></Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.secondary },
  header: { height: 120, backgroundColor: Colors.light.primary, justifyContent: 'flex-end', paddingBottom: 20, alignItems: 'center', borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerTitle: { fontSize: 26, fontWeight: 'bold', color: 'white' },
  formContainer: { padding: 20 },
  roleToggle: { flexDirection: 'row', backgroundColor: 'white', borderRadius: 10, elevation: 2, marginBottom: 20 },
  roleButton: { flex: 1, padding: 15, alignItems: 'center', borderRadius: 10 },
  roleButtonActive: { backgroundColor: Colors.light.primary },
  roleText: { fontSize: 16, fontWeight: 'bold', color: '#555' },
  roleTextActive: { color: 'white' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 10, paddingHorizontal: 15, paddingVertical: 12, marginBottom: 15, elevation: 1 },
  icon: { marginRight: 10 },
  input: { flex: 1, fontSize: 16 },
  registerButton: { backgroundColor: Colors.light.primary, paddingVertical: 15, borderRadius: 10, alignItems: 'center', elevation: 3, marginTop: 10 },
  registerButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  loginLink: { marginTop: 20, alignItems: 'center' },
  loginText: { color: '#666', fontSize: 16 },
  loginTextBold: { color: Colors.light.primary, fontWeight: 'bold' }
});
