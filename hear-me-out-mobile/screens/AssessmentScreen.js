import { useState, useRef, useCallback } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Animated, SafeAreaView, Platform, StatusBar,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import API from "../services/api";

// react-native's core SafeAreaView only applies inset padding on iOS — on
// Android it's a no-op, so the header sat under/behind the status bar
// without this, making it hard to see and tap.
const ANDROID_STATUS_BAR_PAD = Platform.OS === "android" ? (StatusBar.currentHeight || 24) : 0;

// Official PHQ-9 (depression) and GAD-7 (anxiety) screening instruments —
// wording and scale match the standard clinical form.
const PHQ9_QUESTIONS = [
  "Little interest or pleasure in doing things.",
  "Feeling down, depressed, or hopeless.",
  "Trouble falling or staying asleep, or sleeping too much.",
  "Feeling tired or having little energy.",
  "Poor appetite or overeating.",
  "Feeling bad about yourself – or that you are a failure or have let yourself or your family down.",
  "Trouble concentrating on things, such as reading the newspaper or watching television.",
  "Moving or speaking so slowly that other people could have noticed. Or the opposite – being so fidgety or restless that you have been moving around a lot more than usual.",
  "Thoughts that you would be better off dead, or of hurting yourself in some way.",
];

const GAD7_QUESTIONS = [
  "Feeling nervous, anxious, or on edge.",
  "Not being able to stop or control worrying.",
  "Worrying too much about different things.",
  "Trouble relaxing.",
  "Being so restless that it's hard to sit still.",
  "Becoming easily annoyed or irritable.",
  "Feeling afraid as if something awful might happen.",
];

const QUESTIONS = [
  ...PHQ9_QUESTIONS.map((text) => ({ text, section: "PHQ9" })),
  ...GAD7_QUESTIONS.map((text) => ({ text, section: "GAD7" })),
];

const OPTIONS_BY_SECTION = {
  PHQ9: [
    { value: 0, label: "Not at all",              color: "#4ECDC4" },
    { value: 1, label: "Several days",            color: "#6C63FF" },
    { value: 2, label: "More than half the days", color: "#FFB347" },
    { value: 3, label: "Nearly every day",        color: "#FF6B6B" },
  ],
  GAD7: [
    { value: 0, label: "Not at all sure",      color: "#4ECDC4" },
    { value: 1, label: "Several days",         color: "#6C63FF" },
    { value: 2, label: "Over half the days",   color: "#FFB347" },
    { value: 3, label: "Nearly every day",     color: "#FF6B6B" },
  ],
};

