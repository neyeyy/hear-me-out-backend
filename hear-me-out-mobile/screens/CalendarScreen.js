import { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, ActivityIndicator, StatusBar, Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import API from "../services/api";

const { width } = Dimensions.get("window");

const MOODS = {
  HAPPY:    { gradient: ["#4ECDC4", "#44A08D"], emoji: "😊", label: "Happy" },
  SAD:      { gradient: ["#6C63FF", "#9B59B6"], emoji: "😢", label: "Sad" },
  STRESSED: { gradient: ["#F7971E", "#FFD200"], emoji: "😫", label: "Stressed" },
  ANXIOUS:  { gradient: ["#FF6B6B", "#FF8E53"], emoji: "😰", label: "Anxious" },
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function CalendarScreen({ navigation }) {
  const [days, setDays] = useState({});
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    fetchMoods();
  }, []);

  const fetchMoods = async () => {
    try {
      const res = await API.get("/moods");
      const moodData = {};
      const list = Array.isArray(res.data) ? res.data : (res.data.moods || []);
      list.forEach((item) => {
        const day = new Date(item.createdAt).getDate();
        moodData[day] = item.mood;
      });
      setDays(moodData);
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  };

  const trackedCount = Object.keys(days).length;

  // Mood counts for summary
  const moodCounts = Object.values(days).reduce((acc, m) => {
    acc[m] = (acc[m] || 0) + 1;
    return acc;
  }, {});

  const dominantMood = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0];

  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={["#1a1a2e", "#16213e", "#0f3460"]} style={styles.page}>
        <View style={[styles.blob, { width: 260, height: 260, top: -60, right: -60 }]} />
        <View style={[styles.blob, { width: 180, height: 180, bottom: 120, left: -40, opacity: 0.06 }]} />

        <SafeAreaView style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                <Text style={styles.backText}>←</Text>
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={styles.headerTitle}>Mood History</Text>
                <Text style={styles.headerSub}>
                  {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                </Text>
              </View>
              <View style={styles.trackBadge}>
                <Text style={styles.trackBadgeText}>{trackedCount} days</Text>
              </View>
            </View>

            {/* Summary card */}
            {dominantMood && MOODS[dominantMood[0]] && (
              <LinearGradient
                colors={MOODS[dominantMood[0]].gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.summaryCard}
              >
                <View style={styles.summaryShine} />
                <View>
                  <Text style={styles.summaryLabel}>Most frequent mood</Text>
                  <Text style={styles.summaryMood}>
                    {MOODS[dominantMood[0]].emoji}  {MOODS[dominantMood[0]].label}
                  </Text>
                  <Text style={styles.summaryCount}>
                    {dominantMood[1]} time{dominantMood[1] !== 1 ? "s" : ""} this month
                  </Text>
                </View>
                <Text style={styles.summaryBigEmoji}>{MOODS[dominantMood[0]].emoji}</Text>
              </LinearGradient>
            )}

            {/* Mood breakdown */}
            {Object.keys(moodCounts).length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Breakdown</Text>
                <View style={styles.breakdownGrid}>
                  {Object.entries(MOODS).map(([key, val]) => {
                    const count = moodCounts[key] || 0;
                    const pct = trackedCount > 0 ? (count / trackedCount) * 100 : 0;
                    return (
                      <View key={key} style={styles.breakdownItem}>
                        <Text style={styles.breakdownEmoji}>{val.emoji}</Text>
                        <Text style={styles.breakdownLabel}>{val.label}</Text>
                        <View style={styles.barBg}>
                          <LinearGradient
                            colors={val.gradient}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={[styles.barFill, { width: `${pct}%` }]}
                          />
                        </View>
                        <Text style={styles.breakdownCount}>{count}x</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Calendar Grid */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Daily Calendar</Text>

              {/* Day labels */}
              <View style={styles.dayLabels}>
                {DAY_LABELS.map((d) => (
                  <Text key={d} style={styles.dayLabel}>{d}</Text>
                ))}
              </View>

              {loading ? (
                <View style={styles.loadingWrap}>
                  <ActivityIndicator color="#6C63FF" size="large" />
                </View>
              ) : (
                <View style={styles.grid}>
                  {[...Array(30)].map((_, i) => {
                    const day = i + 1;
                    const mood = days[day];
                    const m = mood ? MOODS[mood] : null;

                    return m ? (
                      <LinearGradient
                        key={day}
                        colors={m.gradient}
                        style={styles.cell}
                      >
                        <Text style={styles.cellEmoji}>{m.emoji}</Text>
                      </LinearGradient>
                    ) : (
                      <View key={day} style={[styles.cell, styles.emptyCell]}>
                        <Text style={styles.cellDay}>{day}</Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Legend */}
            <View style={styles.legend}>
              {Object.entries(MOODS).map(([key, val]) => (
                <View key={key} style={styles.legendItem}>
                  <LinearGradient
                    colors={val.gradient}
                    style={styles.legendDot}
                  />
                  <Text style={styles.legendText}>{val.emoji} {val.label}</Text>
                </View>
              ))}
            </View>

            {/* CTA */}
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              activeOpacity={0.85}
            >
              <LinearGradient colors={["#6C63FF", "#764ba2"]} style={styles.ctaBtn}>
                <Text style={styles.ctaBtnText}>+ Log Today's Mood</Text>
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}

const CELL_SIZE = (width - 44 - 6 * 7) / 7;

const styles = StyleSheet.create({
  page: {
    flex: 1,
    overflow: "hidden",
  },
  blob: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: "#6C63FF",
    opacity: 0.1,
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 48,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 24,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  backText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.4,
  },
  headerSub: {
    fontSize: 12,
    color: "rgba(255,255,255,0.45)",
    marginTop: 2,
  },
  trackBadge: {
    backgroundColor: "rgba(108,99,255,0.4)",
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(108,99,255,0.6)",
  },
  trackBadgeText: { color: "#a78bfa", fontSize: 12, fontWeight: "700" },

  summaryCard: {
    borderRadius: 22,
    padding: 22,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  summaryShine: {
    position: "absolute",
    top: -40,
    right: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  summaryLabel: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "600", marginBottom: 4 },
  summaryMood: { color: "#fff", fontSize: 20, fontWeight: "800", letterSpacing: -0.3, marginBottom: 4 },
  summaryCount: { color: "rgba(255,255,255,0.65)", fontSize: 12 },
  summaryBigEmoji: { fontSize: 48 },

  section: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 16,
    letterSpacing: -0.2,
  },

  breakdownGrid: {
    gap: 12,
  },
  breakdownItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  breakdownEmoji: { fontSize: 20, width: 28, textAlign: "center" },
  breakdownLabel: { color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: "600", width: 68 },
  barBg: {
    flex: 1,
    height: 8,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 99,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 99,
    minWidth: 6,
  },
  breakdownCount: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    fontWeight: "600",
    width: 28,
    textAlign: "right",
  },

  dayLabels: {
    flexDirection: "row",
    marginBottom: 8,
  },
  dayLabel: {
    width: CELL_SIZE + 6,
    textAlign: "center",
    fontSize: 10,
    fontWeight: "700",
    color: "rgba(255,255,255,0.35)",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  loadingWrap: {
    paddingVertical: 40,
    alignItems: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyCell: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  cellEmoji: { fontSize: CELL_SIZE * 0.45 },
  cellDay: {
    fontSize: 10,
    fontWeight: "600",
    color: "rgba(255,255,255,0.25)",
  },

  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "center",
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: { color: "rgba(255,255,255,0.65)", fontSize: 11, fontWeight: "600" },

  ctaBtn: {
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: "center",
    shadowColor: "#6C63FF",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  ctaBtnText: { color: "#fff", fontSize: 16, fontWeight: "800", letterSpacing: 0.2 },
});
