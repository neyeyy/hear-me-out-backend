import { useState, useRef, useEffect } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput,
  SafeAreaView, Dimensions, Animated, ScrollView, StatusBar,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import API from "../services/api";

const { width, height } = Dimensions.get("window");

const MOODS = [
  {
    key: "HAPPY",
    emoji: "😊",
    label: "Happy",
    gradient: ["#4ECDC4", "#44A08D"],
    glow: "#4ECDC4",
    bg: "#F0FDF9",
    quote: "You're radiating great energy today! Keep that smile going 🌟",
  },
  {
    key: "SAD",
    emoji: "😢",
    label: "Sad",
    gradient: ["#6C63FF", "#9B59B6"],
    glow: "#6C63FF",
    bg: "#EEF2FF",
    quote: "It's okay to feel sad. Your feelings are valid 💙 Better days ahead.",
  },
  {
    key: "STRESSED",
    emoji: "😫",
    label: "Stressed",
    gradient: ["#F7971E", "#FFD200"],
    glow: "#F7971E",
    bg: "#FFFBF0",
    quote: "One breath at a time. You're handling more than you know 🌿",
  },
  {
    key: "ANXIOUS",
    emoji: "😰",
    label: "Anxious",
    gradient: ["#FF6B6B", "#FF8E53"],
    glow: "#FF6B6B",
    bg: "#FFF5F5",
    quote: "You are safe right now. This feeling will pass 🌈",
  },
];

