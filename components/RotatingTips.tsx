// ─── Drop-in replacement for the static tips list in alert.tsx ───────────────
// Replace the entire "What to do now" section (from the sectionLabel down to
// the closing </View> of tipsList) with this component, then render it as:
//   <RotatingTips C={C} />

import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

const TIPS = [
  { icon: "📞", tip: "Call 112 if in immediate danger" },
  { icon: "🏃", tip: "Move to a safe, public location" },
  { icon: "🔊", tip: "Make noise to attract attention" },
  { icon: "🚪", tip: "Stay near exits if indoors" },
  { icon: "📍", tip: "Share your location with someone you trust" },
  { icon: "🧍", tip: "Stay calm — help is on the way" },
];

// How long each tip shows (ms)
const TIP_DURATION = 3500;
// Fade transition duration (ms)
const FADE_DURATION = 400;

export function RotatingTips({ C }: { C: any }) {
  const [index, setIndex]     = useState(0);
  const fadeAnim              = useRef(new Animated.Value(1)).current;
  const slideAnim             = useRef(new Animated.Value(0)).current;
  const intervalRef           = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      // Fade + slide out
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 0, duration: FADE_DURATION, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: -12, duration: FADE_DURATION, useNativeDriver: true }),
      ]).start(() => {
        setIndex((prev) => (prev + 1) % TIPS.length);
        // Reset slide to come from below
        slideAnim.setValue(12);
        // Fade + slide in
        Animated.parallel([
          Animated.timing(fadeAnim,  { toValue: 1, duration: FADE_DURATION, useNativeDriver: true }),
          Animated.timing(slideAnim, { toValue: 0, duration: FADE_DURATION, useNativeDriver: true }),
        ]).start();
      });
    }, TIP_DURATION);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fadeAnim, slideAnim]);

  const tip = TIPS[index];

  return (
    <View>
      <Text style={[tipStyles.sectionLabel, { color: C.sectionHeader }]}>
        WHAT TO DO NOW
      </Text>

      {/* Progress dots */}
      <View style={tipStyles.dotsRow}>
        {TIPS.map((_, i) => (
          <View
            key={i}
            style={[
              tipStyles.dot,
              {
                backgroundColor: i === index ? C.red : C.border,
                width: i === index ? 16 : 6,
              },
            ]}
          />
        ))}
      </View>

      {/* Animated tip card */}
      <Animated.View
        style={[
          tipStyles.tipCard,
          {
            backgroundColor: C.cardBg,
            borderColor: C.cardBorder,
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <Text style={tipStyles.tipIcon}>{tip.icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[tipStyles.tipTxt, { color: C.textSecondary }]}>
            {tip.tip}
          </Text>
          <Text style={[tipStyles.tipCounter, { color: C.textDim }]}>
            {index + 1} / {TIPS.length}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

const tipStyles = StyleSheet.create({
  sectionLabel: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 2,
    marginTop: 20,
    marginBottom: 10,
    marginLeft: 4,
  },
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 10,
    marginLeft: 4,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  tipCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 72,
  },
  tipIcon: { fontSize: 28 },
  tipTxt: { fontSize: 14, fontWeight: "600", lineHeight: 20, flex: 1 },
  tipCounter: { fontSize: 10, fontWeight: "600", marginTop: 4 },
});