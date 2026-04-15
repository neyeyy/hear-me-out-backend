import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import API from "../services/api";

const MOODS = {
  HAPPY:    { color: "#4ECDC4", emoji: "😊" },
  SAD:      { color: "#6C63FF", emoji: "😢" },
  STRESSED: { color: "#FFB347", emoji: "😫" },
  ANXIOUS:  { color: "#FF6B6B", emoji: "😰" },
};

export default function MoodCalendar() {
  const [days, setDays] = useState({});
  const [loading, setLoading] = useState(true);

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
      console.log("Mood fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#6C63FF" />
        <Text style={styles.loadingText}>Loading mood history…</Text>
      </View>
    );
  }

  const trackedCount = Object.keys(days).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mood History</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{trackedCount} days tracked</Text>
        </View>
      </View>

      {/* Day labels */}
      <View style={styles.dayLabels}>
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <Text key={i} style={styles.dayLabel}>{d}</Text>
        ))}
      </View>

      {/* Grid */}
      <View style={styles.grid}>
        {[...Array(30)].map((_, i) => {
          const day = i + 1;
          const mood = days[day];
          const m = mood ? MOODS[mood] : null;

          return (
            <View
              key={day}
              style={[
                styles.cell,
                { backgroundColor: m ? m.color : "#F3F4F6" },
              ]}
            >
              {m ? (
                <Text style={styles.cellEmoji}>{m.emoji}</Text>
              ) : (
                <Text style={styles.cellDay}>{day}</Text>
              )}
            </View>
          );
        })}
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        {Object.entries(MOODS).map(([key, val]) => (
          <View key={key} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: val.color }]} />
            <Text style={styles.legendText}>{val.emoji} {key}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FAFBFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1A1A2E",
  },
  countBadge: {
    backgroundColor: "#EEF2FF",
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  countText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6C63FF",
  },
  dayLabels: {
    flexDirection: "row",
    marginBottom: 4,
  },
  dayLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: 9,
    fontWeight: "700",
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: 14,
  },
  cell: {
    width: "12%",
    aspectRatio: 1,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    margin: "0.5%",
  },
  cellEmoji: { fontSize: 14 },
  cellDay: { fontSize: 9, fontWeight: "600", color: "#9CA3AF" },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10,
    color: "#6B7280",
    fontWeight: "500",
  },
  loading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 20,
  },
  loadingText: {
    fontSize: 13,
    color: "#6B7280",
  },
});
