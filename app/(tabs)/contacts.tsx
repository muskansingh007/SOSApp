import { ThemedAlert, useThemedAlert } from "@/components/ThemedAlert";
import { useTheme } from "@/context/ThemeContext";
import { validatePhoneNumber } from "@/utils/validation";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
    Animated,
    Keyboard,
    KeyboardAvoidingView,
    PanResponder,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface Contact {
  id: string;
  name: string;
  phone: string;
  relation: string;
}

const RELATIONS = ["Parent", "Sibling", "Partner", "Friend", "Colleague", "Other"];
const ACCENT_COLORS = ["gold", "blue", "green", "purple", "red"] as const;
const ACCENT_BGS = ["goldMid", "blueDim", "greenDim", "purpleDim", "redDim"] as const;
const MAX_CONTACTS = 5;

// ─── Contact Form ─────────────────────────────────────────────────────────────
function ContactForm({
  C, initial, onSave, onCancel, isEdit, onValidationError,
}: {
  C: any; initial?: Contact;
  onSave: (c: Omit<Contact, "id">) => void;
  onCancel: () => void;
  isEdit?: boolean;
  onValidationError: (title: string, message: string) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [relation, setRelation] = useState(initial?.relation ?? "Friend");

  function handleSave() {
    if (!name.trim()) {
      onValidationError("Name Required", "Please enter the contact's name.");
      return;
    }
    const phoneError = validatePhoneNumber(phone);
    if (phoneError) {
      onValidationError("Invalid Phone Number", phoneError);
      return;
    }
    onSave({ name: name.trim(), phone: phone.trim(), relation });
  }

  return (
    <View style={[styles.formCard, { backgroundColor: C.cardBg, borderColor: isEdit ? C.gold : C.gold + "55" }]}>
      <Text style={[styles.formTitle, { color: C.goldText }]}>{isEdit ? "Edit Contact" : "New Contact"}</Text>

      <Text style={[styles.formLabel, { color: C.textMuted }]}>FULL NAME</Text>
      <TextInput value={name} onChangeText={setName} placeholder="e.g. Priya Sharma"
        placeholderTextColor={C.textDim} autoCapitalize="words"
        style={[styles.input, { backgroundColor: C.inputBg, borderColor: C.inputBorder, color: C.textPrimary }]} />

      <Text style={[styles.formLabel, { color: C.textMuted }]}>PHONE NUMBER</Text>
      <TextInput value={phone} onChangeText={setPhone} placeholder="+91 98765 43210"
        onEndEditing={() => {
          const phoneError = validatePhoneNumber(phone);
          if (phone.trim() && phoneError) onValidationError("Invalid Phone Number", phoneError);
        }}
        placeholderTextColor={C.textDim} keyboardType="phone-pad"
        style={[styles.input, {
          backgroundColor: C.inputBg,
          borderColor: phone && validatePhoneNumber(phone) ? C.red : C.inputBorder,
          color: C.textPrimary,
        }]} />
      {phone.length > 0 && validatePhoneNumber(phone) && (
        <Text style={[styles.phoneError, { color: C.red }]}>{validatePhoneNumber(phone)}</Text>
      )}

      <Text style={[styles.formLabel, { color: C.textMuted }]}>RELATION</Text>
      <View style={styles.relationGrid}>
        {RELATIONS.map((r) => (
          <TouchableOpacity key={r} onPress={() => setRelation(r)}
            style={[styles.relationChip, { backgroundColor: relation === r ? C.goldMid : C.bgTertiary, borderColor: relation === r ? C.gold : C.border }]}>
            <Text style={[styles.relationChipTxt, { color: relation === r ? C.goldText : C.textMuted }]}>{r}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.formBtns}>
        <TouchableOpacity onPress={onCancel} style={[styles.formBtn, { backgroundColor: C.bgTertiary, borderColor: C.border }]}>
          <Text style={[styles.formBtnTxt, { color: C.textMuted }]}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSave} style={[styles.formBtn, { backgroundColor: C.gold }]}>
          <Text style={[styles.formBtnTxt, { color: C.mode === "dark" ? "#0A0A0A" : "#fff" }]}>{isEdit ? "Update" : "Add Contact"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Draggable Contact Card ───────────────────────────────────────────────────
function ContactCard({
  contact, index, onEdit, onDelete, C, totalContacts, onDragEnd,
}: {
  contact: Contact; index: number; onEdit: () => void; onDelete: () => void;
  C: any; totalContacts: number; onDragEnd: (from: number, to: number) => void;
}) {
  const color = C[ACCENT_COLORS[index % ACCENT_COLORS.length]];
  const bg = C[ACCENT_BGS[index % ACCENT_BGS.length]];
  const ORDER_LABELS = ["1st", "2nd", "3rd", "4th", "5th"];
  const dragY = useRef(new Animated.Value(0)).current;
  const CARD_HEIGHT = 130;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 5,
      onPanResponderGrant: () => { dragY.setValue(0); },
      onPanResponderMove: (_, gs) => { dragY.setValue(gs.dy); },
      onPanResponderRelease: (_, gs) => {
        const moved = Math.round(gs.dy / CARD_HEIGHT);
        const newIdx = Math.max(0, Math.min(totalContacts - 1, index + moved));
        Animated.spring(dragY, { toValue: 0, useNativeDriver: true }).start();
        if (newIdx !== index) onDragEnd(index, newIdx);
      },
    })
  ).current;

  const initials = contact.name.split(" ").map((w) => w[0]).filter(Boolean).join("").toUpperCase().slice(0, 2);

  return (
    <Animated.View style={[styles.contactCard, {
      backgroundColor: C.cardBg,
      borderColor: index === 0 ? C.gold : C.cardBorder,
      borderWidth: index === 0 ? 1.5 : 1,
      transform: [{ translateY: dragY }],
    }]}>
      <View style={[styles.priorityBadge, { backgroundColor: bg, borderColor: color + "55" }]}>
        <Text style={[styles.priorityTxt, { color }]}>{ORDER_LABELS[index]}</Text>
      </View>
      <View style={styles.cardMain}>
        <View {...panResponder.panHandlers} style={styles.dragHandle}>
          {[0, 1, 2].map(i => <View key={i} style={[styles.dragBar, { backgroundColor: C.textDim }]} />)}
        </View>
        <View style={[styles.avatar, { backgroundColor: bg }]}>
          <Text style={[styles.avatarTxt, { color }]}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.contactName, { color: C.textPrimary }]}>{contact.name}</Text>
          <Text style={[styles.contactPhone, { color: C.textMuted }]}>{contact.phone}</Text>
          <View style={[styles.relationBadge, { backgroundColor: bg, borderColor: color + "44" }]}>
            <Text style={[styles.relationTxt, { color }]}>{contact.relation}</Text>
          </View>
        </View>
      </View>
      <View style={[styles.cardActions, { borderTopColor: C.border }]}>
        {index === 0 && (
          <View style={[styles.primaryBadge, { backgroundColor: C.goldMid, borderColor: C.gold + "55" }]}>
            <Text style={[styles.primaryBadgeTxt, { color: C.goldText }]}>★ PRIMARY — Called First</Text>
          </View>
        )}
        <View style={styles.actionBtns}>
          <TouchableOpacity onPress={onEdit} style={[styles.actionBtn, { backgroundColor: C.bgTertiary, borderColor: C.border }]}>
            <Text style={[styles.actionBtnTxt, { color: C.textMuted }]}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} style={[styles.actionBtn, { backgroundColor: C.redDim, borderColor: C.red + "44" }]}>
            <Text style={[styles.actionBtnTxt, { color: C.red }]}>Remove</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

function EmptyState({ C, onAdd }: { C: any; onAdd: () => void }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>👥</Text>
      <Text style={[styles.emptyTitle, { color: C.textPrimary }]}>No Emergency Contacts</Text>
      <Text style={[styles.emptySub, { color: C.textMuted }]}>
        Add up to 5 trusted people who will be alerted when you trigger SOS. The first contact is called automatically.
      </Text>
      <TouchableOpacity onPress={onAdd} style={[styles.emptyBtn, { backgroundColor: C.gold }]}>
        <Text style={[styles.emptyBtnTxt, { color: C.mode === "dark" ? "#0A0A0A" : "#fff" }]}>+ Add First Contact</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ContactsScreen() {
  const { theme: C } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { visible, config, showAlert, hideAlert } = useThemedAlert();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  useEffect(() => { loadContacts(); }, []);

  async function loadContacts() {
    const v = await AsyncStorage.getItem("contacts");
    if (v) setContacts(JSON.parse(v));
  }

  async function saveContacts(list: Contact[]) {
    setContacts(list);
    await AsyncStorage.setItem("contacts", JSON.stringify(list));
  }

  function handleAdd(data: Omit<Contact, "id">) {
    saveContacts([...contacts, { ...data, id: Date.now().toString() }]);
    setShowForm(false);
    Keyboard.dismiss();
  }

  function handleEdit(data: Omit<Contact, "id">) {
    if (!editingContact) return;
    saveContacts(contacts.map((c) => c.id === editingContact.id ? { ...data, id: c.id } : c));
    setEditingContact(null);
    Keyboard.dismiss();
  }

  function handleDelete(id: string) {
    const contact = contacts.find((c) => c.id === id);
    showAlert({
      title: `Remove ${contact?.name}?`,
      message: "They will no longer receive SOS alerts.",
      buttons: [
        { label: "Cancel", onPress: () => {} },
        {
          label: "Remove", destructive: true,
          onPress: () => saveContacts(contacts.filter((c) => c.id !== id)),
        },
      ],
    });
  }

  function handleDragEnd(from: number, to: number) {
    const list = [...contacts];
    const [removed] = list.splice(from, 1);
    list.splice(to, 0, removed);
    saveContacts(list);
  }

  function handleValidationError(title: string, message: string) {
    Keyboard.dismiss();
    setTimeout(() => {
      showAlert({
        title,
        message,
        buttons: [{ label: "OK", onPress: () => {}, primary: true }],
      });
    }, 80);
  }

  const canAddMore = contacts.length < MAX_CONTACTS;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.root, { backgroundColor: C.bg, paddingTop: insets.top }]}>
        <StatusBar barStyle={C.statusBarStyle} backgroundColor={C.bg} />

        <View style={[styles.topNav, { borderBottomColor: C.border }]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <Text style={[styles.backBtn, { color: C.gold }]}>←</Text>
          </TouchableOpacity>
          <Text style={[styles.navTitle, { color: C.textPrimary }]}>Emergency Contacts</Text>
          <TouchableOpacity onPress={() => { setEditingContact(null); setShowForm(true); }}
            disabled={!canAddMore || showForm} hitSlop={12}>
            <Text style={[styles.addBtn, { color: canAddMore && !showForm ? C.gold : C.textDim }]}>Add</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}>

          <View style={[styles.infoBanner, { backgroundColor: C.goldMid, borderColor: C.gold + "44" }]}>
            <Text style={styles.infoEmoji}>⚡</Text>
            <Text style={[styles.infoTxt, { color: C.textSecondary }]}>
              Up to {MAX_CONTACTS} contacts · {contacts.length} added ·{" "}
              <Text style={{ color: C.goldText, fontWeight: "800" }}>1st contact called automatically on SOS</Text>
            </Text>
          </View>

          {contacts.length > 1 && (
            <View style={[styles.dragHint, { backgroundColor: C.bgTertiary, borderColor: C.border }]}>
              <Text style={[styles.dragHintTxt, { color: C.textDim }]}>☰  Drag the handle to reorder priority</Text>
            </View>
          )}

          {showForm && !editingContact && (
            <>
              <Text style={[styles.sectionLabel, { color: C.sectionHeader }]}>NEW CONTACT</Text>
              <ContactForm C={C} onSave={handleAdd} onCancel={() => setShowForm(false)}
                onValidationError={handleValidationError} />
            </>
          )}

          {editingContact && (
            <>
              <Text style={[styles.sectionLabel, { color: C.sectionHeader }]}>EDITING CONTACT</Text>
              <ContactForm C={C} initial={editingContact} onSave={handleEdit}
                onCancel={() => setEditingContact(null)} isEdit onValidationError={handleValidationError} />
            </>
          )}

          {contacts.length === 0 && !showForm ? (
            <EmptyState C={C} onAdd={() => setShowForm(true)} />
          ) : (
            contacts.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { color: C.sectionHeader }]}>{`YOUR CONTACTS · ${contacts.length}/${MAX_CONTACTS}`}</Text>
                <View style={styles.contactsList}>
                  {contacts.map((contact, i) => (
                    <ContactCard key={contact.id} contact={contact} index={i} totalContacts={contacts.length}
                      onEdit={() => { setShowForm(false); setEditingContact(contact); }}
                      onDelete={() => handleDelete(contact.id)}
                      onDragEnd={handleDragEnd} C={C} />
                  ))}
                </View>
              </>
            )
          )}

          {contacts.length > 0 && canAddMore && !showForm && !editingContact && (
            <TouchableOpacity onPress={() => { setEditingContact(null); setShowForm(true); }}
              style={[styles.addMoreBtn, { borderColor: C.gold + "55", backgroundColor: C.goldMid }]}>
              <Text style={[styles.addMoreTxt, { color: C.goldText }]}>+ Add Contact ({contacts.length}/{MAX_CONTACTS})</Text>
            </TouchableOpacity>
          )}

          {!canAddMore && (
            <View style={[styles.maxBanner, { backgroundColor: C.bgTertiary, borderColor: C.border }]}>
              <Text style={[styles.maxTxt, { color: C.textMuted }]}>✓ Maximum {MAX_CONTACTS} contacts added.</Text>
            </View>
          )}
        </ScrollView>

        <ThemedAlert visible={visible} title={config.title} message={config.message}
          buttons={config.buttons} C={C} onClose={hideAlert} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  backBtn: { fontSize: 22, fontWeight: "700", width: 36 },
  navTitle: { fontSize: 15, fontWeight: "900", letterSpacing: 0.5 },
  addBtn: { fontSize: 14, fontWeight: "800" },
  scrollContent: { padding: 16 },
  infoBanner: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 4 },
  infoEmoji: { fontSize: 16 },
  infoTxt: { flex: 1, fontSize: 12, fontWeight: "600", lineHeight: 17 },
  dragHint: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, marginTop: 8, marginBottom: 4 },
  dragHintTxt: { fontSize: 11, fontWeight: "600" },
  sectionLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 2, marginTop: 20, marginBottom: 10, marginLeft: 4 },
  formCard: { borderRadius: 16, borderWidth: 1, padding: 18, gap: 10 },
  formTitle: { fontSize: 14, fontWeight: "900", marginBottom: 4 },
  formLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 1.5, marginBottom: 2 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 13, fontWeight: "600", marginBottom: 4 },
  phoneError: { fontSize: 10, fontWeight: "600", marginTop: -2, marginBottom: 4 },
  relationGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  relationChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18, borderWidth: 1 },
  relationChipTxt: { fontSize: 11, fontWeight: "700" },
  formBtns: { flexDirection: "row", gap: 10, marginTop: 8 },
  formBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: "center", borderWidth: 1 },
  formBtnTxt: { fontSize: 13, fontWeight: "800" },
  contactsList: { gap: 12 },
  contactCard: { borderRadius: 16, overflow: "hidden" },
  priorityBadge: { alignSelf: "flex-start", marginLeft: 14, marginTop: 12, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  priorityTxt: { fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
  cardMain: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, paddingTop: 8 },
  dragHandle: { width: 20, height: 36, justifyContent: "center", alignItems: "center", gap: 4 },
  dragBar: { width: 14, height: 2, borderRadius: 1 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  avatarTxt: { fontSize: 17, fontWeight: "900" },
  contactName: { fontSize: 15, fontWeight: "800", marginBottom: 2 },
  contactPhone: { fontSize: 12, fontWeight: "500", marginBottom: 5 },
  relationBadge: { alignSelf: "flex-start", paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  relationTxt: { fontSize: 9, fontWeight: "800" },
  cardActions: { borderTopWidth: 1, paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  primaryBadge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1 },
  primaryBadgeTxt: { fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
  actionBtns: { flexDirection: "row", gap: 8 },
  actionBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: "center", borderWidth: 1 },
  actionBtnTxt: { fontSize: 12, fontWeight: "700" },
  emptyState: { alignItems: "center", paddingVertical: 48, gap: 12, paddingHorizontal: 16 },
  emptyEmoji: { fontSize: 52 },
  emptyTitle: { fontSize: 18, fontWeight: "900" },
  emptySub: { fontSize: 13, fontWeight: "500", textAlign: "center", lineHeight: 20 },
  emptyBtn: { marginTop: 8, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 },
  emptyBtnTxt: { fontSize: 14, fontWeight: "900" },
  addMoreBtn: { marginTop: 12, paddingVertical: 14, borderRadius: 14, alignItems: "center", borderWidth: 1, borderStyle: "dashed" },
  addMoreTxt: { fontSize: 13, fontWeight: "700" },
  maxBanner: { marginTop: 12, padding: 14, borderRadius: 12, borderWidth: 1, alignItems: "center" },
  maxTxt: { fontSize: 12, fontWeight: "600", textAlign: "center" },
});
