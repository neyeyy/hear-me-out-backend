import { useState, useRef, useCallback } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Animated, SafeAreaView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import API from "../services/api";

const QUESTIONS = [
  "I feel nervous or anxious",
  "I have trouble sleeping",
  "I feel overwhelmed",
  "I feel sad or hopeless",
  "I have difficulty concentrating",
];

const OPTIONS = [
  { value: 0, label: "Not at all",       color: "#4ECDC4" },
  { value: 1, label: "Several days",     color: "#6C63FF" },
  { value: 2, label: "More than half",   color: "#FFB347" },
  { value: 3, label: "Nearly every day", color: "#FF6B6B" },
];

export default function AssessmentScreen({ navigation }) {
  const [messages, setMessages] = useState([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [result, setResult] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [started, setStarted] = useState(false);

  const scrollRef = useRef(null);
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  const animateDots = useCallback(() => {
    const anim = (d, delay) =>
      Animated.sequence([
        Animated.delay(delay),
        Animated.loop(
          Animated.sequence([
            Animated.timing(d, { toValue: -5, duration: 300, useNativeDriver: true }),
            Animated.timing(d, { toValue: 0, duration: 300, useNativeDriver: true }),
          ]),
          { iterations: 5 }
        ),
      ]);
    Animated.parallel([anim(dot1, 0), anim(dot2, 150), anim(dot3, 300)]).start();
  }, [dot1, dot2, dot3]);

  const addBotMessage = useCallback((text) => {
    setMessages((prev) => [...prev, { sender: "bot", text }]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  const addUserMessage = useCallback((text) => {
    setMessages((prev) => [...prev, { sender: "user", text }]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  const simulateTyping = useCallback((callback) => {
    setIsTyping(true);
    animateDots();
    setTimeout(() => {
      setIsTyping(false);
      callback();
    }, 900);
  }, [animateDots]);

  const handleStart = () => {
    setStarted(true);
    addBotMessage("Hello 👋 I'm your Assessment Bot.");
    simulateTyping(() => addBotMessage(QUESTIONS[0]));
  };

  const handleAnswer = (value, label) => {
    addUserMessage(label);
    const updated = [...answers, value];
    setAnswers(updated);

    if (current < QUESTIONS.length - 1) {
      const next = current + 1;
      setCurrent(next);
      simulateTyping(() => addBotMessage(QUESTIONS[next]));
    } else {
      submitAssessment(updated);
    }
  };

  const submitAssessment = async (finalAnswers) => {
    try {
      const res = await API.post("/assessment", { answers: finalAnswers });
      setResult(res.data);

      simulateTyping(() => {
        addBotMessage(`Your score is ${res.data.score}`);
        addBotMessage(`Severity: ${res.data.severity}`);
        if (res.data.severity === "HIGH") {
          addBotMessage("⚠️ We recommend immediate counseling.");
        }
        if (res.data.appointment) {
          addBotMessage("📅 An appointment has been scheduled for you.");
        }
        if (res.data.severity === "MEDIUM" && !res.data.appointment) {
          addBotMessage("💬 You may consider talking to a counselor.");
        }
      });
    } catch (err) {
      console.log(err);
    }
  };

  const severityColor =
    result?.severity === "HIGH" ? "#FF6B6B"
    : result?.severity === "MEDIUM" ? "#FFB347"
    : "#4ECDC4";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#6C63FF" }}>
      <View style={styles.container}>
        {/* Header */}
        <LinearGradient colors={["#6C63FF", "#764ba2"]} style={styles.header}>
          <View style={styles.botAvatar}>
            <Text style={styles.botAvatarText}>🤖</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.botName}>Assessment Bot</Text>
            <Text style={styles.botStatus}>
              {isTyping ? "Typing…" : "Online ●"}
            </Text>
          </View>
          <Text style={styles.progress}>
            {started && !result ? `${current + 1}/${QUESTIONS.length}` : ""}
          </Text>
        </LinearGradient>

        {/* Welcome or Chat area */}
        {!started ? (
          <View style={styles.welcome}>
            <Text style={styles.welcomeIcon}>🧠</Text>
            <Text style={styles.welcomeTitle}>Mental Health Check-in</Text>
            <Text style={styles.welcomeText}>
              A quick 5-question assessment to understand how you're feeling.
              Your answers are completely private.
            </Text>

            <View style={styles.pillRow}>
              {["🕐 ~2 min", "🔒 Private", "💙 5 Qs"].map((p) => (
                <View key={p} style={styles.pill}>
                  <Text style={styles.pillText}>{p}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity onPress={handleStart} activeOpacity={0.85}>
              <LinearGradient colors={["#6C63FF", "#764ba2"]} style={styles.startBtn}>
                <Text style={styles.startBtnText}>Begin Assessment →</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Messages */}
            <ScrollView
              ref={scrollRef}
              style={styles.chatArea}
              contentContainerStyle={styles.chatContent}
              showsVerticalScrollIndicator={false}
            >
              {messages.map((msg, i) => (
                <View
                  key={i}
                  style={[
                    styles.msgRow,
                    msg.sender === "user" ? styles.msgRowUser : styles.msgRowBot,
                  ]}
                >
                  {msg.sender === "bot" && (
                    <View style={styles.miniAvatar}>
                      <Text>🤖</Text>
                    </View>
                  )}
                  <View style={msg.sender === "user" ? styles.userBubble : styles.botBubble}>
                    <Text style={msg.sender === "user" ? styles.userBubbleText : styles.botBubbleText}>
                      {msg.text}
                    </Text>
                  </View>
                </View>
              ))}

              {isTyping && (
                <View style={[styles.msgRow, styles.msgRowBot]}>
                  <View style={styles.miniAvatar}>
                    <Text>🤖</Text>
                  </View>
                  <View style={styles.typingBubble}>
                    {[dot1, dot2, dot3].map((d, i) => (
                      <Animated.View
                        key={i}
                        style={[styles.typingDot, { transform: [{ translateY: d }] }]}
                      />
                    ))}
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Options or Result */}
            {!result ? (
              <View style={styles.optionsBar}>
                <Text style={styles.optHint}>Choose your answer:</Text>
                <View style={styles.optGrid}>
                  {OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      onPress={() => handleAnswer(opt.value, opt.label)}
                      style={[styles.optBtn, { borderColor: opt.color }]}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.optBtnText, { color: opt.color }]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : (
              <View style={styles.resultBar}>
                <View style={[styles.severityBadge, { backgroundColor: severityColor }]}>
                  <Text style={styles.severityText}>{result.severity} RISK</Text>
                </View>
                <TouchableOpacity
                  onPress={() => navigation.replace("Dashboard")}
                  activeOpacity={0.85}
                >
                  <LinearGradient colors={["#6C63FF", "#764ba2"]} style={styles.continueBtn}>
                    <Text style={styles.continueBtnText}>Go to Dashboard →</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F8",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    paddingTop: 8,
    gap: 12,
  },
  botAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  botAvatarText: { fontSize: 22 },
  botName: { color: "#fff", fontWeight: "700", fontSize: 16 },
  botStatus: { color: "rgba(255,255,255,0.8)", fontSize: 12, marginTop: 1 },
  progress: { color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: "600" },

  welcome: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    backgroundColor: "#FAFBFF",
  },
  welcomeIcon: { fontSize: 64, marginBottom: 20 },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1A1A2E",
    marginBottom: 12,
    textAlign: "center",
  },
  welcomeText: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  pillRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "center",
    marginBottom: 32,
  },
  pill: {
    backgroundColor: "#EEF2FF",
    borderRadius: 99,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  pillText: { color: "#6C63FF", fontSize: 12, fontWeight: "600" },
  startBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 40,
    shadowColor: "#6C63FF",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  startBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  chatArea: { flex: 1 },
  chatContent: { padding: 14, paddingBottom: 8 },
  msgRow: { flexDirection: "row", alignItems: "flex-end", marginBottom: 8 },
  msgRowUser: { justifyContent: "flex-end" },
  msgRowBot: { justifyContent: "flex-start" },
  miniAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 6,
  },
  botBubble: {
    backgroundColor: "#fff",
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    padding: 12,
    maxWidth: "72%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  botBubbleText: { fontSize: 14, color: "#1A1A2E", lineHeight: 20 },
  userBubble: {
    borderRadius: 18,
    borderBottomRightRadius: 4,
    padding: 12,
    maxWidth: "72%",
    backgroundColor: "#6C63FF",
    shadowColor: "#6C63FF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  userBubbleText: { fontSize: 14, color: "#fff", lineHeight: 20 },
  typingBubble: {
    backgroundColor: "#fff",
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    padding: 14,
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#9CA3AF",
  },

  optionsBar: {
    backgroundColor: "#fff",
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  optHint: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  optGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optBtn: {
    borderWidth: 2,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "#fff",
    minWidth: "47%",
    alignItems: "center",
  },
  optBtnText: { fontSize: 13, fontWeight: "700" },

  resultBar: {
    backgroundColor: "#fff",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    gap: 12,
    alignItems: "center",
  },
  severityBadge: {
    borderRadius: 99,
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  severityText: { color: "#fff", fontWeight: "800", fontSize: 13, letterSpacing: 0.8 },
  continueBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 40,
    alignItems: "center",
    shadowColor: "#6C63FF",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
  },
  continueBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
