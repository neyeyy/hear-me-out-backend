import { useEffect, useState, useCallback } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Modal, ScrollView, Platform,
} from "react-native";
import API from "../services/api";

const MOODS = {
  HAPPY:    { color: "#4ECDC4", emoji: "😊", label: "Happy" },
  SAD:      { color: "#7C6FCD", emoji: "😢", label: "Sad" },
  STRESSED: { color: "#F9A72B", emoji: "😫", label: "Stressed" },
  ANXIOUS:  { color: "#F87171", emoji: "😰", label: "Anxious" },
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

function formatFullDate(year, month, day) {
  return new Date(year, month, day).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

export default function MoodCalendar() {
  const today = new Date();
  const [viewYear,     setViewYear]     = useState(today.getFullYear());
  const [viewMonth,    setViewMonth]    = useState(today.getMonth());
  const [allMoods,     setAllMoods]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [selectedDay,  setSelectedDay]  = useState(null); // { day, entries[] }

  useEffect(() => {
    API.get("/moods")
      .then(res => {
        const list = Array.isArray(res.data) ? res.data : (res.data.moods || []);
        // Sort oldest first so latest mood wins on cell display
        setAllMoods([...list].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)));
      })
      .catch(err => console.log("Mood fetch error:", err))
      .finally(() => setLoading(false));
  }, []);

  // Build map: day → array of entries (oldest→newest)
  const moodMap = useCallback(() => {
    const map = {};
    allMoods.forEach(item => {
      const d = new Date(item.createdAt);
      if (d.getFullYear() === viewYear && d.getMonth() === viewMonth) {
        const day = d.getDate();
        if (!map[day]) map[day] = [];
        map[day].push(item);
      }
    });
    return map;
  }, [allMoods, viewYear, viewMonth]);

  const goToPrev = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };

  const goToNext = () => {
    if (isCurrentMonth) return;
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const isCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth();
  const daysInMonth    = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOffset = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7;
  const days           = moodMap();
  const trackedCount   = Object.keys(days).length;

  const totalCells = firstDayOffset + daysInMonth;
  const cells = Array.from({ length: totalCells }, (_, i) =>
    i < firstDayOffset
      ? { blank: true, key: `b${i}` }
      : { blank: false, key: `d${i}`, day: i - firstDayOffset + 1 }
  );

  if (loading) {
    return (
      <View style={s.loading}>
        <ActivityIndicator color="#6C63FF" size="small" />
        <Text style={s.loadingText}>Loading mood history…</Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Mood Calendar</Text>
        <View style={s.countBadge}>
          <Text style={s.countText}>
            {trackedCount} day{trackedCount !== 1 ? "s" : ""} tracked
          </Text>
        </View>
      </View>

      {/* Month navigation */}
      <View style={s.monthNav}>
        <TouchableOpacity onPress={goToPrev} style={s.navArrow} activeOpacity={0.7}>
          <Text style={s.navArrowText}>‹</Text>
        </TouchableOpacity>
        <Text style={s.monthLabel}>{MONTH_NAMES[viewMonth]} {viewYear}</Text>
        <TouchableOpacity
          onPress={goToNext}
          style={[s.navArrow, isCurrentMonth && { opacity: 0.25 }]}
          disabled={isCurrentMonth}
          activeOpacity={0.7}
        >
          <Text style={s.navArrowText}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Day-of-week labels */}
      <View style={s.dayLabels}>
        {DAY_LABELS.map(d => (
          <Text key={d} style={s.dayLabel}>{d}</Text>
        ))}
      </View>

      {/* Calendar grid */}
      <View style={s.grid}>
        {cells.map(cell => {
          if (cell.blank) return <View key={cell.key} style={s.cellOuter} />;
          const { day } = cell;
          const entries = days[day] || [];
          // Show the most recent mood of the day on the cell
          const latestMood = entries.length > 0 ? entries[entries.length - 1].mood : null;
          const m       = latestMood ? MOODS[latestMood] : null;
          const isToday = isCurrentMonth && day === today.getDate();
          const bg      = m ? m.color
            : isToday ? "rgba(91,107,216,0.35)"
            : "rgba(255,255,255,0.06)";

          return (
            <View key={cell.key} style={s.cellOuter}>
              <TouchableOpacity
                activeOpacity={entries.length > 0 ? 0.7 : 1}
                onPress={() => entries.length > 0 && setSelectedDay({ day, entries })}
                style={[
                  s.cellInner,
                  { backgroundColor: bg },
                  isToday && !m && s.todayOutline,
                ]}
              >
                {entries.length > 1 && (
                  <View style={s.multiDot} />
                )}
                {m ? (
                  <Text style={s.cellEmoji}>{m.emoji}</Text>
                ) : (
                  <Text style={[s.cellDay, {
                    color: isToday ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.28)",
                  }]}>
                    {day}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          );
        })}
      </View>

      {/* Legend */}
      <View style={s.legend}>
        {Object.entries(MOODS).map(([key, val]) => (
          <View key={key} style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: val.color }]} />
            <Text style={s.legendLabel}>{val.emoji} {val.label}</Text>
          </View>
        ))}
      </View>

      {/* Day detail bottom sheet */}
      <Modal
        visible={!!selectedDay}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedDay(null)}
      >
        <TouchableOpacity
          style={s.modalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedDay(null)}
        />
        <View style={s.sheet}>
          <View style={s.sheetHandle} />

          {selectedDay && (
            <>
              <Text style={s.sheetDate}>
                {formatFullDate(viewYear, viewMonth, selectedDay.day)}
              </Text>
              <Text style={s.sheetSub}>
                {selectedDay.entries.length} mood{selectedDay.entries.length !== 1 ? "s" : ""} logged
              </Text>

              <ScrollView
                style={{ maxHeight: 340 }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 8 }}
              >
                {/* Show newest first */}
                {[...selectedDay.entries].reverse().map((entry, i) => {
                  const meta = MOODS[entry.mood] || { color: "#888", emoji: "❓", label: entry.mood };
                  return (
                    <View key={entry._id || i} style={s.entryCard}>
                      <View style={[s.entryAccent, { backgroundColor: meta.color }]} />
                      <View style={s.entryBody}>
                        <View style={s.entryTop}>
                          <Text style={s.entryEmoji}>{meta.emoji}</Text>
                          <Text style={[s.entryMood, { color: meta.color }]}>{meta.label}</Text>
                          <Text style={s.entryTime}>{formatTime(entry.createdAt)}</Text>
                        </View>
                        {entry.note ? (
                          <Text style={s.entryNote}>{entry.note}</Text>
                        ) : (
                          <Text style={s.entryNoNote}>No note added</Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  loading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 24,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  loadingText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.45)",
    fontWeight: "500",
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: "rgba(255,255,255,0.88)",
    letterSpacing: -0.1,
  },
  countBadge: {
    backgroundColor: "rgba(91,107,216,0.25)",
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(91,107,216,0.4)",
  },
  countText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#b4bcf5",
  },

  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  navArrow: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 8,
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  navArrowText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 20,
    fontWeight: "600",
    lineHeight: 24,
  },
  monthLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "rgba(255,255,255,0.85)",
    letterSpacing: 0.1,
  },

  dayLabels: { flexDirection: "row", marginBottom: 4 },
  dayLabel: {
    width: `${100 / 7}%`,
    textAlign: "center",
    fontSize: 9,
    fontWeight: "700",
    color: "rgba(255,255,255,0.3)",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    paddingVertical: 4,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 14,
  },
  cellOuter: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    padding: 2.5,
  },
  cellInner: {
    flex: 1,
    borderRadius: 7,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  todayOutline: {
    borderWidth: 1.5,
    borderColor: "rgba(91,107,216,0.7)",
  },
  cellEmoji: { fontSize: 14, lineHeight: 18 },
  cellDay: { fontSize: 10, fontWeight: "600" },
  // Small dot in top-right corner when a day has multiple mood entries
  multiDot: {
    position: "absolute",
    top: 3,
    right: 3,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.8)",
  },

  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.48)",
    fontWeight: "500",
  },

  /* ── Bottom sheet modal ── */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    backgroundColor: "#1E2037",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 34 : 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetDate: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 4,
  },
  sheetSub: {
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
    marginBottom: 16,
    fontWeight: "500",
  },

  entryCard: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 14,
    marginBottom: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  entryAccent: {
    width: 4,
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  entryBody: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  entryTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  entryEmoji: { fontSize: 18 },
  entryMood: {
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
  },
  entryTime: {
    fontSize: 11,
    color: "rgba(255,255,255,0.35)",
    fontWeight: "500",
  },
  entryNote: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    lineHeight: 19,
  },
  entryNoNote: {
    fontSize: 12,
    color: "rgba(255,255,255,0.25)",
    fontStyle: "italic",
  },
});
