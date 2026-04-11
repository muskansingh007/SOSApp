import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  Animated, Vibration, AsyncStorage,
} from 'react-native';
import { Accelerometer } from 'expo-sensors';
import { getCurrentLocation, sendSOSMessages, callEmergency } from '../utils/sosHelper';
import {
  sendSOSTriggerNotification,
  sendSMSSentNotification,
} from '../utils/notificationHelper';

const SHAKE_THRESHOLD = 1.8; // G-force threshold to trigger shake

export default function HomeScreen({ navigation }) {
  const [contacts, setContacts] = useState([]);
  const [isArmed, setIsArmed] = useState(true);
  const pulse = useRef(new Animated.Value(1)).current;

  // Pulsing animation for SOS button
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Load saved contacts
  useEffect(() => {
    loadContacts();
  }, []);

  // Shake detection
  useEffect(() => {
    let lastMagnitude = 0;
    Accelerometer.setUpdateInterval(200);
    const sub = Accelerometer.addListener(({ x, y, z }) => {
      const magnitude = Math.sqrt(x * x + y * y + z * z);
      const delta = Math.abs(magnitude - lastMagnitude);
      lastMagnitude = magnitude;
      if (isArmed && delta > SHAKE_THRESHOLD) {
        triggerSOS('shake');
      }
    });
    return () => sub.remove();
  }, [isArmed, contacts]);

  async function loadContacts() {
    try {
      const stored = await AsyncStorage.getItem('contacts');
      if (stored) setContacts(JSON.parse(stored));
    } catch (e) {}
  }

  async function triggerSOS(source = 'button') {
    Vibration.vibrate([0, 300, 200, 300, 200, 300]);
    try {
      const coords = await getCurrentLocation();
      // Fire the SOS push notification immediately
      await sendSOSTriggerNotification(coords);
      const smsSent = await sendSOSMessages(contacts, coords);
      // Confirm SMS delivery via notification
      if (smsSent && contacts.length > 0) {
        await sendSMSSentNotification(contacts.length);
      }
      navigation.navigate('Alert', { coords, contacts });
    } catch (err) {
      Alert.alert(
        'SOS Error',
        'Could not get location. Please enable location permission.\n\nCalling emergency number now.',
        [
          { text: 'Call 112', onPress: () => callEmergency('112') },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.subtitle}>
        {isArmed ? '🟢 Armed — shake or press SOS' : '🔴 Disarmed'}
      </Text>

      {/* Main SOS Button */}
      <Animated.View style={{ transform: [{ scale: pulse }] }}>
        <TouchableOpacity
          style={styles.sosButton}
          onPress={() => triggerSOS('button')}
          activeOpacity={0.8}
        >
          <Text style={styles.sosText}>SOS</Text>
          <Text style={styles.sosHint}>Press & hold for help</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Quick Emergency Call */}
      <TouchableOpacity style={styles.callButton} onPress={() => callEmergency('112')}>
        <Text style={styles.callText}>📞 Call 112 Now</Text>
      </TouchableOpacity>

      {/* Arm / Disarm Toggle */}
      <TouchableOpacity
        style={[styles.toggleButton, isArmed ? styles.armed : styles.disarmed]}
        onPress={() => setIsArmed(!isArmed)}
      >
        <Text style={styles.toggleText}>
          {isArmed ? '🔓 Disarm shake detection' : '🔒 Arm shake detection'}
        </Text>
      </TouchableOpacity>

      {/* Nav Buttons */}
      <View style={styles.row}>
        <TouchableOpacity style={styles.navBtn} onPress={() => navigation.navigate('Contacts')}>
          <Text style={styles.navText}>👥 Contacts ({contacts.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navBtn} onPress={() => navigation.navigate('Settings')}>
          <Text style={styles.navText}>⚙️ Settings</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a1a', alignItems: 'center', justifyContent: 'center', padding: 24 },
  subtitle: { color: '#aaa', fontSize: 14, marginBottom: 32 },
  sosButton: {
    width: 220, height: 220, borderRadius: 110,
    backgroundColor: '#D32F2F',
    borderWidth: 6, borderColor: '#FF5252',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#D32F2F', shadowOpacity: 0.7, shadowRadius: 30, elevation: 20,
  },
  sosText: { color: '#fff', fontSize: 52, fontWeight: '900', letterSpacing: 4 },
  sosHint: { color: '#ffcdd2', fontSize: 12, marginTop: 4 },
  callButton: {
    marginTop: 36, backgroundColor: '#1565C0', paddingVertical: 14, paddingHorizontal: 40,
    borderRadius: 30, borderWidth: 1, borderColor: '#42A5F5',
  },
  callText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  toggleButton: { marginTop: 16, paddingVertical: 10, paddingHorizontal: 28, borderRadius: 20 },
  armed: { backgroundColor: '#2e2e2e', borderWidth: 1, borderColor: '#555' },
  disarmed: { backgroundColor: '#3e1a1a', borderWidth: 1, borderColor: '#D32F2F' },
  toggleText: { color: '#ccc', fontSize: 13 },
  row: { flexDirection: 'row', marginTop: 32, gap: 12 },
  navBtn: { flex: 1, backgroundColor: '#2a2a2a', padding: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  navText: { color: '#ddd', fontSize: 13 },
});