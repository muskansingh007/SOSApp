import { useTheme } from "@/context/ThemeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio, AVPlaybackStatus, ResizeMode, Video } from "expo-av";
import * as FileSystem from "expo-file-system";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
    Alert,
    Animated,
    Easing,
    FlatList,
    Modal,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Recording {
  id: string;
  uri: string;
  type: "audio" | "video";
  duration: number;      // seconds
  triggeredAt: string;   // ISO string
  sizeBytes: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDuration(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = Math.floor(secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) +
    " · " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

const STORAGE_KEY = "sos_recordings";

// ─── Audio Player Row ─────────────────────────────────────────────────────────
function AudioPlayerRow({
  rec,
  C,
  onDelete,
}: {
  rec: Recording;
  C: any;
  onDelete: (id: string) => void;
}) {
  const [playing, setPlaying]   = useState(false);
  const [progress, setProgress] = useState(0); // 0–1
  const [elapsed, setElapsed]   = useState(0);
  const soundRef                = useRef<Audio.Sound | null>(null);
  const waveAnim                = useRef(new Animated.Value(1)).current;
  const waveLoop                = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    return () => { soundRef.current?.unloadAsync(); };
  }, []);

  useEffect(() => {
    if (playing) {
      waveLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(waveAnim, { toValue: 1.4, duration: 400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(waveAnim, { toValue: 1,   duration: 400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
      waveLoop.current.start();
    } else {
      waveLoop.current?.stop();
      Animated.spring(waveAnim, { toValue: 1, useNativeDriver: true }).start();
    }
  }, [playing, waveAnim]);

  async function togglePlay() {
    if (playing) {
      await soundRef.current?.pauseAsync();
      setPlaying(false);
      return;
    }
    try {
      if (!soundRef.current) {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const { sound } = await Audio.Sound.createAsync(
          { uri: rec.uri },
          { shouldPlay: true },
          (status: AVPlaybackStatus) => {
            if (!status.isLoaded) return;
            const dur = status.durationMillis ?? 1;
            setProgress((status.positionMillis ?? 0) / dur);
            setElapsed(Math.floor((status.positionMillis ?? 0) / 1000));
            if (status.didJustFinish) {
              setPlaying(false);
              setProgress(0);
              setElapsed(0);
              soundRef.current = null;
            }
          }
        );
        soundRef.current = sound;
      } else {
        await soundRef.current.playAsync();
      }
      setPlaying(true);
    } catch {
      Alert.alert("Playback Error", "Could not play this recording.");
    }
  }

  async function handleDelete() {
    Alert.alert("Delete Recording", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          await soundRef.current?.unloadAsync();
          onDelete(rec.id);
        },
      },
    ]);
  }

  return (
    <View style={[styles.recCard, { backgroundColor: C.cardBg, borderColor: C.cardBorder }]}>
      <View style={styles.recHeader}>
        {/* Wave icon */}
        <View style={[styles.recIconWrap, { backgroundColor: C.goldMid }]}>
          <Animated.View style={{ flexDirection: "row", alignItems: "center", gap: 2, transform: [{ scaleY: waveAnim }] }}>
            {[3, 6, 4, 7, 3].map((h, i) => (
              <View key={i} style={{ width: 2.5, height: h * 2, borderRadius: 2, backgroundColor: C.gold }} />
            ))}
          </Animated.View>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={[styles.recTitle, { color: C.textPrimary }]}>SOS Audio Recording</Text>
          <Text style={[styles.recMeta, { color: C.textMuted }]}>{formatDate(rec.triggeredAt)}</Text>
          <Text style={[styles.recSize, { color: C.textDim }]}>{formatSize(rec.sizeBytes)} · {formatDuration(rec.duration)}</Text>
        </View>

        <TouchableOpacity onPress={handleDelete} hitSlop={10} style={[styles.deleteBtn, { backgroundColor: C.redDim, borderColor: C.red + "55" }]}>
          <Text style={[styles.deleteTxt, { color: C.red }]}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Progress bar */}
      <View style={[styles.progressTrack, { backgroundColor: C.bgTertiary }]}>
        <View style={[styles.progressFill, { backgroundColor: C.gold, width: `${progress * 100}%` }]} />
      </View>

      {/* Controls */}
      <View style={styles.recControls}>
        <Text style={[styles.elapsedTxt, { color: C.textDim }]}>{formatDuration(elapsed)}</Text>
        <TouchableOpacity onPress={togglePlay} style={[styles.playBtn, { backgroundColor: C.gold }]}>
          <Text style={[styles.playBtnTxt, { color: C.mode === "dark" ? "#0A0A0A" : "#fff" }]}>
            {playing ? "⏸" : "▶"}
          </Text>
        </TouchableOpacity>
        <Text style={[styles.elapsedTxt, { color: C.textDim }]}>{formatDuration(rec.duration)}</Text>
      </View>
    </View>
  );
}

