import { useEffect, useState, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import API from "../services/api";

const MOODS = {
  HAPPY:    { color: "#4ECDC4", emoji: "😊" },
  SAD:      { color: "#7C6FCD", emoji: "😢" },
  STRESSED: { color: "#F9A72B", emoji: "😫" },
  ANXIOUS:  { color: "#F87171", emoji: "😰" },
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

export default function MoodCalendar() {
  const today = new Date();
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed
  const [allMoods,  setAllMoods]  = useState([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    API.get("/moods")
      .then(res => {
        const list = Array.isArray(res.data) ? res.data : (res.data.moods || []);
        setAllMoods(list);
      })
      .catch(err => console.log("Mood fetch error:", err))
      .finally(() => setLoading(false));
  }, []);

  const moodMap = useCallback(() => {
    const map = {};
    allMoods.forEach(item => {
      const d = new Date(item.createdAt);
      if (d.getFullYear() === viewYear && d.getMonth() === viewMonth) {
        map[d.getDate()] = item.mood;
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
  // Monday-first offset: JS getDay() 0=Sun → (day+6)%7 gives Mon=0
  const firstDayOffset = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7;
  const days           = moodMap();
  const trackedCount   = Object.keys(days).length;

  if (loading) {
    return (
      <View style={s.loading}>
        <ActivityIndicator color="#6C63FF" size="small" />
        <Text style={s.loadingText}>Loading mood history…</Text>
      </View>
    );
  }

  // Build flat cell array: blank offsets then actual days
  const totalCells = firstDayOffset + daysInMonth;
  const cells = Array.from({ length: totalCells }, (_, i) =>
    i < firstDayOffset ? { blank: true, key: `b${i}` } : { blank: false, key: `d${i}`, day: i - firstDayOffset + 1 }
  );

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
          const mood    = days[day];
          const m       = mood ? MOODS[mood] : null;
          const isToday = isCurrentMonth && day === today.getDate();
          const bg      = m ? m.color
            : isToday ? "rgba(91,107,216,0.35)"
            : "rgba(255,255,255,0.06)";

          return (
            <View key={cell.key} style={s.cellOuter}>
              <View style={[
                s.cellInner,
                { backgroundColor: bg },
                isToday && !m && s.todayOutline,
              ]}>
                {m ? (
                  <Text style={s.cellEmoji}>{m.emoji}</Text>
                ) : (
                  <Text style={[s.cellDay, {
                    color: isToday ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.28)",
                  }]}>
                    {day}
                  </Text>
                )}
              </View>
            </View>
          );
        })}
      </View>

      {/* Legend */}
      <View style={s.legend}>
        {Object.entries(MOODS).map(([key, val]) => (
          <View key={key} style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: val.color }]} />
            <Text style={s.legendLabel}>{val.emoji} {key}</Text>
          </View>
        ))}
      </View>
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

  dayLabels: {
    flexDirection: "row",
    marginBottom: 4,
  },
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
  },
  todayOutline: {
    borderWidth: 1.5,
    borderColor: "rgba(91,107,216,0.7)",
  },
  cellEmoji: { fontSize: 14, lineHeight: 18 },
  cellDay: { fontSize: 10, fontWeight: "600" },

  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  legendDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  legendLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.48)",
    fontWeight: "500",
  },
});