export default function AssessmentScreen({ navigation }) {
  const [messages, setMessages] = useState([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [result,      setResult]      = useState(null);
  const [isTyping,    setIsTyping]    = useState(false);
  const [started,     setStarted]     = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  // true from the moment an answer is tapped until the next question has
  // actually appeared — keeps a fast double-tap from registering twice.
  const [locked,      setLocked]      = useState(false);
  // after the last question, before submitting — asks which counselor the
  // student wants if a session ends up being scheduled.
  const [awaitingCounselor, setAwaitingCounselor] = useState(false);
  const [pendingAnswers,    setPendingAnswers]    = useState(null);

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
    simulateTyping(() => {
      addBotMessage("Over the last 2 weeks, how often have you been bothered by the following problems? (PHQ-9)");
      simulateTyping(() => addBotMessage(QUESTIONS[0].text));
    });
  };

  const handleAnswer = (value, label) => {
    if (locked) return; // a question transition is already in progress
    setLocked(true);
    addUserMessage(label);
    const updated = [...answers, value];
    setAnswers(updated);

    if (current < QUESTIONS.length - 1) {
      const next = current + 1;
      setCurrent(next);
      if (next === PHQ9_QUESTIONS.length) {
        // Entering the GAD-7 section
        simulateTyping(() => {
          addBotMessage("Now, over the last 2 weeks, how often have you been bothered by the following problems? (GAD-7)");
          simulateTyping(() => {
            addBotMessage(QUESTIONS[next].text);
            setLocked(false);
          });
        });
      } else {
        simulateTyping(() => {
          addBotMessage(QUESTIONS[next].text);
          setLocked(false);
        });
      }
    } else {
      setPendingAnswers(updated);
      simulateTyping(() => {
        addBotMessage("Last thing — if a session ends up getting scheduled, who would you like to see?");
        setAwaitingCounselor(true);
        setLocked(false);
      });
    }
  };

  const handleCounselorChoice = (choice, label) => {
    if (locked) return;
    setLocked(true);
    addUserMessage(label);
    setAwaitingCounselor(false);
    submitAssessment(pendingAnswers, choice);
  };

  const submitAssessment = async (finalAnswers, counselorChoice) => {
    if (submitting) return; // prevent double submission
    setSubmitting(true);
    try {
      const phq9Answers = finalAnswers.slice(0, PHQ9_QUESTIONS.length);
      const gad7Answers = finalAnswers.slice(PHQ9_QUESTIONS.length);
      const res = await API.post("/assessment", { phq9Answers, gad7Answers, counselorChoice });
      setResult(res.data);

      simulateTyping(() => {
        addBotMessage(`PHQ-9 score: ${res.data.phq9Score}/27`);
        addBotMessage(`GAD-7 score: ${res.data.gad7Score}/21`);
        addBotMessage("ℹ️ This is a screening result, not a clinical diagnosis. Only a licensed mental health professional can diagnose a mental health condition — think of this as a starting point for a conversation, not a label.");
        if (res.data.severity === "HIGH") {
          addBotMessage("⚠️ We recommend immediate counseling.");
        }
        if (res.data.appointment) {
          const dateStr = res.data.appointment.scheduleDate
            ? new Date(res.data.appointment.scheduleDate).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })
            : null;
          const withName = res.data.appointment.counselorName ? ` with ${res.data.appointment.counselorName}` : "";
          addBotMessage(
            dateStr
              ? `📅 An appointment has been scheduled for you${withName} on ${dateStr}.`
              : `📅 An appointment has been scheduled for you${withName}.`
          );
        }
        if (res.data.severity === "MEDIUM" && !res.data.appointment) {
          addBotMessage("💬 You may consider talking to a counselor.");
        }
      });
    } catch (err) {
      console.log(err);
    } finally {
      setSubmitting(false);
    }
  };

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
          <ScrollView
            style={{ flex: 1, backgroundColor: "#FAFBFF" }}
            contentContainerStyle={styles.welcome}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.welcomeIcon}>🧠</Text>
            <Text style={styles.welcomeTitle}>Mental Health Check-in</Text>
            <Text style={styles.welcomeText}>
              This check-in uses two validated clinical screening tools — PHQ-9 for depression
              and GAD-7 for anxiety — to help you and your counselor understand how you've been feeling.
            </Text>

            <View style={styles.infoCard}>
              <Text style={styles.infoCardTitle}>💡 Why this matters</Text>
              <Text style={styles.infoCardText}>
                Stress, anxiety, and low mood can build up gradually, and it's easy to not notice
                how much they're affecting you. This screening helps catch these signs early,
                so the Guidance Office can offer support before things become harder to manage.
              </Text>
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.infoCardTitle}>🩺 Why PHQ-9 and GAD-7?</Text>
              <Text style={styles.infoCardText}>
                PHQ-9 and GAD-7 are internationally recognized questionnaires used by healthcare
                providers worldwide to screen for symptoms of depression and anxiety. They're quick,
                evidence-based, and among the most trusted tools for early detection.
              </Text>
            </View>

            <View style={styles.pillRow}>
              {["🕐 ~5 min", "🔒 Private", "💙 16 Qs"].map((p) => (
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

            <Text style={styles.disclaimerText}>
              This is a screening tool, not a diagnostic one. Your results do not mean you are
              being diagnosed with any condition — only a licensed mental health professional
              can provide a diagnosis.
            </Text>
          </ScrollView>
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
              awaitingCounselor ? (
                <View style={styles.optionsBar}>
                  <Text style={styles.optHint}>Choose a counselor:</Text>
                  <View style={styles.optGrid}>
                    {[
                      { value: "Ryan Mueden",   label: "Ryan Mueden",         color: "#6C63FF" },
                      { value: "Rejoice Pante", label: "Rejoice Pante",       color: "#4ECDC4" },
                      { value: "Any",           label: "Any / No preference", color: "#FFB347" },
                    ].map((opt) => (
                      <TouchableOpacity
                        key={opt.value}
                        onPress={() => handleCounselorChoice(opt.value, opt.label)}
                        disabled={locked}
                        style={[styles.optBtn, { borderColor: opt.color, opacity: locked ? 0.4 : 1 }]}
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
                <View style={styles.optionsBar}>
                  <Text style={styles.optHint}>Choose your answer:</Text>
                  <View style={styles.optGrid}>
                    {OPTIONS_BY_SECTION[QUESTIONS[current].section].map((opt) => (
                      <TouchableOpacity
                        key={opt.value}
                        onPress={() => handleAnswer(opt.value, opt.label)}
                        disabled={locked}
                        style={[styles.optBtn, { borderColor: opt.color, opacity: locked ? 0.4 : 1 }]}
                        activeOpacity={0.75}
                      >
                        <Text style={[styles.optBtnText, { color: opt.color }]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )
            ) : (
              <View style={styles.resultBar}>
                <TouchableOpacity
                  onPress={() => navigation.replace("Dashboard", { step: "pick" })}
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
    paddingTop: 8 + ANDROID_STATUS_BAR_PAD,
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
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
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
    marginBottom: 20,
  },
  infoCard: {
    width: "100%",
    backgroundColor: "#EEF2FF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  infoCardTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1A1A2E",
    marginBottom: 6,
  },
  infoCardText: {
    fontSize: 13,
    color: "#5B6178",
    lineHeight: 19,
  },
  disclaimerText: {
    fontSize: 11,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 16,
    marginTop: 16,
    paddingHorizontal: 8,
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
