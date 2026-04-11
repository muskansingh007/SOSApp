import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
    Alert,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

export default function SettingsScreen() {
  const router = useRouter();
  const [shakeEnabled, setShakeEnabled] = useState(true);
  const [emergencyNumber, setEmergencyNumber] = useState("112");
  const [countdown, setCountdown] = useState("5");

  function save() {
    Alert.alert("Saved", "Settings have been saved successfully.");
  }

  return (
    <View style={styles.container}>
      {/* Shake to SOS */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🤝 Shake to activate SOS</Text>
        <Text style={styles.cardDesc}>
          Shake your phone vigorously to trigger the SOS alert automatically.
        </Text>
        <View style={styles.row}>
          <Text style={styles.label}>Enable shake detection</Text>
          <Switch
            value={shakeEnabled}
            onValueChange={setShakeEnabled}
            trackColor={{ true: "#D32F2F", false: "#444" }}
            thumbColor={shakeEnabled ? "#FF5252" : "#888"}
          />
        </View>
      </View>

      {/* Emergency number */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📞 Emergency call number</Text>
        <Text style={styles.cardDesc}>
          Default emergency number for one-tap calling. India: 112, US: 911, UK:
          999.
        </Text>
        <TextInput
          style={styles.input}
          value={emergencyNumber}
          onChangeText={setEmergencyNumber}
          keyboardType="phone-pad"
          placeholder="e.g. 112"
          placeholderTextColor="#666"
        />
      </View>

      {/* Countdown */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>⏱ Countdown before SMS sent</Text>
        <Text style={styles.cardDesc}>
          Gives you a few seconds to cancel accidental SOS triggers.
        </Text>
        <TextInput
          style={styles.input}
          value={countdown}
          onChangeText={setCountdown}
          keyboardType="number-pad"
          placeholder="Seconds (e.g. 5)"
          placeholderTextColor="#666"
        />
      </View>

      {/* About */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>ℹ️ About</Text>
        <Text style={styles.cardDesc}>
          SOS App v1.0{"\n"}
          Built with React Native + Expo{"\n"}
          Location: Expo Location API{"\n"}
          SMS: Expo SMS API
        </Text>
      </View>

      <TouchableOpacity style={styles.saveBtn} onPress={save}>
        <Text style={styles.saveBtnText}>Save Settings</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1a1a1a", padding: 16 },
  card: {
    backgroundColor: "#242424",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#333",
  },
  cardTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 6,
  },
  cardDesc: { color: "#888", fontSize: 13, lineHeight: 20, marginBottom: 12 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: { color: "#ccc", fontSize: 14 },
  input: {
    backgroundColor: "#1a1a1a",
    color: "#fff",
    padding: 12,
    borderRadius: 8,
    fontSize: 15,
    borderWidth: 1,
    borderColor: "#444",
  },
  saveBtn: {
    backgroundColor: "#D32F2F",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  saveBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