// Step: "pick" → "note" → "done"
export default function StudentDashboardScreen({ navigation }) {
  const [step, setStep] = useState("pick");
  const [selectedMood, setSelectedMood] = useState(null);
  const [note, setNote] = useState("");
  const [userName, setUserName] = useState("");

  // Animations
  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const slideAnim  = useRef(new Animated.Value(40)).current;
  const scaleAnim  = useRef(new Animated.Value(0.85)).current;
  const cardAnims  = useRef(MOODS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    AsyncStorage.getItem("userName").then((n) => setUserName(n || ""));
    animateIn();
  }, []);

  const animateIn = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start(() => {
      Animated.stagger(80, cardAnims.map((a) =>
        Animated.spring(a, { toValue: 1, useNativeDriver: true, tension: 120, friction: 8 })
      )).start();
    });
  };

  const handleMoodPress = (mood) => {
    Animated.spring(scaleAnim, {
      toValue: 1, tension: 150, friction: 6, useNativeDriver: true,
    }).start();
    setSelectedMood(mood);
    setStep("note");
  };

  const handleSave = async () => {
    try {
      await API.post("/moods", { mood: selectedMood.key, note });
    } catch (err) {
      console.log(err);
    }
    setStep("done");
  };

  const handleReset = () => {
    setStep("pick");
    setSelectedMood(null);
    setNote("");
    cardAnims.forEach((a) => a.setValue(0));
    fadeAnim.setValue(0);
    slideAnim.setValue(40);
    scaleAnim.setValue(0.85);
    animateIn();
  };

  const firstName = userName ? userName.split(" ")[0] : "there";

  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" />

      {/* ── STEP: PICK MOOD ── */}
      {step === "pick" && (
        <LinearGradient colors={["#1a1a2e", "#16213e", "#0f3460"]} style={styles.page}>
          {/* Floating decorative blobs */}
          <View style={[styles.blob, { width: 280, height: 280, top: -80, right: -60, opacity: 0.12 }]} />
          <View style={[styles.blob, { width: 200, height: 200, bottom: 100, left: -50, opacity: 0.08 }]} />
          <View style={[styles.blob, { width: 150, height: 150, top: "40%", right: -30, opacity: 0.06, backgroundColor: "#6C63FF" }]} />

          <SafeAreaView style={{ flex: 1 }}>
            <ScrollView
              contentContainerStyle={styles.pickContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Header */}
              <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
                <View style={styles.topRow}>
                  <View>
                    <Text style={styles.greeting}>Hey, {firstName} 👋</Text>
                    <Text style={styles.dateText}>
                      {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => navigation.navigate("Calendar")}
                    style={styles.calBtn}
                  >
                    <Text style={styles.calBtnText}>📊</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.heroWrap}>
                  <Text style={styles.heroEmoji}>💙</Text>
                  <Text style={styles.heroTitle}>How are you{"\n"}feeling today?</Text>
                  <Text style={styles.heroSub}>
                    Your feelings matter. Take a moment{"\n"}to check in with yourself.
                  </Text>
                </View>
              </Animated.View>

              {/* Mood Cards */}
              <View style={styles.moodGrid}>
                {MOODS.map((mood, i) => (
                  <Animated.View
                    key={mood.key}
                    style={{
                      opacity: cardAnims[i],
                      transform: [
                        { scale: cardAnims[i] },
                        { translateY: cardAnims[i].interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
                      ],
                      width: "47%",
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => handleMoodPress(mood)}
                      activeOpacity={0.88}
                      style={styles.moodCardTouch}
                    >
                      <LinearGradient
                        colors={mood.gradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.moodCard}
                      >
                        {/* Shine effect */}
                        <View style={styles.cardShine} />

                        <Text style={styles.moodEmoji}>{mood.emoji}</Text>
                        <Text style={styles.moodLabel}>{mood.label}</Text>

                        <View style={styles.moodArrow}>
                          <Text style={styles.moodArrowText}>→</Text>
                        </View>
                      </LinearGradient>
                    </TouchableOpacity>
                  </Animated.View>
                ))}
              </View>

              {/* Bottom hint */}
              <Animated.View style={{ opacity: fadeAnim, alignItems: "center", marginTop: 8, marginBottom: 20 }}>
                <Text style={styles.hint}>Tap to log your mood</Text>
              </Animated.View>
            </ScrollView>
          </SafeAreaView>
        </LinearGradient>
      )}

      {/* ── STEP: ADD NOTE ── */}
      {step === "note" && selectedMood && (
        <LinearGradient colors={selectedMood.gradient} style={styles.page}>
          <View style={[styles.blob, { width: 300, height: 300, top: -100, right: -80, opacity: 0.15 }]} />
          <View style={[styles.blob, { width: 220, height: 220, bottom: 80, left: -60, opacity: 0.1 }]} />

          <SafeAreaView style={{ flex: 1 }}>
            <ScrollView
              contentContainerStyle={styles.noteContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Back button */}
              <TouchableOpacity onPress={() => setStep("pick")} style={styles.backBtn}>
                <Text style={styles.backBtnText}>← Back</Text>
              </TouchableOpacity>

              {/* Big emoji */}
              <Animated.View style={{ alignItems: "center", transform: [{ scale: scaleAnim }] }}>
                <View style={styles.bigEmojiWrap}>
                  <Text style={styles.bigEmoji}>{selectedMood.emoji}</Text>
                </View>
                <Text style={styles.noteMoodLabel}>Feeling {selectedMood.label}</Text>
              </Animated.View>

              {/* Quote card */}
              <View style={styles.quoteCard}>
                <Text style={styles.quoteIcon}>"</Text>
                <Text style={styles.quoteText}>{selectedMood.quote}</Text>
              </View>

              {/* Note input */}
              <View style={styles.noteSection}>
                <Text style={styles.noteSectionTitle}>Want to share more?</Text>
                <Text style={styles.noteSectionSub}>Write anything on your mind (optional)</Text>
                <View style={styles.noteInputWrap}>
                  <TextInput
                    placeholder="e.g. I had a tough exam today..."
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    value={note}
                    onChangeText={setNote}
                    multiline
                    style={styles.noteInput}
                  />
                  <View style={styles.noteCharCount}>
                    <Text style={styles.noteCharCountText}>{note.length}/200</Text>
                  </View>
                </View>
              </View>

              {/* Save button */}
              <TouchableOpacity onPress={handleSave} activeOpacity={0.88} style={styles.saveBtn}>
                <View style={styles.saveBtnInner}>
                  <Text style={styles.saveBtnText}>Save my mood ✓</Text>
                </View>
              </TouchableOpacity>

              {/* Skip */}
              <TouchableOpacity onPress={handleSave} style={styles.skipBtn}>
                <Text style={styles.skipBtnText}>Skip note, just save →</Text>
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </LinearGradient>
      )}

      {/* ── STEP: DONE ── */}
      {step === "done" && selectedMood && (
        <LinearGradient colors={["#1a1a2e", "#16213e", "#0f3460"]} style={styles.page}>
          <View style={[styles.blob, { width: 300, height: 300, top: -80, right: -80, opacity: 0.12 }]} />

          <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <View style={styles.doneWrap}>
              {/* Success ring */}
              <View style={styles.successRing}>
                <LinearGradient
                  colors={selectedMood.gradient}
                  style={styles.successGradient}
                >
                  <Text style={styles.successEmoji}>{selectedMood.emoji}</Text>
                </LinearGradient>
              </View>

              <Text style={styles.doneTitle}>Mood Saved! 🎉</Text>
              <Text style={styles.doneSub}>
                You've logged <Text style={{ fontWeight: "800", color: "#fff" }}>{selectedMood.label}</Text> for today.
                {"\n"}Keep checking in — it helps! 💙
              </Text>

              {/* Pill actions */}
              <View style={styles.doneActions}>
                <TouchableOpacity
                  onPress={() => navigation.navigate("Calendar")}
                  activeOpacity={0.85}
                >
                  <LinearGradient colors={["#6C63FF", "#764ba2"]} style={styles.doneBtn}>
                    <Text style={styles.doneBtnText}>📊 View History</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => navigation.navigate("Chat")}
                  activeOpacity={0.85}
                >
                  <LinearGradient colors={["#4ECDC4", "#44A08D"]} style={styles.doneBtn}>
                    <Text style={styles.doneBtnText}>💬 Talk to Counselor</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity onPress={handleReset} style={styles.doneBtnOutline}>
                  <Text style={styles.doneBtnOutlineText}>🔄 Track Again</Text>
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </LinearGradient>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    position: "relative",
    overflow: "hidden",
  },
  blob: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: "#6C63FF",
  },

  // ── Pick step ──────────────────────
  pickContent: {
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 32,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 32,
  },
  greeting: {
    fontSize: 14,
    color: "rgba(255,255,255,0.65)",
    fontWeight: "500",
    marginBottom: 2,
  },
  dateText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
  },
  calBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  calBtnText: { fontSize: 20 },

  heroWrap: {
    alignItems: "center",
    marginBottom: 36,
  },
  heroEmoji: {
    fontSize: 52,
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
    lineHeight: 40,
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  heroSub: {
    fontSize: 14,
    color: "rgba(255,255,255,0.55)",
    textAlign: "center",
    lineHeight: 21,
  },

  moodGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 14,
  },
  moodCardTouch: {
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 18,
    elevation: 10,
  },
  moodCard: {
    borderRadius: 24,
    padding: 22,
    height: 160,
    justifyContent: "space-between",
    overflow: "hidden",
    position: "relative",
  },
  cardShine: {
    position: "absolute",
    top: -30,
    right: -30,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  moodEmoji: {
    fontSize: 46,
  },
  moodLabel: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.3,
  },
  moodArrow: {
    alignSelf: "flex-end",
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.25)",
    justifyContent: "center",
    alignItems: "center",
  },
  moodArrowText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },

  hint: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 0.5,
  },

  // ── Note step ──────────────────────
  noteContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 48,
  },
  backBtn: {
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 20,
  },
  backBtnText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 15,
    fontWeight: "600",
  },
  bigEmojiWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  bigEmoji: { fontSize: 60 },
  noteMoodLabel: {
    fontSize: 26,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 24,
    letterSpacing: -0.4,
  },

  quoteCard: {
    backgroundColor: "rgba(0,0,0,0.18)",
    borderRadius: 20,
    padding: 20,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  quoteIcon: {
    fontSize: 28,
    color: "rgba(255,255,255,0.35)",
    lineHeight: 24,
    marginBottom: 4,
    fontStyle: "italic",
  },
  quoteText: {
    fontSize: 15,
    color: "rgba(255,255,255,0.88)",
    lineHeight: 23,
    fontStyle: "italic",
  },

  noteSection: {
    marginBottom: 28,
  },
  noteSectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
  },
  noteSectionSub: {
    fontSize: 13,
    color: "rgba(255,255,255,0.55)",
    marginBottom: 14,
  },
  noteInputWrap: {
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.2)",
    overflow: "hidden",
  },
  noteInput: {
    color: "#fff",
    fontSize: 15,
    padding: 16,
    minHeight: 110,
    textAlignVertical: "top",
    lineHeight: 22,
  },
  noteCharCount: {
    alignItems: "flex-end",
    paddingRight: 14,
    paddingBottom: 10,
  },
  noteCharCountText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.35)",
  },

  saveBtn: {
    marginBottom: 14,
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  saveBtnInner: {
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingVertical: 18,
    alignItems: "center",
    borderRadius: 18,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1A1A2E",
    letterSpacing: 0.2,
  },
  skipBtn: {
    alignItems: "center",
    paddingVertical: 10,
  },
  skipBtnText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    fontWeight: "500",
  },

  // ── Done step ──────────────────────
  doneWrap: {
    alignItems: "center",
    paddingHorizontal: 28,
  },
  successRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    padding: 5,
    backgroundColor: "rgba(255,255,255,0.12)",
    marginBottom: 28,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.2)",
  },
  successGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
  },
  successEmoji: { fontSize: 52 },

  doneTitle: {
    fontSize: 30,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  doneSub: {
    fontSize: 15,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 40,
  },
  doneActions: {
    width: "100%",
    gap: 12,
  },
  doneBtn: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  doneBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  doneBtnOutline: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.25)",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  doneBtnOutlineText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 15,
    fontWeight: "700",
  },
});
