import { ThemedAlert, useThemedAlert } from "@/components/ThemedAlert";
import { useTheme } from "@/context/ThemeContext";
import { useScrollToTop } from "@/hooks/useScrollToTop";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const FAQS = [
  { question: "Why isn't my SOS sending?", answer: "Make sure you have at least one emergency contact added and SMS permission is granted. Go to Contacts tab to add a contact, then check your phone's app permissions." },
  { question: "How do I add emergency contacts?", answer: "Tap the Contacts tab at the bottom. Tap Add to add a contact by name and phone number. You can add up to 5 contacts." },
  { question: "Does the app work without internet?", answer: "Yes. SOS alerts are sent via SMS which works without internet. Location sharing requires GPS which also works offline." },
  { question: "Can I test SOS without alerting contacts?", answer: "Yes. Go to Settings → SOS Trigger → Test SOS. This runs a dry test without sending any real alerts." },
  { question: "Why is my location not being shared?", answer: "Make sure location permission is set to 'While Using App' or 'Always'. Also check that GPS is turned on." },
  { question: "How does Shake-to-SOS work?", answer: "Enable it in Settings → SOS Trigger → Trigger Method. Shake your phone firmly 3 times to trigger SOS." },
  { question: "Can I change the SOS hold duration?", answer: "Yes. Go to Settings → SOS Trigger → Countdown Duration. Choose 1s, 3s, or 5s." },
  { question: "Is my data private?", answer: "Completely. All data is stored only on your device. We never collect, transmit, or sell any of your information." },
];

function FAQRow({ item, C, isLast }: { item: { question: string; answer: string }; C: any; isLast: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={[styles.faqRow, {
      backgroundColor: C.cardBg, borderColor: C.cardBorder,
      borderBottomLeftRadius: isLast ? 14 : 0,
      borderBottomRightRadius: isLast ? 14 : 0,
    }]}>
      <TouchableOpacity onPress={() => setOpen((o) => !o)} style={styles.faqQuestion} activeOpacity={0.7}>
        <Text style={[styles.faqQ, { color: C.textPrimary }]}>{item.question}</Text>
        <Text style={[styles.faqChevron, { color: C.gold }]}>{open ? "▾" : "▸"}</Text>
      </TouchableOpacity>
      {open && (
        <View style={[styles.faqAnswer, { borderTopColor: C.border }]}>
          <Text style={[styles.faqA, { color: C.textSecondary }]}>{item.answer}</Text>
        </View>
      )}
    </View>
  );
}

