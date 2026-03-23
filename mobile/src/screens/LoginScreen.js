import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth, isMockAuth, mockLogin } from '../firebase';
import axios from 'axios';
import { Colors } from '../constants/Colors';
import { MaterialIcons } from '@expo/vector-icons';

// Hardware for android emulator or default for local development
const API_URL = process.env.EXPO_PUBLIC_API_URL + '/auth'; 

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }
    
    setLoading(true);
    try {
      let userToken;
      if (isMockAuth) {
        const { user } = await mockLogin(email);
        userToken = await user.getIdToken();
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        userToken = await userCredential.user.getIdToken();
      }

      // Normally we would use AsyncStore, keeping simple for now
      const response = await axios.get(`${API_URL}/me`, {
        headers: { Authorization: `Bearer ${userToken}` }
      });

      const userData = response.data;
      if (userData.role === 'driver') {
        navigation.replace('DriverDashboard', { user: userData, token: userToken });
      } else {
        navigation.replace('PassengerDashboard', { user: userData, token: userToken });
      }
    } catch (error) {
      if (error.response?.status === 404 && error.response?.data?.registered === false) {
        Alert.alert(
          'Account Not Registered',
          'Your account exists in Firebase but is not registered in our system. Please register first.',
          [{ text: 'Register', onPress: () => navigation.navigate('Register') }, { text: 'Cancel' }]
        );
      } else {
        Alert.alert('Login Failed', error.response?.data?.message || 'Invalid credentials');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      Alert.alert('Info', 'Please enter your email to reset password.');
      return;
    }
    if (isMockAuth) {
      Alert.alert('Success', 'Password reset mock email sent!');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      Alert.alert('Success', 'Password reset email sent!');
    } catch (error) {
      Alert.alert('Error', 'Failed to send reset email.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <MaterialIcons name="local-taxi" size={64} color="white" />
        <Text style={styles.headerTitle}>E-Transport</Text>
      </View>

      <View style={styles.formContainer}>
        <Text style={styles.welcomeText}>Welcome back!</Text>
        
        <View style={styles.inputContainer}>
          <MaterialIcons name="email" size={24} color={Colors.light.primary} style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <View style={styles.inputContainer}>
          <MaterialIcons name="lock" size={24} color={Colors.light.primary} style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        <TouchableOpacity onPress={handleResetPassword}>
          <Text style={styles.forgotPassword}>Forgot Password?</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.loginButton} onPress={handleLogin} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.loginButtonText}>Sign In</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Register')} style={styles.registerLink}>
          <Text style={styles.registerText}>Don't have an account? <Text style={styles.registerTextBold}>Register</Text></Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.secondary },
  header: { flex: 0.4, backgroundColor: Colors.light.primary, justifyContent: 'center', alignItems: 'center', borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerTitle: { fontSize: 32, fontWeight: 'bold', color: 'white', marginTop: 10 },
  formContainer: { flex: 0.6, padding: 20, paddingTop: 40 },
  welcomeText: { fontSize: 24, fontWeight: 'bold', color: '#333', marginBottom: 20, textAlign: 'center' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 10, paddingHorizontal: 15, paddingVertical: 12, marginBottom: 15, elevation: 2 },
  icon: { marginRight: 10 },
  input: { flex: 1, fontSize: 16 },
  forgotPassword: { alignSelf: 'flex-end', color: Colors.light.primary, marginBottom: 20 },
  loginButton: { backgroundColor: Colors.light.primary, paddingVertical: 15, borderRadius: 10, alignItems: 'center', elevation: 3 },
  loginButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  registerLink: { marginTop: 20, alignItems: 'center' },
  registerText: { color: '#666', fontSize: 16 },
  registerTextBold: { color: Colors.light.primary, fontWeight: 'bold' }
});
