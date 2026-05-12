import React, { useCallback, useState } from "react";
import {
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

export interface ThemedAlertButton {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  primary?: boolean;
}

interface ThemedAlertProps {
  visible: boolean;
  title: string;
  message?: string;
  buttons: ThemedAlertButton[];
  C: any;
  onClose?: () => void;
}

export function ThemedAlert({
  visible,
  title,
  message,
  buttons,
  C,
  onClose,
}: ThemedAlertProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: C.bgSecondary,
              borderColor: C.cardBorder,
              shadowColor: C.mode === "dark" ? "#000" : "#888",
            },
          ]}
        >
          {/* Title */}
          <Text style={[styles.title, { color: C.textPrimary }]}>{title}</Text>

          {/* Message */}
          {message ? (
            <Text style={[styles.message, { color: C.textMuted }]}>
              {message}
            </Text>
          ) : null}

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: C.border }]} />

          {/* Buttons */}
          <View
            style={[
              styles.btnRow,
              buttons.length > 2 && styles.btnCol,
            ]}
          >
            {buttons.map((btn, i) => {
              const isDestructive = btn.destructive;
              const isPrimary = btn.primary;
              const isLast = i === buttons.length - 1;

              let bgColor = C.bgTertiary;
              let borderColor = C.border;
              let textColor = C.textMuted;

              if (isDestructive) {
                bgColor = C.redDim;
                borderColor = C.red + "66";
                textColor = C.red;
              } else if (isPrimary) {
                bgColor = C.gold;
                borderColor = C.gold;
                textColor = C.mode === "dark" ? "#0A0A0A" : "#FFFFFF";
              }

              return (
                <TouchableOpacity
                  key={`btn-${i}`}
                  onPress={btn.onPress}
                  activeOpacity={0.75}
                  style={[
                    styles.btn,
                    buttons.length === 1 && styles.btnFull,
                    buttons.length > 2 && styles.btnWide,
                    { backgroundColor: bgColor, borderColor },
                    !isLast && buttons.length <= 2 && styles.btnMarginRight,
                    !isLast && buttons.length > 2 && styles.btnMarginBottom,
                  ]}
                >
                  <Text style={[styles.btnTxt, { color: textColor }]}>
                    {btn.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Hook for easy usage ──────────────────────────────────────────────────────

interface AlertConfig {
  title: string;
  message?: string;
  buttons: ThemedAlertButton[];
}

export function useThemedAlert() {
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState<AlertConfig>({
    title: "",
    buttons: [],
  });

  const showAlert = useCallback((cfg: AlertConfig) => {
    setConfig(cfg);
    setVisible(true);
  }, []);

  const hideAlert = useCallback(() => {
    setVisible(false);
  }, []);

  // Wrap buttons to auto-close on press
  const wrappedConfig: AlertConfig = {
    ...config,
    buttons: config.buttons.map((btn) => ({
      ...btn,
      onPress: () => {
        setVisible(false);
        btn.onPress();
      },
    })),
  };

  return { visible, config: wrappedConfig, showAlert, hideAlert };
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  card: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 20,
    borderWidth: 1,
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 20,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  message: {
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 4,
  },
  divider: {
    height: 1,
    marginVertical: 16,
  },
  btnRow: {
    flexDirection: "row",
    gap: 10,
  },
  btnCol: {
    flexDirection: "column",
  },
  btn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  btnFull: {
    flex: 1,
  },
  btnWide: {
    flex: 0,
    width: "100%",
  },
  btnMarginRight: {
    // handled by gap
  },
  btnMarginBottom: {
    marginBottom: 2,
  },
  btnTxt: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
});