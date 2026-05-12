import SafeCheckInModal from "@/components/modals/SafeCheckInModal";
import WalkHomeModal from "@/components/modals/WalkHomeModal";
import { ThemedAlert, useThemedAlert } from "@/components/ThemedAlert";
import { useTheme } from "@/context/ThemeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface SettingsState {
  sosTriggerMethod: "hold" | "shake" | "both";
  countdownDuration: number;
  autoCallContacts: boolean;
  shakeSensitivity: "low" | "medium" | "high";
  sosMessage: string;
  includeLocationLink: boolean;
  autoAudioRecording: boolean;
  autoVideoRecording: boolean;
  notificationsEnabled: boolean;
  soundEnabled: boolean;
}

const DEFAULTS: SettingsState = {
  sosTriggerMethod: "hold",
  countdownDuration: 3,
  autoCallContacts: true,
  shakeSensitivity: "medium",
  sosMessage: "🆘 I need help! This is an emergency.",
  includeLocationLink: true,
  autoAudioRecording: false,
  autoVideoRecording: false,
  notificationsEnabled: true,
  soundEnabled: true,
};

function SectionHeader({ label, C }: { label: string; C: any }) {
  return <Text style={[styles.sectionHeader, { color: C.sectionHeader }]}>{label}</Text>;
}

function SettingRow({ C, label, sub, children, onPress, isLast }: {
  C: any; label: string; sub?: string; children?: React.ReactNode;
  onPress?: () => void; isLast?: boolean;
}) {
  const inner = (
    <View style={[styles.settingRow, {
      backgroundColor: C.cardBg, borderColor: C.cardBorder,
      borderBottomWidth: isLast ? 1 : 0,
      borderBottomLeftRadius: isLast ? 14 : 0,
      borderBottomRightRadius: isLast ? 14 : 0,
    }]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, { color: C.textPrimary }]}>{label}</Text>
        {sub && <Text style={[styles.rowSub, { color: C.textMuted }]}>{sub}</Text>}
      </View>
      {children}
    </View>
  );
  if (onPress) return <TouchableOpacity onPress={onPress} activeOpacity={0.7}>{inner}</TouchableOpacity>;
  return inner;
}

function SettingCard({ children }: { children: React.ReactNode }) {
  return <View style={styles.settingCard}>{children}</View>;
}

function Toggle({ value, onChange, C }: { value: boolean; onChange: (v: boolean) => void; C: any }) {
  return (
    <Switch value={value} onValueChange={onChange}
      trackColor={{ false: C.toggleTrackOff, true: C.toggleTrackOn }}
      thumbColor={value ? C.goldText : C.textMuted}
      ios_backgroundColor={C.toggleTrackOff} />
  );
}