export default function SupportScreen() {
  const { theme: C } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useScrollToTop();
  const { visible, config, showAlert, hideAlert } = useThemedAlert();

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSendEmail() {
    if (!subject.trim() || !message.trim()) {
      showAlert({
        title: "Missing Info",
        message: "Please fill in both subject and message before sending.",
        buttons: [{ label: "OK", onPress: () => {}, primary: true }],
      });
      return;
    }
    setSending(true);
    const mailto = `mailto:msrkmab@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
    try {
      const supported = await Linking.canOpenURL(mailto);
      if (supported) {
        await Linking.openURL(mailto);
        setSent(true);
        setSubject("");
        setMessage("");
      } else {
        showAlert({
          title: "No Email App Found",
          message: "Please email us directly at msrkmab@gmail.com",
          buttons: [{ label: "OK", onPress: () => {}, primary: true }],
        });
      }
    } catch {
      showAlert({
        title: "Could Not Open Email",
        message: "Please try emailing us at msrkmab@gmail.com",
        buttons: [{ label: "OK", onPress: () => {}, primary: true }],
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: C.bg, paddingTop: insets.top }]}>
      <StatusBar barStyle={C.statusBarStyle} backgroundColor={C.bg} />

      <View style={[styles.topNav, { borderBottomColor: C.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={[styles.backBtn, { color: C.gold }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: C.textPrimary }]}>Contact Support</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}>

        <View style={[styles.heroCard, { backgroundColor: C.goldMid, borderColor: C.gold + "44" }]}>
          <Text style={styles.heroEmoji}>🤝</Text>
          <Text style={[styles.heroTitle, { color: C.goldText }]}>We're Here to Help</Text>
          <Text style={[styles.heroBody, { color: C.textSecondary }]}>
            Usually respond within 24 hours. For emergencies, call 112.
          </Text>
        </View>

        <Text style={[styles.sectionHeader, { color: C.sectionHeader }]}>REACH US</Text>
        <View style={styles.contactCards}>
          {[
            { icon: "✉️", title: "Email Support", sub: "msrkmab@gmail.com", action: () => Linking.openURL("mailto:msrkmab@gmail.com"), label: "Email", color: C.gold, bg: C.goldMid },
            { icon: "🐦", title: "Twitter / X", sub: "deadllysinss", action: () => Linking.openURL("https://x.com/deadllysinss"), label: "Open", color: C.blue, bg: C.blueDim },
            { icon: "📸", title: "Instagram", sub: "@sos.app.india", action: () => Linking.openURL("https://instagram.com/sos.app.india"), label: "Open", color: C.purple, bg: C.purpleDim },
          ].map((card, i) => (
            <View key={i} style={[styles.contactCard, { backgroundColor: C.cardBg, borderColor: C.cardBorder }]}>
              <View style={[styles.contactIcon, { backgroundColor: card.bg }]}>
                <Text style={{ fontSize: 20 }}>{card.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.contactTitle, { color: C.textPrimary }]}>{card.title}</Text>
                <Text style={[styles.contactSub, { color: C.textMuted }]}>{card.sub}</Text>
              </View>
              <TouchableOpacity onPress={card.action} style={[styles.contactBtn, { backgroundColor: card.color }]}>
                <Text style={styles.contactBtnTxt}>{card.label}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <Text style={[styles.sectionHeader, { color: C.sectionHeader }]}>SEND A MESSAGE</Text>
        <View style={[styles.formCard, { backgroundColor: C.cardBg, borderColor: C.cardBorder }]}>
          {sent ? (
            <View style={styles.sentState}>
              <Text style={styles.sentEmoji}>✅</Text>
              <Text style={[styles.sentTitle, { color: C.green }]}>Message Sent!</Text>
              <Text style={[styles.sentSub, { color: C.textMuted }]}>We'll get back to you within 24 hours.</Text>
              <TouchableOpacity onPress={() => setSent(false)}
                style={[styles.sendAnotherBtn, { borderColor: C.border, backgroundColor: C.bgTertiary }]}>
                <Text style={[styles.sendAnotherTxt, { color: C.textMuted }]}>Send Another</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={[styles.formLabel, { color: C.textMuted }]}>Subject</Text>
              <TextInput value={subject} onChangeText={setSubject}
                placeholder="e.g. SOS not working, Feature request..."
                placeholderTextColor={C.textDim}
                style={[styles.input, { backgroundColor: C.inputBg, borderColor: C.inputBorder, color: C.textPrimary }]} />
              <Text style={[styles.formLabel, { color: C.textMuted, marginTop: 14 }]}>Message</Text>
              <TextInput value={message} onChangeText={setMessage}
                placeholder="Describe your issue or feedback in detail..."
                placeholderTextColor={C.textDim} multiline numberOfLines={5} textAlignVertical="top"
                style={[styles.inputMulti, { backgroundColor: C.inputBg, borderColor: C.inputBorder, color: C.textPrimary }]} />
              <Text style={[styles.charCount, { color: C.textDim }]}>{message.length} characters</Text>
              <TouchableOpacity onPress={handleSendEmail} disabled={sending}
                style={[styles.sendBtn, { backgroundColor: sending ? C.bgTertiary : C.gold, marginTop: 16 }]}>
                <Text style={[styles.sendBtnTxt, { color: sending ? C.textMuted : C.mode === "dark" ? "#0A0A0A" : "#fff" }]}>
                  {sending ? "Opening…" : "Send Message →"}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <Text style={[styles.sectionHeader, { color: C.sectionHeader }]}>FREQUENTLY ASKED</Text>
        <View style={[styles.faqCard, { borderColor: C.cardBorder, borderRadius: 14, overflow: "hidden" }]}>
          {FAQS.map((faq, i) => (
            <View key={i}>
              <FAQRow item={faq} C={C} isLast={i === FAQS.length - 1} />
              {i < FAQS.length - 1 && <View style={[styles.faqDivider, { backgroundColor: C.border }]} />}
            </View>
          ))}
        </View>

        <Text style={[styles.footer, { color: C.textDim }]}>
          S·O·S · Built for your safety · Made with ❤️ in India
        </Text>
      </ScrollView>

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
  heroCard: { borderRadius: 18, borderWidth: 1, padding: 20, alignItems: "center", gap: 8, marginBottom: 4 },
  heroEmoji: { fontSize: 36, marginBottom: 4 },
  heroTitle: { fontSize: 17, fontWeight: "900", textAlign: "center" },
  heroBody: { fontSize: 13, fontWeight: "500", textAlign: "center", lineHeight: 19 },
  sectionHeader: { fontSize: 9, fontWeight: "800", letterSpacing: 2, marginTop: 22, marginBottom: 10, marginLeft: 4 },
  contactCards: { gap: 8 },
  contactCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  contactIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  contactTitle: { fontSize: 13, fontWeight: "800", marginBottom: 2 },
  contactSub: { fontSize: 11, fontWeight: "500" },
  contactBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  contactBtnTxt: { color: "#fff", fontSize: 12, fontWeight: "800" },
  formCard: { borderRadius: 16, borderWidth: 1, padding: 18 },
  formLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 1, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, fontWeight: "500" },
  inputMulti: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, fontWeight: "500", minHeight: 110 },
  charCount: { fontSize: 10, fontWeight: "500", textAlign: "right", marginTop: 4 },
  sendBtn: { paddingVertical: 14, borderRadius: 13, alignItems: "center" },
  sendBtnTxt: { fontSize: 14, fontWeight: "900" },
  sentState: { alignItems: "center", gap: 8, paddingVertical: 16 },
  sentEmoji: { fontSize: 40 },
  sentTitle: { fontSize: 18, fontWeight: "900" },
  sentSub: { fontSize: 13, fontWeight: "500", textAlign: "center" },
  sendAnotherBtn: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  sendAnotherTxt: { fontSize: 13, fontWeight: "700" },
  faqCard: { borderWidth: 1 },
  faqRow: { borderWidth: 0, paddingHorizontal: 16 },
  faqQuestion: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, gap: 10 },
  faqQ: { flex: 1, fontSize: 13, fontWeight: "700", lineHeight: 18 },
  faqChevron: { fontSize: 14, fontWeight: "700" },
  faqAnswer: { borderTopWidth: 1, paddingTop: 10, paddingBottom: 14 },
  faqA: { fontSize: 12, fontWeight: "500", lineHeight: 18 },
  faqDivider: { height: 1, marginHorizontal: 16 },
  footer: { textAlign: "center", fontSize: 10, fontWeight: "500", marginTop: 28, letterSpacing: 0.3 },
});