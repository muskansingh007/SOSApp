import { useTheme } from "@/context/ThemeContext";
import { validateOptionalEmailAddress, validateOptionalPhoneNumber } from "@/utils/validation";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  Keyboard,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface Profile {
  name: string;
  phone: string;
  email: string;
  bloodGroup: string;
  medicalNotes: string;
}

const DEFAULTS: Profile = {
  name: "",
  phone: "",
  email: "",
  bloodGroup: "",
  medicalNotes: "",
};

const BLOOD_GROUPS = ["A+", "A−", "B+", "B−", "AB+", "AB−", "O+", "O−"];

// ─── Themed Alert Modal ───────────────────────────────────────────────────────
function ThemedAlert({
  visible,
  title,
  message,
  buttons,
  C,
  onClose,
}: {
  visible: boolean;
  title: string;
  message?: string;
  buttons: { label: string; onPress: () => void; destructive?: boolean; primary?: boolean }[];
  C: any;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={alertStyles.overlay}>
        <View style={[alertStyles.card, { backgroundColor: C.bgSecondary, borderColor: C.cardBorder }]}>
          <Text style={[alertStyles.title, { color: C.textPrimary }]}>{title}</Text>
          {message && <Text style={[alertStyles.message, { color: C.textMuted }]}>{message}</Text>}
          <View style={alertStyles.btns}>
            {buttons.map((btn) => (
              <TouchableOpacity
                key={btn.label}
                onPress={btn.onPress}
                style={[
                  alertStyles.btn,
                  {
                    backgroundColor: btn.destructive ? C.redDim : btn.primary ? C.gold : C.bgTertiary,
                    borderColor: btn.destructive ? C.red + "55" : btn.primary ? C.gold : C.border,
                  },
                ]}
              >
                <Text
                  style={[
                    alertStyles.btnTxt,
                    { color: btn.destructive ? C.red : btn.primary ? (C.mode === "dark" ? "#0A0A0A" : "#fff") : C.textMuted },
                  ]}
                >
                  {btn.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const alertStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "center", padding: 32 },
  card: { width: "100%", maxWidth: 320, borderRadius: 18, borderWidth: 1, padding: 24, gap: 12 },
  title: { fontSize: 16, fontWeight: "900", textAlign: "center" },
  message: { fontSize: 13, fontWeight: "500", textAlign: "center", lineHeight: 19 },
  btns: { flexDirection: "row", gap: 10, marginTop: 4 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center", borderWidth: 1 },
  btnTxt: { fontSize: 13, fontWeight: "800" },
});

function SectionHeader({ label, C }: { label: string; C: any }) {
  return <Text style={[styles.sectionHeader, { color: C.sectionHeader }]}>{label}</Text>;
}

function FieldLabel({ label, C }: { label: string; C: any }) {
  return <Text style={[styles.fieldLabel, { color: C.textMuted }]}>{label}</Text>;
}

export default function EditProfileScreen() {
  const { theme: C } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [profile, setProfile] = useState<Profile>(DEFAULTS);
  const [saved, setSaved] = useState(false);

  // Themed alert state
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    title: string; message?: string;
    buttons: { label: string; onPress: () => void; destructive?: boolean; primary?: boolean }[];
  }>({ title: "", buttons: [] });

  function showAlert(config: typeof alertConfig) {
    setAlertConfig(config);
    setAlertVisible(true);
  }

  function showValidationAlert(title: string, message: string) {
    Keyboard.dismiss();
    setTimeout(() => {
      showAlert({
        title,
        message,
        buttons: [{ label: "OK", onPress: () => setAlertVisible(false), primary: true }],
      });
    }, 80);
  }

  useEffect(() => {
    AsyncStorage.getItem("profile").then((v) => {
      if (v) setProfile({ ...DEFAULTS, ...JSON.parse(v) });
    });
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []);

  function update(patch: Partial<Profile>) {
    setProfile((p) => ({ ...p, ...patch }));
    setSaved(false);
  }

  async function handleSave() {
    if (!profile.name.trim()) {
      showValidationAlert("Name Required", "Please enter your name to save your profile.");
      return;
    }
    const phoneError = validateOptionalPhoneNumber(profile.phone);
    const emailError = validateOptionalEmailAddress(profile.email);
    if (phoneError && emailError) {
      showValidationAlert(
        "Invalid Phone and Email",
        "Please enter a valid phone number and email address."
      );
      return;
    }
    if (phoneError) {
      showValidationAlert("Invalid Phone Number", phoneError);
      return;
    }
    if (emailError) {
      showValidationAlert("Invalid Email", emailError);
      return;
    }
    await AsyncStorage.setItem("profile", JSON.stringify(profile));
    setSaved(true);
    showAlert({
      title: "Profile Saved",
      message: "Your profile has been updated successfully.",
      buttons: [{ label: "OK", onPress: () => { setAlertVisible(false); router.back(); }, primary: true }],
    });
  }

  async function handleClear() {
    showAlert({
      title: "Clear Profile?",
      message: "This will delete all your profile information.",
      buttons: [
        { label: "Cancel", onPress: () => setAlertVisible(false) },
        {
          label: "Clear", destructive: true,
          onPress: async () => {
            setAlertVisible(false);
            await AsyncStorage.removeItem("profile");
            setProfile(DEFAULTS);
            setSaved(false);
          },
        },
      ],
    });
  }

  const initials =
    profile.name.split(" ").map((w) => w[0]).filter(Boolean).join("").toUpperCase().slice(0, 2) || "?";

  return (
    <View style={[styles.root, { backgroundColor: C.bg, paddingTop: insets.top }]}>
      <StatusBar barStyle={C.statusBarStyle} backgroundColor={C.bg} />

      {/* ── Top Nav ── */}
      <View style={[styles.topNav, { borderBottomColor: C.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={[styles.backBtn, { color: C.gold }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: C.textPrimary }]}>Edit Profile</Text>
        <TouchableOpacity onPress={handleSave} hitSlop={12}>
          <Text style={[styles.saveBtn, { color: C.gold }]}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
      >
        {/* ── Avatar ── */}
        <View style={styles.avatarSection}>
          <View style={[styles.avatarRing, { borderColor: C.gold }]}>
            <View style={[styles.avatar, { backgroundColor: C.goldMid }]}>
              <Text style={[styles.avatarTxt, { color: C.goldText }]}>{initials}</Text>
            </View>
          </View>
          <Text style={[styles.avatarHint, { color: C.textDim }]}>
            Your initials are shown on the home screen
          </Text>
        </View>

        {/* ── Personal Info ── */}
        <SectionHeader label="PERSONAL INFORMATION" C={C} />
        <View style={[styles.card, { backgroundColor: C.cardBg, borderColor: C.cardBorder }]}>
          <FieldLabel label="FULL NAME *" C={C} />
          <TextInput value={profile.name} onChangeText={(v) => update({ name: v })}
            placeholder="e.g. Riya Sharma" placeholderTextColor={C.textDim}
            style={[styles.input, { backgroundColor: C.inputBg, borderColor: C.inputBorder, color: C.textPrimary }]} />
          <View style={[styles.divider, { backgroundColor: C.border }]} />
          <FieldLabel label="PHONE NUMBER" C={C} />
          <TextInput value={profile.phone} onChangeText={(v) => update({ phone: v })}
            onEndEditing={() => {
              const error = validateOptionalPhoneNumber(profile.phone);
              if (error) showValidationAlert("Invalid Phone Number", error);
            }}
            placeholder="+91 98765 43210" placeholderTextColor={C.textDim} keyboardType="phone-pad"
            style={[styles.input, {
              backgroundColor: C.inputBg,
              borderColor: validateOptionalPhoneNumber(profile.phone) ? C.red : C.inputBorder,
              color: C.textPrimary,
            }]} />
          <View style={[styles.divider, { backgroundColor: C.border }]} />
          <FieldLabel label="EMAIL" C={C} />
          <TextInput value={profile.email} onChangeText={(v) => update({ email: v })}
            onEndEditing={() => {
              const error = validateOptionalEmailAddress(profile.email);
              if (error) showValidationAlert("Invalid Email", error);
            }}
            placeholder="you@example.com" placeholderTextColor={C.textDim}
            keyboardType="email-address" autoCapitalize="none"
            style={[styles.input, {
              backgroundColor: C.inputBg,
              borderColor: validateOptionalEmailAddress(profile.email) ? C.red : C.inputBorder,
              color: C.textPrimary,
            }]} />
        </View>

        {/* ── Medical Info ── */}
        <SectionHeader label="MEDICAL INFORMATION" C={C} />
        <View style={[styles.card, { backgroundColor: C.cardBg, borderColor: C.cardBorder }]}>
          <FieldLabel label="BLOOD GROUP" C={C} />
          <View style={styles.bloodGrid}>
            {BLOOD_GROUPS.map((bg) => (
              <TouchableOpacity key={bg} onPress={() => update({ bloodGroup: bg })}
                style={[styles.bloodChip, {
                  backgroundColor: profile.bloodGroup === bg ? C.redDim : C.bgTertiary,
                  borderColor: profile.bloodGroup === bg ? C.red : C.border,
                }]}>
                <Text style={[styles.bloodChipTxt, { color: profile.bloodGroup === bg ? C.red : C.textMuted }]}>{bg}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={[styles.divider, { backgroundColor: C.border }]} />
          <FieldLabel label="MEDICAL NOTES" C={C} />
          <TextInput value={profile.medicalNotes} onChangeText={(v) => update({ medicalNotes: v })}
            placeholder="Allergies, conditions, medications..."
            placeholderTextColor={C.textDim} multiline numberOfLines={4} textAlignVertical="top"
            style={[styles.inputMulti, { backgroundColor: C.inputBg, borderColor: C.inputBorder, color: C.textPrimary }]} />
          <Text style={[styles.hint, { color: C.textDim }]}>Shown to emergency responders if needed</Text>
        </View>

        {/* ── Save button ── */}
        <TouchableOpacity onPress={handleSave} style={[styles.saveFullBtn, { backgroundColor: C.gold }]}>
          <Text style={[styles.saveFullBtnTxt, { color: C.mode === "dark" ? "#0A0A0A" : "#fff" }]}>
            {saved ? "✓ Saved" : "Save Profile"}
          </Text>
        </TouchableOpacity>

        {/* ── Clear ── */}
        <TouchableOpacity onPress={handleClear}
          style={[styles.clearBtn, { borderColor: C.border, backgroundColor: C.bgTertiary }]}>
          <Text style={[styles.clearBtnTxt, { color: C.textMuted }]}>Clear</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ── Themed Alert ── */}
      <ThemedAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
        C={C}
        onClose={() => setAlertVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  backBtn: { fontSize: 22, fontWeight: "700", width: 36 },
  navTitle: { fontSize: 15, fontWeight: "900", letterSpacing: 0.5 },
  saveBtn: { fontSize: 14, fontWeight: "800" },
  scrollContent: { padding: 16 },
  avatarSection: { alignItems: "center", paddingVertical: 24, gap: 10 },
  avatarRing: { width: 96, height: 96, borderRadius: 48, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  avatar: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  avatarTxt: { fontSize: 28, fontWeight: "900" },
  avatarHint: { fontSize: 10, fontWeight: "600", letterSpacing: 0.3 },
  sectionHeader: { fontSize: 9, fontWeight: "800", letterSpacing: 2, marginTop: 20, marginBottom: 10, marginLeft: 4 },
  card: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 10 },
  fieldLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 1.5 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, fontWeight: "600" },
  inputMulti: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, fontWeight: "500", minHeight: 100 },
  hint: { fontSize: 10, fontWeight: "500" },
  divider: { height: 1, marginVertical: 4 },
  bloodGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  bloodChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  bloodChipTxt: { fontSize: 12, fontWeight: "800" },
  saveFullBtn: { marginTop: 24, paddingVertical: 15, borderRadius: 14, alignItems: "center" },
  saveFullBtnTxt: { fontSize: 15, fontWeight: "900" },
  clearBtn: { marginTop: 10, paddingVertical: 13, borderRadius: 14, alignItems: "center", borderWidth: 1 },
  clearBtnTxt: { fontSize: 13, fontWeight: "700" },
});
