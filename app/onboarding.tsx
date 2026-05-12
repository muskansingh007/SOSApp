import { useTheme } from "@/context/ThemeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
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

// ─── Steps ────────────────────────────────────────────────────────────────────
type Step = "welcome" | "name" | "contact" | "ready";

const STEPS: Step[] = ["welcome", "name", "contact", "ready"];

// ─── Progress dots ────────────────────────────────────────────────────────────
function ProgressDots({ current, C }: { current: number; C: any }) {
  return (
    <View style={styles.dots}>
      {STEPS.map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            {
              backgroundColor: i <= current ? C.gold : C.textDim,
              width: i === current ? 20 : 6,
            },
          ]}
        />
      ))}
    </View>
  );
}

// ─── Welcome Step ─────────────────────────────────────────────────────────────
function WelcomeStep({ C, onNext }: { C: any; onNext: () => void }) {
  return (
    <View style={styles.stepContainer}>
      {/* Logo */}
      <View style={styles.logoArea}>
        <View
          style={[
            styles.logoRing,
            { borderColor: C.gold + "33" },
          ]}
        >
          <View
            style={[
              styles.logoRingInner,
              { borderColor: C.gold + "66" },
            ]}
          >
            <View style={[styles.logoCircle, { backgroundColor: C.gold }]}>
              <Text style={[styles.logoTxt, { color: C.mode === "dark" ? "#0A0A0A" : "#fff" }]}>
                S·O·S
              </Text>
            </View>
          </View>
        </View>
      </View>

      <Text style={[styles.welcomeTitle, { color: C.textPrimary }]}>
        Your Personal{"\n"}Safety Guardian
      </Text>
      <Text style={[styles.welcomeSub, { color: C.textMuted }]}>
        One tap to alert your trusted contacts with your location. Always ready
        when you need it most.
      </Text>

      {/* Feature pills */}
      <View style={styles.featurePills}>
        {[
          { icon: "🆘", label: "One-tap SOS" },
          { icon: "📍", label: "Live Location" },
          { icon: "📞", label: "Auto Call" },
          { icon: "🔒", label: "100% Private" },
        ].map((f, i) => (
          <View
            key={i}
            style={[
              styles.featurePill,
              { backgroundColor: C.goldMid, borderColor: C.gold + "44" },
            ]}
          >
            <Text style={{ fontSize: 13 }}>{f.icon}</Text>
            <Text style={[styles.featurePillTxt, { color: C.goldText }]}>
              {f.label}
            </Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        onPress={onNext}
        style={[styles.primaryBtn, { backgroundColor: C.gold }]}
      >
        <Text
          style={[
            styles.primaryBtnTxt,
            { color: C.mode === "dark" ? "#0A0A0A" : "#fff" },
          ]}
        >
          Get Started →
        </Text>
      </TouchableOpacity>

      <Text style={[styles.privacyNote, { color: C.textDim }]}>
        🔒 No account needed · All data stays on your device
      </Text>
    </View>
  );
}

// ─── Name Step ────────────────────────────────────────────────────────────────
function NameStep({
  C,
  name,
  setName,
  onNext,
  onBack,
}: {
  C: any;
  name: string;
  setName: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepEmoji}>👋</Text>
      <Text style={[styles.stepTitle, { color: C.textPrimary }]}>
        What's your name?
      </Text>
      <Text style={[styles.stepSub, { color: C.textMuted }]}>
        This is shown on your home screen and included in emergency alerts.
      </Text>

      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Your full name"
        placeholderTextColor={C.textDim}
        autoCapitalize="words"
        autoFocus
        style={[
          styles.input,
          {
            backgroundColor: C.inputBg,
            borderColor: name.trim() ? C.gold : C.inputBorder,
            color: C.textPrimary,
          },
        ]}
      />

      {name.trim().length > 0 && (
        <View
          style={[
            styles.previewPill,
            { backgroundColor: C.goldMid, borderColor: C.gold + "44" },
          ]}
        >
          <Text style={[styles.previewTxt, { color: C.goldText }]}>
            Hello, {name.trim()} 👋
          </Text>
        </View>
      )}

      <View style={styles.navBtns}>
        <TouchableOpacity
          onPress={onBack}
          style={[
            styles.secondaryBtn,
            { borderColor: C.border, backgroundColor: C.bgTertiary },
          ]}
        >
          <Text style={[styles.secondaryBtnTxt, { color: C.textMuted }]}>
            ← Back
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            if (!name.trim()) {
              Alert.alert("Name Required", "Please enter your name to continue.");
              return;
            }
            onNext();
          }}
          style={[
            styles.primaryBtn,
            {
              backgroundColor: name.trim() ? C.gold : C.bgTertiary,
              flex: 2,
            },
          ]}
        >
          <Text
            style={[
              styles.primaryBtnTxt,
              {
                color: name.trim()
                  ? C.mode === "dark" ? "#0A0A0A" : "#fff"
                  : C.textDim,
              },
            ]}
          >
            Continue →
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Contact Step ─────────────────────────────────────────────────────────────
function ContactStep({
  C,
  contactName,
  setContactName,
  contactPhone,
  setContactPhone,
  onNext,
  onBack,
  onSkip,
}: {
  C: any;
  contactName: string;
  setContactName: (v: string) => void;
  contactPhone: string;
  setContactPhone: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  return (
    <View style={styles.stepContainer}>
      <Text style={styles.stepEmoji}>👥</Text>
      <Text style={[styles.stepTitle, { color: C.textPrimary }]}>
        Add your first emergency contact
      </Text>
      <Text style={[styles.stepSub, { color: C.textMuted }]}>
        This person will be alerted with your location when you trigger SOS.
        You can add more later.
      </Text>

      {/* Contact name */}
      <View style={styles.fieldWrap}>
        <Text style={[styles.fieldLabel, { color: C.textMuted }]}>
          CONTACT NAME
        </Text>
        <TextInput
          value={contactName}
          onChangeText={setContactName}
          placeholder="e.g. Mom, Dad, Priya..."
          placeholderTextColor={C.textDim}
          autoCapitalize="words"
          style={[
            styles.input,
            {
              backgroundColor: C.inputBg,
              borderColor: contactName.trim() ? C.gold : C.inputBorder,
              color: C.textPrimary,
            },
          ]}
        />
      </View>

      {/* Contact phone */}
      <View style={styles.fieldWrap}>
        <Text style={[styles.fieldLabel, { color: C.textMuted }]}>
          PHONE NUMBER
        </Text>
        <TextInput
          value={contactPhone}
          onChangeText={setContactPhone}
          placeholder="+91 98765 43210"
          placeholderTextColor={C.textDim}
          keyboardType="phone-pad"
          style={[
            styles.input,
            {
              backgroundColor: C.inputBg,
              borderColor: contactPhone.trim() ? C.gold : C.inputBorder,
              color: C.textPrimary,
            },
          ]}
        />
      </View>

      {/* Info */}
      <View
        style={[
          styles.infoBox,
          { backgroundColor: C.goldMid, borderColor: C.gold + "44" },
        ]}
      >
        <Text style={[styles.infoTxt, { color: C.textSecondary }]}>
          💡 They'll receive an SMS with your location when you trigger SOS.
          Make sure they know they're on your list.
        </Text>
      </View>

      <View style={styles.navBtns}>
        <TouchableOpacity
          onPress={onBack}
          style={[
            styles.secondaryBtn,
            { borderColor: C.border, backgroundColor: C.bgTertiary },
          ]}
        >
          <Text style={[styles.secondaryBtnTxt, { color: C.textMuted }]}>
            ← Back
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            if (!contactName.trim() || !contactPhone.trim()) {
              Alert.alert(
                "Missing Info",
                "Please enter both name and phone number."
              );
              return;
            }
            if (contactPhone.replace(/\D/g, "").length < 7) {
              Alert.alert("Invalid Phone", "Please enter a valid phone number.");
              return;
            }
            onNext();
          }}
          style={[
            styles.primaryBtn,
            {
              backgroundColor:
                contactName.trim() && contactPhone.trim()
                  ? C.gold
                  : C.bgTertiary,
              flex: 2,
            },
          ]}
        >
          <Text
            style={[
              styles.primaryBtnTxt,
              {
                color:
                  contactName.trim() && contactPhone.trim()
                    ? C.mode === "dark" ? "#0A0A0A" : "#fff"
                    : C.textDim,
              },
            ]}
          >
            Continue →
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={onSkip} style={styles.skipBtn}>
        <Text style={[styles.skipTxt, { color: C.textDim }]}>
          Skip for now — I'll add contacts later
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Ready Step ───────────────────────────────────────────────────────────────
function ReadyStep({
  C,
  name,
  contactName,
  onFinish,
}: {
  C: any;
  name: string;
  contactName: string;
  onFinish: () => void;
}) {
  return (
    <View style={[styles.stepContainer, { alignItems: "center" }]}>
      <View
        style={[
          styles.readyCircle,
          { backgroundColor: C.greenDim, borderColor: C.green },
        ]}
      >
        <Text style={styles.readyEmoji}>🛡️</Text>
      </View>

      <Text style={[styles.readyTitle, { color: C.textPrimary }]}>
        You're all set, {name.trim().split(" ")[0]}!
      </Text>
      <Text style={[styles.readySub, { color: C.textMuted }]}>
        S·O·S is ready to protect you. Here's what's configured:
      </Text>

      {/* Summary */}
      <View style={styles.summaryList}>
        <View
          style={[
            styles.summaryRow,
            { backgroundColor: C.cardBg, borderColor: C.cardBorder },
          ]}
        >
          <Text style={styles.summaryIcon}>✓</Text>
          <Text style={[styles.summaryTxt, { color: C.textPrimary }]}>
            Profile set as{" "}
            <Text style={{ color: C.gold, fontWeight: "900" }}>
              {name.trim()}
            </Text>
          </Text>
        </View>

        {contactName.trim() ? (
          <View
            style={[
              styles.summaryRow,
              { backgroundColor: C.cardBg, borderColor: C.cardBorder },
            ]}
          >
            <Text style={styles.summaryIcon}>✓</Text>
            <Text style={[styles.summaryTxt, { color: C.textPrimary }]}>
              Emergency contact{" "}
              <Text style={{ color: C.gold, fontWeight: "900" }}>
                {contactName.trim()}
              </Text>{" "}
              added
            </Text>
          </View>
        ) : (
          <View
            style={[
              styles.summaryRow,
              { backgroundColor: C.redDim, borderColor: C.red + "44" },
            ]}
          >
            <Text style={styles.summaryIcon}>⚠️</Text>
            <Text style={[styles.summaryTxt, { color: C.red }]}>
              No emergency contact — add one from Contacts tab
            </Text>
          </View>
        )}

        <View
          style={[
            styles.summaryRow,
            { backgroundColor: C.cardBg, borderColor: C.cardBorder },
          ]}
        >
          <Text style={styles.summaryIcon}>✓</Text>
          <Text style={[styles.summaryTxt, { color: C.textPrimary }]}>
            SOS trigger set to{" "}
            <Text style={{ color: C.gold, fontWeight: "900" }}>Hold 3s</Text>
          </Text>
        </View>

        <View
          style={[
            styles.summaryRow,
            { backgroundColor: C.cardBg, borderColor: C.cardBorder },
          ]}
        >
          <Text style={styles.summaryIcon}>✓</Text>
          <Text style={[styles.summaryTxt, { color: C.textPrimary }]}>
            All data stored{" "}
            <Text style={{ color: C.gold, fontWeight: "900" }}>
              locally on your device
            </Text>
          </Text>
        </View>
      </View>

      <TouchableOpacity
        onPress={onFinish}
        style={[styles.primaryBtn, { backgroundColor: C.green, width: "100%" }]}
      >
        <Text style={[styles.primaryBtnTxt, { color: "#fff" }]}>
          ✓ Enter S·O·S App
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main Onboarding Screen ───────────────────────────────────────────────────
export default function OnboardingScreen() {
  const { theme: C } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [stepIndex, setStepIndex] = useState(0);
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  const currentStep = STEPS[stepIndex];

  function goNext() {
    if (stepIndex < STEPS.length - 1) setStepIndex((i) => i + 1);
  }

  function goBack() {
    if (stepIndex > 0) setStepIndex((i) => i - 1);
  }

  async function handleFinish() {
    // Save profile
    await AsyncStorage.setItem(
      "profile",
      JSON.stringify({ name: name.trim(), phone: "", email: "", bloodGroup: "", medicalNotes: "" })
    );

    // Save contact if provided
    if (contactName.trim() && contactPhone.trim()) {
      const contact = {
        id: Date.now().toString(),
        name: contactName.trim(),
        phone: contactPhone.trim(),
        relation: "Friend",
      };
      await AsyncStorage.setItem("contacts", JSON.stringify([contact]));
    }

    // Mark onboarding complete
    await AsyncStorage.setItem("onboarding_complete", "true");

    // Navigate to home
    router.replace("/(tabs)");
  }

  async function handleSkipContact() {
    // Save profile only
    await AsyncStorage.setItem(
      "profile",
      JSON.stringify({ name: name.trim(), phone: "", email: "", bloodGroup: "", medicalNotes: "" })
    );
    goNext();
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View
        style={[
          styles.root,
          { backgroundColor: C.bg, paddingTop: insets.top },
        ]}
      >
        <StatusBar barStyle={C.statusBarStyle} backgroundColor={C.bg} />

        {/* ── Header ── */}
        <View style={[styles.header, { borderBottomColor: C.border }]}>
          {/* Brand */}
          <View style={styles.brandRow}>
            <Text style={[styles.brandLetter, { color: C.textPrimary }]}>S</Text>
            <View style={[styles.brandDot, { backgroundColor: C.gold }]} />
            <Text style={[styles.brandLetter, { color: C.gold }]}>O</Text>
            <View style={[styles.brandDot, { backgroundColor: C.gold }]} />
            <Text style={[styles.brandLetter, { color: C.textPrimary }]}>S</Text>
          </View>
          <ProgressDots current={stepIndex} C={C} />
          <Text style={[styles.stepCounter, { color: C.textDim }]}>
            {stepIndex + 1}/{STEPS.length}
          </Text>
        </View>

        {/* ── Steps ── */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 32 },
          ]}
        >
          {currentStep === "welcome" && (
            <WelcomeStep C={C} onNext={goNext} />
          )}

          {currentStep === "name" && (
            <NameStep
              C={C}
              name={name}
              setName={setName}
              onNext={goNext}
              onBack={goBack}
            />
          )}

          {currentStep === "contact" && (
            <ContactStep
              C={C}
              contactName={contactName}
              setContactName={setContactName}
              contactPhone={contactPhone}
              setContactPhone={setContactPhone}
              onNext={goNext}
              onBack={goBack}
              onSkip={handleSkipContact}
            />
          )}

          {currentStep === "ready" && (
            <ReadyStep
              C={C}
              name={name}
              contactName={contactName}
              onFinish={handleFinish}
            />
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  brandLetter: { fontSize: 16, fontWeight: "900", letterSpacing: 1 },
  brandDot: { width: 4, height: 4, borderRadius: 2 },
  stepCounter: { fontSize: 10, fontWeight: "700", letterSpacing: 1 },

  dots: { flexDirection: "row", alignItems: "center", gap: 5 },
  dot: { height: 6, borderRadius: 3 },

  scrollContent: { padding: 24 },

  stepContainer: { gap: 16 },

  // Welcome
  logoArea: { alignItems: "center", paddingVertical: 16 },
  logoRing: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logoRingInner: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  logoTxt: { fontSize: 20, fontWeight: "900", letterSpacing: 2 },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 34,
    letterSpacing: 0.3,
  },
  welcomeSub: {
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 21,
  },
  featurePills: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  featurePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  featurePillTxt: { fontSize: 12, fontWeight: "700" },
  privacyNote: { fontSize: 11, fontWeight: "500", textAlign: "center" },

  // Steps
  stepEmoji: { fontSize: 48, textAlign: "center" },
  stepTitle: { fontSize: 24, fontWeight: "900", lineHeight: 30 },
  stepSub: { fontSize: 13, fontWeight: "500", lineHeight: 20 },

  fieldWrap: { gap: 6 },
  fieldLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 1.5 },

  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontWeight: "600",
  },

  previewPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  previewTxt: { fontSize: 14, fontWeight: "700" },

  infoBox: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  infoTxt: { fontSize: 12, fontWeight: "500", lineHeight: 18 },

  navBtns: { flexDirection: "row", gap: 10 },
  primaryBtn: {
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: "center",
    flex: 1,
  },
  primaryBtnTxt: { fontSize: 15, fontWeight: "900" },
  secondaryBtn: {
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 1,
    flex: 1,
  },
  secondaryBtnTxt: { fontSize: 14, fontWeight: "700" },

  skipBtn: { alignItems: "center", paddingVertical: 4 },
  skipTxt: { fontSize: 12, fontWeight: "600" },

  // Ready
  readyCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  readyEmoji: { fontSize: 52 },
  readyTitle: { fontSize: 24, fontWeight: "900", textAlign: "center" },
  readySub: { fontSize: 13, fontWeight: "500", textAlign: "center", lineHeight: 20 },

  summaryList: { gap: 8, width: "100%" },
  summaryRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  summaryIcon: { fontSize: 16, marginTop: 1 },
  summaryTxt: { flex: 1, fontSize: 13, fontWeight: "600", lineHeight: 19 },
});