// ─── Video Player Modal ───────────────────────────────────────────────────────
function VideoPlayerModal({
  rec,
  visible,
  onClose,
  C,
}: {
  rec: Recording | null;
  visible: boolean;
  onClose: () => void;
  C: any;
}) {
  const videoRef = useRef<Video>(null);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.videoOverlay}>
        <View style={[styles.videoCard, { backgroundColor: C.bg }]}>
          <View style={styles.videoHeader}>
            <Text style={[styles.videoTitle, { color: C.textPrimary }]}>SOS Video Recording</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Text style={[styles.videoClose, { color: C.textMuted }]}>✕</Text>
            </TouchableOpacity>
          </View>
          {rec && (
            <Video
              ref={videoRef}
              source={{ uri: rec.uri }}
              style={styles.videoPlayer}
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay
            />
          )}
          {rec && (
            <Text style={[styles.videoMeta, { color: C.textMuted }]}>
              {formatDate(rec.triggeredAt)} · {formatSize(rec.sizeBytes)}
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Video Card ───────────────────────────────────────────────────────────────
function VideoCard({
  rec,
  C,
  onPlay,
  onDelete,
}: {
  rec: Recording;
  C: any;
  onPlay: () => void;
  onDelete: (id: string) => void;
}) {
  function handleDelete() {
    Alert.alert("Delete Recording", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => onDelete(rec.id) },
    ]);
  }

  return (
    <View style={[styles.recCard, { backgroundColor: C.cardBg, borderColor: C.cardBorder }]}>
      <View style={styles.recHeader}>
        <View style={[styles.recIconWrap, { backgroundColor: C.redDim }]}>
          <Text style={{ fontSize: 18 }}>🎥</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.recTitle, { color: C.textPrimary }]}>SOS Video Recording</Text>
          <Text style={[styles.recMeta, { color: C.textMuted }]}>{formatDate(rec.triggeredAt)}</Text>
          <Text style={[styles.recSize, { color: C.textDim }]}>{formatSize(rec.sizeBytes)} · {formatDuration(rec.duration)}</Text>
        </View>
        <TouchableOpacity onPress={handleDelete} hitSlop={10} style={[styles.deleteBtn, { backgroundColor: C.redDim, borderColor: C.red + "55" }]}>
          <Text style={[styles.deleteTxt, { color: C.red }]}>✕</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity onPress={onPlay} style={[styles.playVideoBtn, { backgroundColor: C.redDim, borderColor: C.red + "44" }]}>
        <Text style={[styles.playVideoBtnTxt, { color: C.red }]}>▶  Play Video</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({ C, router }: { C: any; router: any }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>🎙️</Text>
      <Text style={[styles.emptyTitle, { color: C.textPrimary }]}>No Recordings Yet</Text>
      <Text style={[styles.emptyBody, { color: C.textMuted }]}>
        When SOS is triggered with Auto Audio or Video Recording enabled, recordings will appear here.
      </Text>
      <TouchableOpacity
        onPress={() => router.push("/settings")}
        style={[styles.emptyBtn, { backgroundColor: C.goldMid, borderColor: C.gold }]}
      >
        <Text style={[styles.emptyBtnTxt, { color: C.goldText }]}>Enable in Settings →</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function RecordingsScreen() {
  const { theme: C } = useTheme();
  const router       = useRouter();
  const insets       = useSafeAreaInsets();

  const [recordings, setRecordings]       = useState<Recording[]>([]);
  const [loading, setLoading]             = useState(true);
  const [activeVideo, setActiveVideo]     = useState<Recording | null>(null);
  const [filter, setFilter]               = useState<"all" | "audio" | "video">("all");

  useEffect(() => {
    loadRecordings();
  }, []);

  async function loadRecordings() {
    setLoading(true);
    try {
      // Load from our own metadata store
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const stored: Recording[] = raw ? JSON.parse(raw) : [];

      // Verify each file still exists; drop orphans
      const verified: Recording[] = [];
      for (const r of stored) {
        try {
          const info = await FileSystem.getInfoAsync(r.uri);
          if (info.exists) {
            verified.push({ ...r, sizeBytes: (info as any).size ?? r.sizeBytes });
          }
        } catch { /* skip */ }
      }

      // Sort newest first
      verified.sort((a, b) => new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime());
      setRecordings(verified);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(verified));
    } catch {
      setRecordings([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    const rec = recordings.find((r) => r.id === id);
    if (rec) {
      try { await FileSystem.deleteAsync(rec.uri, { idempotent: true }); } catch {}
    }
    const updated = recordings.filter((r) => r.id !== id);
    setRecordings(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }

  async function handleDeleteAll() {
    Alert.alert("Delete All Recordings", "This will permanently delete all recordings. This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete All", style: "destructive",
        onPress: async () => {
          for (const r of recordings) {
            try { await FileSystem.deleteAsync(r.uri, { idempotent: true }); } catch {}
          }
          setRecordings([]);
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([]));
        },
      },
    ]);
  }

  const filtered = filter === "all" ? recordings : recordings.filter((r) => r.type === filter);
  const audioCount = recordings.filter((r) => r.type === "audio").length;
  const videoCount = recordings.filter((r) => r.type === "video").length;

  return (
    <View style={[styles.root, { backgroundColor: C.bg, paddingTop: insets.top }]}>
      <StatusBar barStyle={C.statusBarStyle} backgroundColor={C.bg} />

      {/* Top nav */}
      <View style={[styles.topNav, { borderBottomColor: C.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={[styles.backBtn, { color: C.gold }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: C.textPrimary }]}>Recordings</Text>
        {recordings.length > 0 ? (
          <TouchableOpacity onPress={handleDeleteAll} hitSlop={12}>
            <Text style={[styles.deleteAllBtn, { color: C.red }]}>Delete All</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 72 }} />
        )}
      </View>

      {/* Stats row */}
      {recordings.length > 0 && (
        <View style={[styles.statsRow, { borderBottomColor: C.border }]}>
          <View style={[styles.statChip, { backgroundColor: C.goldMid, borderColor: C.gold }]}>
            <Text style={[styles.statNum, { color: C.goldText }]}>{audioCount}</Text>
            <Text style={[styles.statLabel, { color: C.goldText }]}>Audio</Text>
          </View>
          <View style={[styles.statChip, { backgroundColor: C.redDim, borderColor: C.red + "55" }]}>
            <Text style={[styles.statNum, { color: C.red }]}>{videoCount}</Text>
            <Text style={[styles.statLabel, { color: C.red }]}>Video</Text>
          </View>
          <View style={[styles.statChip, { backgroundColor: C.bgTertiary, borderColor: C.border }]}>
            <Text style={[styles.statNum, { color: C.textPrimary }]}>{recordings.length}</Text>
            <Text style={[styles.statLabel, { color: C.textMuted }]}>Total</Text>
          </View>
        </View>
      )}

      {/* Filter chips */}
      {recordings.length > 0 && (
        <View style={[styles.filterRow, { borderBottomColor: C.border }]}>
          {(["all", "audio", "video"] as const).map((f) => (
            <TouchableOpacity
              key={f}
              onPress={() => setFilter(f)}
              style={[styles.filterChip, {
                backgroundColor: filter === f ? C.goldMid : C.bgTertiary,
                borderColor: filter === f ? C.gold : C.border,
              }]}
            >
              <Text style={[styles.filterChipTxt, { color: filter === f ? C.goldText : C.textMuted }]}>
                {f === "all" ? "All" : f === "audio" ? "🎙 Audio" : "🎥 Video"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Content */}
      {loading ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyBody, { color: C.textMuted }]}>Loading recordings...</Text>
        </View>
      ) : recordings.length === 0 ? (
        <EmptyState C={C} router={router} />
      ) : filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyBody, { color: C.textMuted }]}>No {filter} recordings found.</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          renderItem={({ item }) =>
            item.type === "audio" ? (
              <AudioPlayerRow rec={item} C={C} onDelete={handleDelete} />
            ) : (
              <VideoCard rec={item} C={C} onPlay={() => setActiveVideo(item)} onDelete={handleDelete} />
            )
          }
        />
      )}

      {/* Video player modal */}
      <VideoPlayerModal
        rec={activeVideo}
        visible={activeVideo !== null}
        onClose={() => setActiveVideo(null)}
        C={C}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1 },
  topNav:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  backBtn: { fontSize: 22, fontWeight: "700", width: 36 },
  navTitle:     { fontSize: 15, fontWeight: "900", letterSpacing: 0.5 },
  deleteAllBtn: { fontSize: 12, fontWeight: "700" },

  statsRow:  { flexDirection: "row", gap: 10, paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1 },
  statChip:  { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1 },
  statNum:   { fontSize: 14, fontWeight: "900" },
  statLabel: { fontSize: 10, fontWeight: "700" },

  filterRow:     { flexDirection: "row", gap: 8, paddingHorizontal: 20, paddingVertical: 10, borderBottomWidth: 1 },
  filterChip:    { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  filterChipTxt: { fontSize: 11, fontWeight: "700" },

  listContent: { padding: 16 },

  recCard:    { borderRadius: 16, borderWidth: 1, padding: 14, gap: 12 },
  recHeader:  { flexDirection: "row", alignItems: "center", gap: 12 },
  recIconWrap:{ width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  recTitle:   { fontSize: 13, fontWeight: "800", marginBottom: 2 },
  recMeta:    { fontSize: 11, fontWeight: "500", marginBottom: 1 },
  recSize:    { fontSize: 10, fontWeight: "600" },
  deleteBtn:  { width: 32, height: 32, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  deleteTxt:  { fontSize: 12, fontWeight: "900" },

  progressTrack: { height: 3, borderRadius: 2, overflow: "hidden" },
  progressFill:  { height: 3, borderRadius: 2 },

  recControls: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  elapsedTxt:  { fontSize: 11, fontWeight: "700", width: 36 },
  playBtn:     { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  playBtnTxt:  { fontSize: 18 },

  playVideoBtn:    { paddingVertical: 12, borderRadius: 12, borderWidth: 1, alignItems: "center" },
  playVideoBtnTxt: { fontSize: 13, fontWeight: "800" },

  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, gap: 14 },
  emptyEmoji: { fontSize: 52, marginBottom: 4 },
  emptyTitle: { fontSize: 18, fontWeight: "900", textAlign: "center" },
  emptyBody:  { fontSize: 13, fontWeight: "500", textAlign: "center", lineHeight: 20 },
  emptyBtn:   { marginTop: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14, borderWidth: 1 },
  emptyBtnTxt:{ fontSize: 13, fontWeight: "800" },

  videoOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.88)", alignItems: "center", justifyContent: "center", padding: 20 },
  videoCard:    { width: "100%", borderRadius: 20, overflow: "hidden", padding: 16, gap: 12 },
  videoHeader:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  videoTitle:   { fontSize: 14, fontWeight: "900" },
  videoClose:   { fontSize: 18, fontWeight: "700" },
  videoPlayer:  { width: "100%", aspectRatio: 16 / 9, borderRadius: 12, backgroundColor: "#000" },
  videoMeta:    { fontSize: 11, fontWeight: "500", textAlign: "center" },
});