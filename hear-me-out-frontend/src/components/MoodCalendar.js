import { useEffect, useState, useCallback } from "react";
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
  "July","August","September","October","November","December"
];

function MoodCalendar() {
  const today = new Date();
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed
  const [allMoods,  setAllMoods]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [hovered,   setHovered]   = useState(null);

  useEffect(() => {
    API.get("/moods")
      .then(res => {
        const list = Array.isArray(res.data) ? res.data : (res.data.moods || []);
        setAllMoods(list);
      })
      .catch(err => console.log("FETCH ERROR:", err))
      .finally(() => setLoading(false));
  }, []);

  // Build day→mood map for the currently viewed month
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
    const isCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth();
    if (isCurrentMonth) return; // can't go into future
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const isCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth();
  const daysInMonth    = new Date(viewYear, viewMonth + 1, 0).getDate();
  // Mon-first offset: JS getDay() → 0=Sun. Mon-first: (getDay()+6)%7
  const firstDayOffset = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7;
  const days           = moodMap();
  const trackedCount   = Object.keys(days).length;

  if (loading) {
    return (
      <div style={s.loading}>
        <div className="animate-spin" style={s.spinner} />
        <span style={s.loadingText}>Loading mood history…</span>
      </div>
    );
  }

  return (
    <div style={s.container}>
      {/* Header row */}
      <div style={s.header}>
        <h3 style={s.title}>Mood Calendar</h3>
        <span style={s.count}>{trackedCount} day{trackedCount !== 1 ? "s" : ""} tracked</span>
      </div>

      {/* Month navigation */}
      <div style={s.monthNav}>
        <button onClick={goToPrev} style={s.navArrow}>‹</button>
        <span style={s.monthLabel}>
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button
          onClick={goToNext}
          style={{ ...s.navArrow, opacity: isCurrentMonth ? 0.25 : 1, cursor: isCurrentMonth ? "default" : "pointer" }}
          disabled={isCurrentMonth}
        >›</button>
      </div>

      {/* Day-of-week labels */}
      <div style={s.dayLabels}>
        {DAY_LABELS.map(d => (
          <div key={d} style={s.dayLabel}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={s.grid}>
        {/* Blank cells before the 1st */}
        {[...Array(firstDayOffset)].map((_, i) => (
          <div key={`blank-${i}`} style={s.blankCell} />
        ))}

        {/* Day cells */}
        {[...Array(daysInMonth)].map((_, i) => {
          const day  = i + 1;
          const mood = days[day];
          const m    = mood ? MOODS[mood] : null;
          const isToday = isCurrentMonth && day === today.getDate();
          const isHov   = hovered === day;

          return (
            <div
              key={day}
              onMouseEnter={() => setHovered(day)}
              onMouseLeave={() => setHovered(null)}
              title={mood ? `${MONTH_NAMES[viewMonth]} ${day}: ${mood}` : `${MONTH_NAMES[viewMonth]} ${day}`}
              style={{
                ...s.cell,
                background: m ? m.color
                  : isToday ? "rgba(91,107,216,0.35)"
                  : "rgba(255,255,255,0.06)",
                transform:  isHov ? "scale(1.18)" : "scale(1)",
                boxShadow:  isHov && m ? `0 4px 14px ${m.color}70`
                  : isHov ? "0 3px 10px rgba(0,0,0,0.15)" : "none",
                outline: isToday && !m ? "2px solid rgba(91,107,216,0.7)" : "none",
                zIndex: isHov ? 2 : 1,
              }}
            >
              {m ? (
                <span style={s.emoji}>{m.emoji}</span>
              ) : (
                <span style={{ ...s.dayNum, color: isToday ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.28)" }}>
                  {day}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={s.legend}>
        {Object.entries(MOODS).map(([key, val]) => (
          <div key={key} style={s.legendItem}>
            <div style={{ ...s.legendDot, background: val.color }} />
            <span style={s.legendLabel}>{val.emoji} {key}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const s = {
  container: {
    background: "rgba(255,255,255,0.04)",
    borderRadius: "16px",
    padding: "18px",
    border: "1px solid rgba(255,255,255,0.1)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "14px",
  },
  title: {
    fontSize: "14px",
    fontWeight: "700",
    color: "rgba(255,255,255,0.88)",
    letterSpacing: "-0.1px",
    fontFamily: "'Poppins',sans-serif",
    margin: 0,
  },
  count: {
    fontSize: "11px",
    fontWeight: "600",
    color: "#b4bcf5",
    background: "rgba(91,107,216,0.25)",
    padding: "4px 10px",
    borderRadius: "99px",
    border: "1px solid rgba(91,107,216,0.4)",
    fontFamily: "'Poppins',sans-serif",
  },
  monthNav: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "12px",
    padding: "0 2px",
  },
  navArrow: {
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "rgba(255,255,255,0.75)",
    borderRadius: "8px",
    width: "32px",
    height: "32px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    fontSize: "20px",
    fontWeight: "600",
    lineHeight: 1,
    transition: "background 0.15s",
  },
  monthLabel: {
    fontSize: "14px",
    fontWeight: "700",
    color: "rgba(255,255,255,0.85)",
    fontFamily: "'Poppins',sans-serif",
    letterSpacing: "0.01em",
  },
  dayLabels: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: "4px",
    marginBottom: "4px",
  },
  dayLabel: {
    textAlign: "center",
    fontSize: "10px",
    fontWeight: "700",
    color: "rgba(255,255,255,0.3)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    fontFamily: "'Poppins',sans-serif",
    padding: "4px 0",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: "5px",
    marginBottom: "16px",
  },
  blankCell: {
    aspectRatio: "1",
  },
  cell: {
    aspectRatio: "1",
    borderRadius: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "default",
    transition: "transform 0.15s ease, box-shadow 0.15s ease",
    position: "relative",
  },
  emoji: {
    fontSize: "15px",
    lineHeight: 1,
  },
  dayNum: {
    fontSize: "11px",
    fontWeight: "600",
  },
  legend: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    justifyContent: "center",
    paddingTop: "12px",
    borderTop: "1px solid rgba(255,255,255,0.08)",
  },
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: "5px",
  },
  legendDot: {
    width: "9px",
    height: "9px",
    borderRadius: "50%",
    flexShrink: 0,
  },
  legendLabel: {
    fontSize: "11px",
    color: "rgba(255,255,255,0.48)",
    fontWeight: "500",
    fontFamily: "'Lato',sans-serif",
  },
  loading: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    padding: "24px",
  },
  spinner: {
    width: "20px",
    height: "20px",
    border: "2.5px solid rgba(255,255,255,0.15)",
    borderTopColor: "#5B6BD8",
    borderRadius: "50%",
    display: "inline-block",
  },
  loadingText: {
    fontSize: "14px",
    fontWeight: "500",
    color: "rgba(255,255,255,0.45)",
    fontFamily: "'Lato',sans-serif",
  },
};

export default MoodCalendar;
