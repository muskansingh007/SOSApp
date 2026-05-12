import { useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";
import { ScrollView } from "react-native";

/**
 * Returns a ref to attach to any ScrollView.
 * Automatically scrolls to top whenever the screen gains focus.
 *
 * Usage:
 *   const scrollRef = useScrollToTop();
 *   <ScrollView ref={scrollRef} ...>
 */
export function useScrollToTop() {
  const scrollRef = useRef<ScrollView>(null);

  useFocusEffect(
    useCallback(() => {
      // Small timeout ensures the layout is ready before scrolling
      const t = setTimeout(() => {
        scrollRef.current?.scrollTo({ y: 0, animated: false });
      }, 50);
      return () => clearTimeout(t);
    }, [])
  );

  return scrollRef;
}