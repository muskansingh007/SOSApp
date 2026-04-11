import { activateKeepAwake, deactivateKeepAwake } from "expo-keep-awake";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
    Alert,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import {
    cancelLocationUpdateNotifications,
    scheduleLocationUpdateNotification,
    sendSOSCancelledNotification,
} from "../Screens/utils/NotificationHelper";
import { callEmergency, watchLocation } from "../Screens/utils/sosHelper";

let MapView, Circle, Marker;
if (Platform.OS !== "web") {
  const mapModule = require("react-native-maps");
  MapView = mapModule.default;
  Circle = mapModule.Circle;
  Marker = mapModule.Marker;
}

export default function AlertScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const initialCoords = JSON.parse(params.coords || "{}");
  const contacts = JSON.parse(params.contacts || "[]");
  const [coords, setCoords] = useState(initialCoords);
  const [elapsed, setElapsed] = useState(0);
  const subRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    // Activate keep awake to prevent screen from sleeping during SOS
    activateKeepAwake();

    // Start real-time location tracking
    watchLocation((newCoords) => {
      setCoords(newCoords);
      scheduleLocationUpdateNotification(newCoords); // refresh the scheduled notification
    }).then((sub) => {
      subRef.current = sub;
    });

    // Schedule first periodic location notification
    scheduleLocationUpdateNotification(initialCoords);

    // Elapsed timer
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);

    return () => {
      deactivateKeepAwake();
      subRef.current?.remove();
      clearInterval(timerRef.current);
      cancelLocationUpdateNotifications();
    };
  }, []);

  function formatTime(secs) {
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  function cancelSOS() {
    Alert.alert("Cancel SOS?", "This will stop the alert. Are you safe?", [
      {
        text: "Yes, I am safe",
        onPress: () => {
          deactivateKeepAwake();
          subRef.current?.remove();
          clearInterval(timerRef.current);
          sendSOSCancelledNotification();
          router.replace("/");
        },
      },
      { text: "Keep SOS active", style: "cancel" },
    ]);
  }

  return (
    <View style={styles.container}>
      {/* Status bar */}
      <View style={styles.statusBar}>
        <Text style={styles.statusText}>
          🚨 SOS ACTIVE — {formatTime(elapsed)}
        </Text>
      </View>

      {/* Live map */}
      {Platform.OS !== "web" && MapView ? (
        <MapView
          style={styles.map}
          region={{
            latitude: coords.latitude,
            longitude: coords.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          }}
        >
          <Marker coordinate={coords} title="My Location" pinColor="red" />
          <Circle
            center={coords}
            radius={80}
            fillColor="rgba(211,47,47,0.15)"
            strokeColor="rgba(211,47,47,0.5)"
            strokeWidth={2}
          />
        </MapView>
      ) : (
        <View style={styles.mapPlaceholder}>
          <Text style={styles.mapPlaceholderText}>
            Map not available on web
          </Text>
        </View>
      )}

      {/* Coords */}
      <Text style={styles.coords}>
        📍 {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
      </Text>

      {/* Notified contacts */}
      <Text style={styles.sectionTitle}>Notified contacts</Text>
      <ScrollView
        style={styles.contactList}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {contacts.length === 0 ? (
          <Text style={styles.noContacts}>
            No contacts added — add them in the Contacts screen
          </Text>
        ) : (
          contacts.map((c, i) => (
            <View key={i} style={styles.contactChip}>
              <Text style={styles.contactName}>{c.name}</Text>
              <Text style={styles.contactPhone}>{c.phone}</Text>
            </View>
          ))
        )}
      </ScrollView>

      {/* Actions */}
      <TouchableOpacity
        style={styles.callBtn}
        onPress={() => callEmergency("112")}
      >
        <Text style={styles.callBtnText}>📞 Call 112 (Emergency)</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelBtn} onPress={cancelSOS}>
        <Text style={styles.cancelText}>✅ I am safe — Cancel SOS</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1a1a1a" },
  statusBar: { backgroundColor: "#B71C1C", padding: 14, alignItems: "center" },
  statusText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 16,
    letterSpacing: 1,
  },
  map: { height: 260 },
  mapPlaceholder: {
    height: 260,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#333",
  },
  mapPlaceholderText: {
    color: "#fff",
    fontSize: 16,
  },
  coords: { color: "#aaa", fontSize: 12, textAlign: "center", padding: 8 },
  sectionTitle: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  contactList: { paddingHorizontal: 12, paddingVertical: 8, maxHeight: 90 },
  noContacts: { color: "#777", fontSize: 13, padding: 8 },
  contactChip: {
    backgroundColor: "#2a2a2a",
    borderRadius: 10,
    padding: 10,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#444",
    minWidth: 100,
  },
  contactName: { color: "#fff", fontSize: 13, fontWeight: "700" },
  contactPhone: { color: "#aaa", fontSize: 11, marginTop: 2 },
  callBtn: {
    margin: 16,
    backgroundColor: "#1565C0",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  callBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  cancelBtn: {
    marginHorizontal: 16,
    marginBottom: 24,
    backgroundColor: "#1b5e20",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  cancelText: { color: "#a5d6a7", fontSize: 15, fontWeight: "700" },
});