function ChipSelector({ options, value, onChange, C }: {
  options: { label: string; value: string }[]; value: string; onChange: (v: any) => void; C: any;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((o) => (
        <TouchableOpacity key={o.value} onPress={() => onChange(o.value)}
          style={[styles.chip, { backgroundColor: value === o.value ? C.goldMid : C.bgTertiary, borderColor: value === o.value ? C.gold : C.border }]}>
          <Text style={[styles.chipTxt, { color: value === o.value ? C.goldText : C.textMuted }]}>{o.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function SOSMessageModal({ visible, value, onSave, onClose, C }: {
  visible: boolean; value: string; onSave: (v: string) => void; onClose: () => void; C: any;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.msgOverlay}>
        <View style={[styles.msgCard, { backgroundColor: C.bgSecondary, borderColor: C.cardBorder }]}>
          <Text style={[styles.msgTitle, { color: C.textPrimary }]}>SOS Message</Text>
          <Text style={[styles.msgSub, { color: C.textMuted }]}>Sent to contacts when SOS is triggered</Text>
          <TextInput value={draft} onChangeText={setDraft} multiline maxLength={160}
            style={[styles.msgInput, { backgroundColor: C.inputBg, borderColor: C.inputBorder, color: C.textPrimary }]}
            placeholderTextColor={C.textMuted} />
          <Text style={[styles.msgCount, { color: C.textDim }]}>{draft.length}/160</Text>
          <View style={styles.msgBtns}>
            <TouchableOpacity onPress={onClose} style={[styles.msgBtn, { backgroundColor: C.bgTertiary, borderColor: C.border }]}>
              <Text style={[styles.msgBtnTxt, { color: C.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { onSave(draft); onClose(); }} style={[styles.msgBtn, { backgroundColor: C.gold }]}>
              <Text style={[styles.msgBtnTxt, { color: C.bg }]}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function FakeCallNameModal({ visible, value, onSave, onClose, C }: {
  visible: boolean; value: string; onSave: (v: string) => void; onClose: () => void; C: any;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const SUGGESTIONS = ["Mom", "Dad", "Boss", "Doctor", "Friend", "Sister"];
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.msgOverlay}>
        <View style={[styles.msgCard, { backgroundColor: C.bgSecondary, borderColor: C.cardBorder }]}>
          <Text style={[styles.msgTitle, { color: C.textPrimary }]}>Fake Call Name</Text>
          <Text style={[styles.msgSub, { color: C.textMuted }]}>Name shown on the incoming call screen</Text>
          <TextInput
            value={draft} onChangeText={setDraft}
            placeholder="e.g. Mom, Boss, Dr. Mehta..."
            placeholderTextColor={C.textMuted}
            autoCapitalize="words"
            style={[styles.msgInput, { backgroundColor: C.inputBg, borderColor: C.inputBorder, color: C.textPrimary, minHeight: 48, textAlignVertical: "center" }]}
          />
          <View style={styles.chipRow}>
            {SUGGESTIONS.map((s) => (
              <TouchableOpacity key={s} onPress={() => setDraft(s)}
                style={[styles.chip, { backgroundColor: draft === s ? C.goldMid : C.bgTertiary, borderColor: draft === s ? C.gold : C.border }]}>
                <Text style={[styles.chipTxt, { color: draft === s ? C.goldText : C.textMuted }]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.msgBtns}>
            <TouchableOpacity onPress={onClose} style={[styles.msgBtn, { backgroundColor: C.bgTertiary, borderColor: C.border }]}>
              <Text style={[styles.msgBtnTxt, { color: C.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { onSave(draft.trim() || "Mom"); onClose(); }} style={[styles.msgBtn, { backgroundColor: C.gold }]}>
              <Text style={[styles.msgBtnTxt, { color: C.bg }]}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function SettingsScreen() {
  const { theme: C, isDark, toggleTheme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { visible, config, showAlert, hideAlert } = useThemedAlert();
  const [settings, setSettings] = useState<SettingsState>(DEFAULTS);
  const [sosModalOpen, setSosModalOpen] = useState(false);
  const [fakeCallNameOpen, setFakeCallNameOpen] = useState(false);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [walkHomeOpen, setWalkHomeOpen] = useState(false);
  const [callerName, setCallerName] = useState("Mom");

  useEffect(() => {
    AsyncStorage.getItem("settings").then((v) => {
      if (v) setSettings({ ...DEFAULTS, ...JSON.parse(v) });
    });
    AsyncStorage.getItem("fake_caller_name").then((v) => {
      if (v) setCallerName(v);
    });
  }, []);

  async function save(patch: Partial<SettingsState>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    await AsyncStorage.setItem("settings", JSON.stringify(next));
  }

  async function saveCallerName(name: string) {
    setCallerName(name);
    await AsyncStorage.setItem("fake_caller_name", name);
  }

  function handleTestSOS() {
    showAlert({
      title: "Test SOS",
      message: "This will simulate an SOS trigger. No real alerts will be sent.",
      buttons: [
        { label: "Cancel", onPress: () => {} },
        {
          label: "Run Test", primary: true,
          onPress: () => {
            setTimeout(() => {
              showAlert({
                title: "✓ Test Complete",
                message: "SOS trigger works correctly. No alerts were sent.",
                buttons: [{ label: "OK", onPress: () => {}, primary: true }],
              });
            }, 200);
          },
        },
      ],
    });
  }

  async function handleLogout() {
    showAlert({
      title: "Log Out?",
      message: "This will clear all your data including contacts, settings and profile. This cannot be undone.",
      buttons: [
        { label: "Cancel", onPress: () => {} },
        {
          label: "Log Out", destructive: true,
          onPress: async () => {
            await AsyncStorage.multiRemove(["contacts", "settings", "profile", "trusted_circle", "fake_caller_name", "theme_mode", "onboarding_complete"]);
            router.replace("/onboarding");
          },
        },
      ],
    });
  }

  return (
    <View style={[styles.root, { backgroundColor: C.bg, paddingTop: insets.top }]}>
      <StatusBar barStyle={C.statusBarStyle} backgroundColor={C.bg} />

      <View style={[styles.topNav, { borderBottomColor: C.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={[styles.backBtn, { color: C.gold }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: C.textPrimary }]}>Settings</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}>

        <SectionHeader label="PROFILE" C={C} />
        <SettingCard>
          <SettingRow C={C} label="Edit Profile" sub="Name, photo, personal info" onPress={() => router.push("/edit-profile")} isLast={false}>
            <Text style={[styles.arrow, { color: C.textDim }]}>›</Text>
          </SettingRow>
          <SettingRow C={C} label="Emergency Contacts" sub="Manage your contacts" onPress={() => router.push("/contacts")} isLast={false}>
            <Text style={[styles.arrow, { color: C.textDim }]}>›</Text>
          </SettingRow>
          <SettingRow C={C} label="Trusted Circle" sub="People who can see your location" onPress={() => router.push("/trusted-circle")} isLast>
            <Text style={[styles.arrow, { color: C.textDim }]}>›</Text>
          </SettingRow>
        </SettingCard>

        <SectionHeader label="SOS TRIGGER" C={C} />
        <SettingCard>
          <SettingRow C={C} label="Trigger Method" sub="How SOS is activated" isLast={false}>
            <ChipSelector options={[{ label: "Hold", value: "hold" }, { label: "Shake", value: "shake" }, { label: "Both", value: "both" }]}
              value={settings.sosTriggerMethod} onChange={(v) => save({ sosTriggerMethod: v })} C={C} />
          </SettingRow>
          <SettingRow C={C} label="Countdown Duration" sub={`${settings.countdownDuration}s before SOS fires`} isLast={false}>
            <ChipSelector options={[{ label: "1s", value: "1" }, { label: "3s", value: "3" }, { label: "5s", value: "5" }]}
              value={String(settings.countdownDuration)} onChange={(v) => save({ countdownDuration: Number(v) })} C={C} />
          </SettingRow>
          <SettingRow C={C} label="Auto Call Contacts" sub="Call first contact after SOS" isLast={false}>
            <Toggle value={settings.autoCallContacts} onChange={(v) => save({ autoCallContacts: v })} C={C} />
          </SettingRow>
          <SettingRow C={C} label="Shake Sensitivity" sub="How hard to shake to trigger" isLast={false}>
            <ChipSelector options={[{ label: "Low", value: "low" }, { label: "Med", value: "medium" }, { label: "High", value: "high" }]}
              value={settings.shakeSensitivity} onChange={(v) => save({ shakeSensitivity: v })} C={C} />
          </SettingRow>
          <SettingRow C={C} label="SOS Message"
            sub={settings.sosMessage.length > 32 ? settings.sosMessage.slice(0, 32) + "…" : settings.sosMessage}
            onPress={() => setSosModalOpen(true)} isLast={false}>
            <Text style={[styles.arrow, { color: C.textDim }]}>›</Text>
          </SettingRow>
          <SettingRow C={C} label="Include Location Link" sub="Add GPS link to SOS message" isLast={false}>
            <Toggle value={settings.includeLocationLink} onChange={(v) => save({ includeLocationLink: v })} C={C} />
          </SettingRow>
          <SettingRow C={C} label="Test SOS" sub="Dry run — no real alerts sent" onPress={handleTestSOS} isLast>
            <View style={[styles.testBadge, { backgroundColor: C.goldMid, borderColor: C.gold }]}>
              <Text style={[styles.testBadgeTxt, { color: C.goldText }]}>RUN</Text>
            </View>
          </SettingRow>
        </SettingCard>

        <SectionHeader label="AUDIO & VIDEO" C={C} />
        <SettingCard>
          <SettingRow C={C} label="Auto Audio Recording" sub="Record audio when SOS triggers" isLast={false}>
            <Toggle value={settings.autoAudioRecording} onChange={(v) => save({ autoAudioRecording: v })} C={C} />
          </SettingRow>
          <SettingRow C={C} label="Auto Video Recording" sub="Record video when SOS triggers" isLast={false}>
            <Toggle value={settings.autoVideoRecording} onChange={(v) => save({ autoVideoRecording: v })} C={C} />
          </SettingRow>
          <SettingRow C={C} label="Recordings" sub="View & play saved recordings" onPress={() => router.push("/recordings" as any)} isLast>
            <Text style={[styles.arrow, { color: C.textDim }]}>›</Text>
          </SettingRow>
        </SettingCard>

        <SectionHeader label="FEATURES" C={C} />
        <SettingCard>
          <SettingRow C={C} label="Fake Call" sub={`Caller: ${callerName}`} onPress={() => setFakeCallNameOpen(true)} isLast={false}>
            <Text style={[styles.arrow, { color: C.textDim }]}>›</Text>
          </SettingRow>
          <SettingRow C={C} label="Safe Check-In" sub="Timer & alert settings" onPress={() => setCheckInOpen(true)} isLast={false}>
            <Text style={[styles.arrow, { color: C.textDim }]}>›</Text>
          </SettingRow>
          <SettingRow C={C} label="Walk Home Mode" sub="Route & duration settings" onPress={() => setWalkHomeOpen(true)} isLast>
            <Text style={[styles.arrow, { color: C.textDim }]}>›</Text>
          </SettingRow>
        </SettingCard>

        <SectionHeader label="NOTIFICATIONS & SOUNDS" C={C} />
        <SettingCard>
          <SettingRow C={C} label="Notifications" sub="Enable push notifications" isLast={false}>
            <Toggle value={settings.notificationsEnabled} onChange={(v) => save({ notificationsEnabled: v })} C={C} />
          </SettingRow>
          <SettingRow C={C} label="Sound" sub="Alert and check-in sounds" isLast>
            <Toggle value={settings.soundEnabled} onChange={(v) => save({ soundEnabled: v })} C={C} />
          </SettingRow>
        </SettingCard>

        <SectionHeader label="DISPLAY" C={C} />
        <SettingCard>
          <SettingRow C={C} label="Dark Mode" sub={isDark ? "Currently dark" : "Currently light"} isLast>
            <Toggle value={isDark} onChange={toggleTheme} C={C} />
          </SettingRow>
        </SettingCard>

        <SectionHeader label="PRIVACY & DATA" C={C} />
        <SettingCard>
          <SettingRow C={C} label="Privacy & Data" sub="Manage your stored data" onPress={() => router.push("/privacy")} isLast>
            <Text style={[styles.arrow, { color: C.textDim }]}>›</Text>
          </SettingRow>
        </SettingCard>

        <SectionHeader label="ACCOUNT" C={C} />
        <SettingCard>
          <SettingRow C={C} label="Log Out" sub="Clear all data and return to welcome screen" onPress={handleLogout} isLast>
            <Text style={[styles.arrow, { color: C.red }]}>›</Text>
          </SettingRow>
        </SettingCard>

        <SectionHeader label="HELP" C={C} />
        <SettingCard>
          <SettingRow C={C} label="How to Use" sub="App tutorial & guide" onPress={() => router.push("/tutorial")} isLast={false}>
            <Text style={[styles.arrow, { color: C.textDim }]}>›</Text>
          </SettingRow>
          <SettingRow C={C} label="Emergency Numbers" sub="India helplines" onPress={() => router.push("/emergency-numbers")} isLast={false}>
            <Text style={[styles.arrow, { color: C.textDim }]}>›</Text>
          </SettingRow>
          <SettingRow C={C} label="Contact Support" sub="Get help from our team" onPress={() => router.push("/support")} isLast>
            <Text style={[styles.arrow, { color: C.textDim }]}>›</Text>
          </SettingRow>
        </SettingCard>

        <Text style={[styles.version, { color: C.textDim }]}>S·O·S v1.0.0</Text>
      </ScrollView>

      <SOSMessageModal visible={sosModalOpen} value={settings.sosMessage}
        onSave={(v) => save({ sosMessage: v })} onClose={() => setSosModalOpen(false)} C={C} />
      <FakeCallNameModal visible={fakeCallNameOpen} value={callerName}
        onSave={saveCallerName} onClose={() => setFakeCallNameOpen(false)} C={C} />
      <SafeCheckInModal visible={checkInOpen} onClose={() => setCheckInOpen(false)} />
      <WalkHomeModal visible={walkHomeOpen} onClose={() => setWalkHomeOpen(false)} />
      <ThemedAlert visible={visible} title={config.title} message={config.message}
        buttons={config.buttons} C={C} onClose={hideAlert} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  backBtn: { fontSize: 22, fontWeight: "700", width: 36 },
  navTitle: { fontSize: 15, fontWeight: "900", letterSpacing: 0.5 },
  scrollContent: { padding: 16, gap: 0 },
  sectionHeader: { fontSize: 9, fontWeight: "800", letterSpacing: 2, marginTop: 20, marginBottom: 8, marginLeft: 4 },
  settingCard: { borderRadius: 14, overflow: "hidden" },
  settingRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 13, borderWidth: 1, borderTopWidth: 1, gap: 12 },
  rowLabel: { fontSize: 13, fontWeight: "700" },
  rowSub: { fontSize: 10, fontWeight: "500", marginTop: 1 },
  arrow: { fontSize: 20, fontWeight: "300" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, borderWidth: 1 },
  chipTxt: { fontSize: 10, fontWeight: "700" },
  testBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12, borderWidth: 1 },
  testBadgeTxt: { fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  version: { textAlign: "center", fontSize: 9, letterSpacing: 1.5, marginTop: 28, fontWeight: "600" },
  msgOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center", padding: 24 },
  msgCard: { width: "100%", maxWidth: 340, borderRadius: 20, borderWidth: 1, padding: 24 },
  msgTitle: { fontSize: 16, fontWeight: "900", marginBottom: 4 },
  msgSub: { fontSize: 11, fontWeight: "600", marginBottom: 14 },
  msgInput: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 13, minHeight: 90, textAlignVertical: "top", fontWeight: "500" },
  msgCount: { fontSize: 10, fontWeight: "600", textAlign: "right", marginTop: 4 },
  msgBtns: { flexDirection: "row", gap: 10, marginTop: 16 },
  msgBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center", borderWidth: 1 },
  msgBtnTxt: { fontSize: 13, fontWeight: "800" },
});