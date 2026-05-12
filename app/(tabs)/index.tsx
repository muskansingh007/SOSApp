import FakeCallModal from "@/components/modals/FakeCallModal";
import SafeCheckInModal from "@/components/modals/SafeCheckInModal";
import WalkHomeModal from "@/components/modals/WalkHomeModal";
import { useTheme, type Theme } from "@/context/ThemeContext";
import { useShakeToSOS } from "@/hooks/useShakeToSOS";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface Contact {
  name: string;
  phone: string;
}

// ─── Top nav ──────────────────────────────────────────────────────────────────
function TopNav({ C, onMenuPress }: { C: Theme; onMenuPress: () => void }) {
  return (
    <View style={[styles.topNav, { backgroundColor: C.bg }]}>
      <View style={styles.brandRow}>
        <Text style={[styles.brandLetter, { color: C.textPrimary }]}>S</Text>
        <View style={[styles.brandDot, { backgroundColor: C.gold }]} />
        <Text style={[styles.brandLetter, { color: C.gold }]}>O</Text>
        <View style={[styles.brandDot, { backgroundColor: C.gold }]} />
        <Text style={[styles.brandLetter, { color: C.textPrimary }]}>S</Text>
      </View>
      <TouchableOpacity
        onPress={onMenuPress}
        style={styles.menuBtn}
        hitSlop={12}
      >
        {/* Hamburger icon - 3 lines */}
        <View style={[styles.mBar, { width: 22, backgroundColor: C.textMuted }]} />
        <View style={[styles.mBar, { width: 16, backgroundColor: C.textMuted }]} />
        <View style={[styles.mBar, { width: 19, backgroundColor: C.textMuted }]} />
      </TouchableOpacity>
    </View>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
function HeroSection({
  C,
  name,
  isShakeEnabled,
  shakeCount,
}: {
  C: Theme;
  name: string;
  isShakeEnabled: boolean;
  shakeCount: number;
}) {
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "GOOD MORNING" : hour < 17 ? "GOOD AFTERNOON" : "GOOD EVENING";
  return (
    <View style={[styles.hero, { backgroundColor: C.bg }]}>
      <Text style={[styles.greeting, { color: C.textMuted }]}>{greeting}</Text>
      <Text style={[styles.userName, { color: C.textPrimary }]}>{name}</Text>
      <View
        style={[
          styles.statusPill,
          { backgroundColor: C.pillBg, borderColor: C.pillBorder },
        ]}
      >
        <View style={[styles.statusDot, { backgroundColor: C.gold }]} />
        <Text style={[styles.statusPillTxt, { color: C.goldText }]}>
          SAFEGUARD ACTIVE
        </Text>
      </View>
      {isShakeEnabled && shakeCount > 0 && (
        <View
          style={[
            styles.statusPill,
            { backgroundColor: C.redDim, borderColor: C.red, marginTop: 8 },
          ]}
        >
          <View style={[styles.statusDot, { backgroundColor: C.red }]} />
          <Text style={[styles.statusPillTxt, { color: C.red }]}>
            SHAKE {shakeCount}/3
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── SOS button ───────────────────────────────────────────────────────────────
function SOSButton({ C, onPress }: { C: Theme; onPress: () => void }) {
  const pulse1 = useRef(new Animated.Value(1)).current;
  const pulse2 = useRef(new Animated.Value(1)).current;
  const holdScale = useRef(new Animated.Value(1)).current;
  const holdProgress = useRef(new Animated.Value(0)).current;
  const [holding, setHolding] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse1, {
          toValue: 1.12,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse1, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();
    setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse2, {
            toValue: 1.08,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulse2, {
            toValue: 1,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ).start();
    }, 750);
  }, [pulse1, pulse2]);

  const handlePressIn = () => {
    setHolding(true);
    Animated.spring(holdScale, {
      toValue: 0.92,
      useNativeDriver: true,
      bounciness: 0,
    }).start();
    Animated.timing(holdProgress, {
      toValue: 1,
      duration: 3000,
      useNativeDriver: false,
    }).start();
    holdTimer.current = setTimeout(onPress, 3000);
  };

  const handlePressOut = () => {
    setHolding(false);
    Animated.spring(holdScale, { toValue: 1, useNativeDriver: true }).start();
    Animated.timing(holdProgress, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
    if (holdTimer.current) clearTimeout(holdTimer.current);
  };

  return (
    <View style={styles.sosArea}>
      <Animated.View
        style={[
          styles.sosOuter,
          { borderColor: C.goldMid, transform: [{ scale: pulse1 }] },
        ]}
      >
        <Animated.View
          style={[
            styles.sosMid,
            { borderColor: C.gold, transform: [{ scale: pulse2 }] },
          ]}
        >
          <Animated.View style={{ transform: [{ scale: holdScale }] }}>
            <Pressable
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              style={[styles.sosBtn, { backgroundColor: C.gold }]}
            >
              <Text
                style={[
                  styles.sosBtnS,
                  { color: C.mode === "dark" ? "#0A0A0A" : "#FFFFFF" },
                ]}
              >
                S
              </Text>
              <Text
                style={[
                  styles.sosBtnO,
                  { color: C.mode === "dark" ? "#1A1000" : "#F5ECD0" },
                ]}
              >
                O
              </Text>
              <Text
                style={[
                  styles.sosBtnS2,
                  { color: C.mode === "dark" ? "#0A0A0A" : "#FFFFFF" },
                ]}
              >
                S
              </Text>
              <Text
                style={[
                  styles.sosHoldTxt,
                  { color: C.mode === "dark" ? "#1A1000" : "#F0E0B0" },
                ]}
              >
                {holding ? "RELEASING…" : "HOLD 3s"}
              </Text>
            </Pressable>
          </Animated.View>
        </Animated.View>
      </Animated.View>
      <Text style={[styles.holdHint, { color: C.textDim }]}>
        {holding
          ? "Keep holding to send emergency alert…"
          : "Hold 3 seconds to trigger SOS"}
      </Text>
    </View>
  );
}

// ─── Quick actions ────────────────────────────────────────────────────────────
function QuickActions({
  C,
  onFakeCall,
  onCheckIn,
  onWalkHome,
}: {
  C: Theme;
  onFakeCall: () => void;
  onCheckIn: () => void;
  onWalkHome: () => void;
}) {
  const actions = [
    {
      label: "Fake Call",
      bg: C.goldMid,
      iconColor: C.gold,
      icon: "phone",
      onPress: onFakeCall,
    },
    {
      label: "Safe Check-in",
      bg: C.greenDim,
      iconColor: C.green,
      icon: "shield",
      onPress: onCheckIn,
    },
    {
      label: "Walk Home",
      bg: C.blueDim,
      iconColor: C.blue,
      icon: "walk",
      onPress: onWalkHome,
    },
  ];

  return (
    <View style={styles.quickSection}>
      <Text style={[styles.sectionTitle, { color: C.sectionHeader }]}>
        QUICK ACTIONS
      </Text>
      <View style={styles.quickGrid}>
        {actions.map((a) => (
          <TouchableOpacity
            key={a.label}
            style={[
              styles.quickCard,
              { backgroundColor: C.cardBg, borderColor: C.cardBorder },
            ]}
            onPress={a.onPress}
            activeOpacity={0.75}
          >
            <View style={[styles.quickIconWrap, { backgroundColor: a.bg }]}>
              <QuickIcon icon={a.icon} color={a.iconColor} />
            </View>
            <Text style={[styles.quickLabel, { color: C.textSecondary }]}>
              {a.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function QuickIcon({ icon, color }: { icon: string; color: string }) {
  // Phone icon - handset shape
  if (icon === "phone") {
    return (
      <View style={{ width: 22, height: 22, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color, fontSize: 16, fontWeight: "900" }}>✆</Text>
      </View>
    );
  }
  // Shield icon
  if (icon === "shield") {
    return (
      <View style={{ width: 22, height: 22, alignItems: "center", justifyContent: "center" }}>
        <View
          style={{
            width: 14,
            height: 16,
            borderWidth: 2,
            borderColor: color,
            borderRadius: 3,
            borderBottomLeftRadius: 7,
            borderBottomRightRadius: 7,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View style={{ width: 5, height: 6, borderWidth: 1.5, borderColor: color, borderRadius: 1 }} />
        </View>
      </View>
    );
  }
  // Walk icon
  return (
    <View style={{ width: 22, height: 22, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color, fontSize: 16 }}>🚶</Text>
    </View>
  );
}

// ─── Contacts strip ───────────────────────────────────────────────────────────
function ContactsStrip({
  C,
  contacts,
  router,
}: {
  C: Theme;
  contacts: Contact[];
  router: any;
}) {
  const accentColors = [C.gold, C.blue, C.green, C.red];
  const accentBgs = [C.goldMid, C.blueDim, C.greenDim, C.redDim];

  return (
    <View style={styles.contactsSection}>
      <View style={styles.contactsHeader}>
        <Text style={[styles.sectionTitle, { color: C.sectionHeader }]}>
          EMERGENCY CONTACTS
        </Text>
        <TouchableOpacity onPress={() => router.push("/contacts")}>
          <Text style={[styles.contactsManage, { color: C.gold }]}>
            Manage →
          </Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.contactsStrip}
      >
        {contacts.slice(0, 4).map((c, i) => (
          <View key={i} style={styles.contactItem}>
            <View
              style={[
                styles.contactAv,
                {
                  backgroundColor: accentBgs[i % accentBgs.length],
                  borderColor: i === 0 ? C.gold : C.border,
                  borderWidth: i === 0 ? 1.5 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.contactAvTxt,
                  { color: accentColors[i % accentColors.length] },
                ]}
              >
                {c.name[0].toUpperCase()}
              </Text>
            </View>
            <Text
              style={[
                styles.contactOrder,
                { color: i === 0 ? C.gold : C.textDim },
              ]}
            >
              {["1st", "2nd", "3rd", "4th"][i]}
            </Text>
            <Text style={[styles.contactName, { color: C.textMuted }]}>
              {c.name.split(" ")[0]}
            </Text>
          </View>
        ))}
        {contacts.length < 5 && (
          <TouchableOpacity
            style={styles.contactItem}
            onPress={() => router.push("/contacts")}
          >
            <View
              style={[
                styles.contactAv,
                {
                  backgroundColor: C.bgTertiary,
                  borderColor: C.border,
                  borderStyle: "dashed",
                },
              ]}
            >
              <Text
                style={{ color: C.textDim, fontSize: 18, fontWeight: "700" }}
              >
                +
              </Text>
            </View>
            <Text style={[styles.contactOrder, { color: C.textDim }]}>add</Text>
            <Text style={[styles.contactName, { color: C.textDim }]}>New</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Alert banner ─────────────────────────────────────────────────────────────
function AlertBanner({ C, router }: { C: Theme; router: any }) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return (
    <TouchableOpacity
      style={[
        styles.alertBanner,
        {
          backgroundColor: C.mode === "dark" ? "#1A0A00" : "#FFF8ED",
          borderColor: C.mode === "dark" ? "#3A2000" : "#E8D0A0",
        },
      ]}
      onPress={() => {
        setVisible(false);
        router.push("/contacts");
      }}
      activeOpacity={0.85}
    >
      <View style={[styles.alertDot, { backgroundColor: "#EF9F27" }]} />
      <Text style={[styles.alertTxt, { color: "#8A6000" }]}>
        Add at least one emergency contact
      </Text>
      <Text style={[styles.alertAction, { color: C.gold }]}>Setup →</Text>
    </TouchableOpacity>
  );
}

// ─── Rotating tip banners ─────────────────────────────────────────────────────
const TIPS = [
  "💡 Hold SOS button 3s to trigger alert",
  "📍 Location is shared only during emergencies",
  "👥 Add up to 5 emergency contacts",
  "📞 1st contact is called automatically on SOS",
  "🔒 All your data stays on your device",
  "🤝 Tell your contacts they're on your list",
];

function RotatingTipBanner({ C }: { C: Theme }) {
  const [tipIndex, setTipIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const interval = setInterval(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        setTipIndex((prev) => (prev + 1) % TIPS.length);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }).start();
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [fadeAnim]);

  return (
    <Animated.View
      style={[
        styles.tipBanner,
        {
          backgroundColor: C.bgTertiary,
          borderColor: C.border,
          opacity: fadeAnim,
        },
      ]}
    >
      <Text style={[styles.tipBannerTxt, { color: C.textMuted }]}>
        {TIPS[tipIndex]}
      </Text>
    </Animated.View>
  );
}

// ─── Slide-in menu drawer ─────────────────────────────────────────────────────
function MenuDrawer({
  C,
  visible,
  onClose,
  router,
}: {
  C: Theme;
  visible: boolean;
  onClose: () => void;
  router: any;
}) {
  const translateX = useRef(new Animated.Value(240)).current;
  const backdrop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateX, {
        toValue: visible ? 0 : 240,
        useNativeDriver: true,
        bounciness: 0,
        speed: 20,
      }),
      Animated.timing(backdrop, {
        toValue: visible ? 1 : 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [backdrop, translateX, visible]);

  const items = [
    { label: "Settings", sub: "Preferences & theme", route: "/settings" },
    {
      label: "Emergency Numbers",
      sub: "India helplines",
      route: "/emergency-numbers",
    },
    { label: "How to Use", sub: "App tutorial", route: "/tutorial" },
    {
      label: "Walk Home Mode",
      sub: "Auto-SOS if off route",
      route: "/walk-home",
    },
    { label: "Privacy & Data", sub: "Manage your data", route: "/privacy" },
    { label: "Contact Support", sub: "Get help", route: "/support" },
  ];

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFillObject,
        { opacity: backdrop, pointerEvents: visible ? "auto" : "none" },
      ]}
    >
      <TouchableOpacity
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)" }}
        onPress={onClose}
        activeOpacity={1}
      />
      <Animated.View
        style={[
          styles.drawer,
          {
            backgroundColor: C.drawerBg,
            borderLeftColor: C.goldMid,
            transform: [{ translateX }],
          },
        ]}
      >
        {/* Drawer header */}
        <View style={[styles.drawerHeader, { borderBottomColor: C.border }]}>
          <View style={styles.brandRow}>
            <Text
              style={[
                styles.brandLetter,
                { color: C.textPrimary, fontSize: 13 },
              ]}
            >
              S
            </Text>
            <View style={[styles.brandDot, { backgroundColor: C.gold }]} />
            <Text style={[styles.brandLetter, { color: C.gold, fontSize: 13 }]}>
              O
            </Text>
            <View style={[styles.brandDot, { backgroundColor: C.gold }]} />
            <Text
              style={[
                styles.brandLetter,
                { color: C.textPrimary, fontSize: 13 },
              ]}
            >
              S
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Text style={[styles.drawerClose, { color: C.textMuted }]}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Drawer items */}
        {items.map((item) => (
          <TouchableOpacity
            key={item.label}
            style={[styles.drawerItem, { borderBottomColor: C.border }]}
            onPress={() => {
              onClose();
              setTimeout(() => router.push(item.route as any), 50);
            }}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.drawerDot,
                { borderColor: C.gold, backgroundColor: C.goldMid },
              ]}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.drawerItemLabel, { color: C.textPrimary }]}>
                {item.label}
              </Text>
              <Text style={[styles.drawerItemSub, { color: C.textMuted }]}>
                {item.sub}
              </Text>
            </View>
          </TouchableOpacity>
        ))}

        <View style={styles.drawerFooter}>
          <Text style={[styles.drawerVersion, { color: C.textDim }]}>
            S·O·S v1.0.0
          </Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const { isShakeEnabled, shakeCount } = useShakeToSOS();
  const { theme: C } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<any>(null);
  const [profile, setProfile] = useState<{ name: string }>({ name: "" });
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [fakeCallOpen, setFakeCallOpen] = useState(false);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [walkHomeOpen, setWalkHomeOpen] = useState(false);

  // Reload contacts whenever screen is focused
  const refreshConfig = useCallback(() => {
    // Refresh any configuration from storage if needed
    // Currently handled by hooks, but available for future expansion
  }, []);

   useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem("contacts").then((v) => {
        if (v) setContacts(JSON.parse(v));
        else setContacts([]);
      });
      AsyncStorage.getItem("profile").then((v) => {
        if (v) {
          const parsed = JSON.parse(v);
          setProfile({ name: parsed.name ?? "" });
        }
      });
      // Re-read shake/trigger settings every time screen is focused
      // (covers returning from Settings where user may have changed method/sensitivity)
      refreshConfig();
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, [refreshConfig])
  );
 

  function handleSOS() {
    if (contacts.length === 0) {
      router.push("/contacts");
      return;
    }
    router.push({
      pathname: "/alert",
      params: {
        coords: JSON.stringify({ latitude: 0, longitude: 0 }),
        contacts: JSON.stringify(contacts),
      },
    });
  }

  return (
    <View
      style={[styles.root, { backgroundColor: C.bg, paddingTop: insets.top }]}
    >
      <StatusBar barStyle={C.statusBarStyle} backgroundColor={C.bg} />

      <TopNav C={C} onMenuPress={() => setMenuOpen(true)} />

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <HeroSection
          C={C}
          name={profile.name || "Welcome"}
          isShakeEnabled={isShakeEnabled}
          shakeCount={shakeCount}
        />

        {contacts.length === 0 && <AlertBanner C={C} router={router} />}

        <SOSButton C={C} onPress={handleSOS} />

        <View style={[styles.divider, { backgroundColor: C.border }]} />

        <QuickActions
          C={C}
          onFakeCall={() => setFakeCallOpen(true)}
          onCheckIn={() => setCheckInOpen(true)}
          onWalkHome={() => setWalkHomeOpen(true)}
        />

        <View style={[styles.divider, { backgroundColor: C.border }]} />

        <ContactsStrip C={C} contacts={contacts} router={router} />

        <View style={[styles.divider, { backgroundColor: C.border }]} />

        <RotatingTipBanner C={C} />
      </ScrollView>

      <MenuDrawer
        C={C}
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        router={router}
      />

      <FakeCallModal
        visible={fakeCallOpen}
        onClose={() => setFakeCallOpen(false)}
      />
      <SafeCheckInModal
        visible={checkInOpen}
        onClose={() => setCheckInOpen(false)}
      />
      <WalkHomeModal
        visible={walkHomeOpen}
        onClose={() => setWalkHomeOpen(false)}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },

  topNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 10,
    paddingTop: 8,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  brandLetter: { fontSize: 16, fontWeight: "900", letterSpacing: 1 },
  brandDot: { width: 4, height: 4, borderRadius: 2 },
  menuBtn: { gap: 4, paddingVertical: 4 },
  mBar: { height: 1.5, borderRadius: 2 },

  hero: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 18 },
  greeting: {
    fontSize: 10,
    letterSpacing: 2,
    marginBottom: 3,
    fontWeight: "700",
  },
  userName: {
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 14,
    alignSelf: "flex-start",
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusPillTxt: { fontSize: 10, fontWeight: "800", letterSpacing: 1.2 },

  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 18,
    marginBottom: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  alertDot: { width: 6, height: 6, borderRadius: 3 },
  alertTxt: { flex: 1, fontSize: 12, fontWeight: "600" },
  alertAction: { fontSize: 11, fontWeight: "800" },

  sosArea: { alignItems: "center", paddingVertical: 24, gap: 16 },
  sosOuter: {
    width: 178,
    height: 178,
    borderRadius: 89,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  sosMid: {
    width: 146,
    height: 146,
    borderRadius: 73,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  sosBtn: {
    width: 116,
    height: 116,
    borderRadius: 58,
    alignItems: "center",
    justifyContent: "center",
  },
  sosBtnS: {
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 30,
    letterSpacing: 1,
  },
  sosBtnO: {
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 24,
    letterSpacing: 1,
    marginTop: -2,
  },
  sosBtnS2: {
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 30,
    letterSpacing: 1,
    marginTop: -2,
  },
  sosHoldTxt: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginTop: 4,
  },
  holdHint: { fontSize: 11, letterSpacing: 0.3 },

  divider: { height: 1, marginHorizontal: 20, marginVertical: 6 },

  quickSection: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10 },
  sectionTitle: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: 12,
  },
  quickGrid: { flexDirection: "row", gap: 10 },
  quickCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 10,
    alignItems: "center",
    gap: 9,
  },
  quickIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  quickLabel: {
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 13,
  },

  contactsSection: { paddingTop: 14, paddingBottom: 24 },
  contactsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  contactsManage: { fontSize: 10, fontWeight: "700" },
  contactsStrip: { paddingHorizontal: 20, gap: 16, flexDirection: "row" },
  contactItem: { alignItems: "center", gap: 4 },
  contactAv: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  contactAvTxt: { fontSize: 16, fontWeight: "900" },
  contactOrder: { fontSize: 8, fontWeight: "800", letterSpacing: 0.5 },
  contactName: { fontSize: 9, fontWeight: "600" },

  tipBanner: {
    marginHorizontal: 20,
    marginVertical: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  tipBannerTxt: { fontSize: 12, fontWeight: "600", letterSpacing: 0.2 },

  drawer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    width: 240,
    borderLeftWidth: 1,
    paddingTop: 54,
  },
  drawerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  drawerClose: { fontSize: 15, fontWeight: "700" },
  drawerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  drawerDot: { width: 6, height: 6, borderRadius: 3, borderWidth: 1 },
  drawerItemLabel: { fontSize: 13, fontWeight: "700", marginBottom: 1 },
  drawerItemSub: { fontSize: 10 },
  drawerFooter: {
    position: "absolute",
    bottom: 28,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  drawerVersion: { fontSize: 9, letterSpacing: 1.5 },
});