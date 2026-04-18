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
import { Circle, MapView, Marker } from "./MapView";

export default function AlertScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const initialCoords = JSON.parse(typeof params.coords === "string" ? params.coords : "{}");
  const contacts = JSON.parse(typeof params.contacts === "string" ? params.contacts : "[]");
  const [coords, setCoords] = useState(initialCoords);
  const [elapsed, setElapsed] = useState(0);
  const subRef = useRef<any>(null);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    activateKeepAwake();

    watchLocation((newCoords: any) => {
      setCoords(newCoords);
      scheduleLocationUpdateNotification(newCoords);
    }).then((sub) => {
      subRef.current = sub;
    });

    scheduleLocationUpdateNotification(initialCoords);

    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);

    return () => {
      deactivateKeepAwake();
      subRef.current?.remove();
      clearInterval(timerRef.current);
      cancelLocationUpdateNotifications();
    };
  }, []);

  function formatTime(secs: number) {
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
      <View style={styles.statusBar}>
        <Text style={styles.statusText}>🚨 SOS ACTIVE — {formatTime(elapsed)}</Text>
      </View>

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
          <Text style={styles.mapPlaceholderText}>Map not available on web</Text>
        </View>
      )}

      <Text style={styles.coords}>
        📍 {coords.latitude?.toFixed(5) ?? "--"}, {coords.longitude?.toFixed(5) ?? "--"}
      </Text>

      <Text style={styles.sectionTitle}>Notified contacts</Text>
      <ScrollView style={styles.contactList} horizontal showsHorizontalScrollIndicator={false}>
        {contacts.length === 0 ? (
          <Text style={styles.noContacts}>No contacts added — add them in the Contacts screen</Text>
        ) : (
          contacts.map((c: any, i: number) => (
            <View key={i} style={styles.contactChip}>
              <Text style={styles.contactName}>{c.name}</Text>
              <Text style={styles.contactPhone}>{c.phone}</Text>
            </View>
          ))
        )}
      </ScrollView>

      <TouchableOpacity style={styles.callBtn} onPress={() => callEmergency("112")}> 
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
  statusText: { color: "#fff", fontWeight: "900", fontSize: 16, letterSpacing: 1 },
  map: { height: 260 },
  mapPlaceholder: { height: 260, justifyContent: "center", alignItems: "center", backgroundColor: "#333" },
  mapPlaceholderText: { color: "#fff", fontSize: 16 },
  coords: { color: "#aaa", fontSize: 12, textAlign: "center", padding: 8 },
  sectionTitle: { color: "#fff", fontWeight: "700", fontSize: 14, paddingHorizontal: 16, marginTop: 8 },
  contactList: { paddingHorizontal: 12, paddingVertical: 8, maxHeight: 90 },
  noContacts: { color: "#777", fontSize: 13, padding: 8 },
  contactChip: { backgroundColor: "#2a2a2a", borderRadius: 10, padding: 10, marginRight: 8 },
  contactName: { color: "#fff", fontWeight: "700" },
  contactPhone: { color: "#ccc", fontSize: 12, marginTop: 2 },
  callBtn: { marginHorizontal: 16, padding: 16, borderRadius: 12, backgroundColor: "#d32f2f", marginTop: 10 },
  callBtnText: { color: "#fff", fontWeight: "700", textAlign: "center" },
  cancelBtn: { marginHorizontal: 16, padding: 16, borderRadius: 12, backgroundColor: "#444", marginTop: 10 },
  cancelText: { color: "#fff", fontWeight: "700", textAlign: "center" },
});
