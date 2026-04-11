import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    Alert,
    FlatList,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

export default function ContactsScreen() {
  const router = useRouter();
  const [contacts, setContacts] = useState([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    loadContacts();
  }, []);

  async function loadContacts() {
    try {
      const stored = await AsyncStorage.getItem("contacts");
      if (stored) setContacts(JSON.parse(stored));
    } catch (e) {}
  }

  async function saveContacts(list) {
    setContacts(list);
    await AsyncStorage.setItem("contacts", JSON.stringify(list));
  }

  function addContact() {
    if (!name.trim() || !phone.trim()) {
      Alert.alert("Missing info", "Please enter both name and phone number.");
      return;
    }
    const newList = [...contacts, { name: name.trim(), phone: phone.trim() }];
    saveContacts(newList);
    setName("");
    setPhone("");
  }

  function removeContact(index) {
    Alert.alert("Remove contact", `Remove ${contacts[index].name}?`, [
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          const newList = contacts.filter((_, i) => i !== index);
          saveContacts(newList);
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.hint}>
        These people will receive an SMS with your GPS location when SOS is
        triggered.
      </Text>

      {/* Add contact form */}
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Name (e.g. Mom)"
          placeholderTextColor="#666"
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={styles.input}
          placeholder="Phone number (e.g. +91 98765 43210)"
          placeholderTextColor="#666"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />
        <TouchableOpacity style={styles.addBtn} onPress={addContact}>
          <Text style={styles.addBtnText}>+ Add Contact</Text>
        </TouchableOpacity>
      </View>

      {/* Contact list */}
      {contacts.length === 0 ? (
        <Text style={styles.empty}>No contacts yet. Add at least one.</Text>
      ) : (
        <FlatList
          data={contacts}
          keyExtractor={(_, i) => i.toString()}
          renderItem={({ item, index }) => (
            <View style={styles.contactRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {item.name[0].toUpperCase()}
                </Text>
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactName}>{item.name}</Text>
                <Text style={styles.contactPhone}>{item.phone}</Text>
              </View>
              <TouchableOpacity onPress={() => removeContact(index)}>
                <Text style={styles.removeBtn}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1a1a1a", padding: 16 },
  hint: { color: "#888", fontSize: 13, marginBottom: 20, lineHeight: 20 },
  form: {
    backgroundColor: "#242424",
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#333",
  },
  input: {
    backgroundColor: "#1a1a1a",
    color: "#fff",
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    fontSize: 15,
    borderWidth: 1,
    borderColor: "#444",
  },
  addBtn: {
    backgroundColor: "#D32F2F",
    padding: 13,
    borderRadius: 8,
    alignItems: "center",
  },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  empty: { color: "#555", textAlign: "center", marginTop: 40, fontSize: 14 },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#242424",
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#333",
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#D32F2F",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: { color: "#fff", fontWeight: "900", fontSize: 18 },
  contactInfo: { flex: 1 },
  contactName: { color: "#fff", fontSize: 15, fontWeight: "700" },
  contactPhone: { color: "#888", fontSize: 13, marginTop: 2 },
  removeBtn: { color: "#D32F2F", fontSize: 18, fontWeight: "700", padding: 4 },
});
