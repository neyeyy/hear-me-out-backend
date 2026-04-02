import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";

function CounselorDashboard() {
  const [students, setStudents] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [appointments, setAppointments] = useState({});

  const navigate = useNavigate();

  useEffect(() => {
    fetchStudents();
    fetchAppointments();
  }, []);

  // 🔥 FETCH STUDENTS
  const fetchStudents = async () => {
    try {
      const res = await API.get("/users/students");

      const sorted = res.data.students.sort((a, b) => {
        const priority = { HIGH: 1, MEDIUM: 2, LOW: 3 };
        return (priority[a.severity] || 4) - (priority[b.severity] || 4);
      });

      setStudents(sorted);
      setFiltered(sorted);

    } catch (err) {
      console.log(err);
    }
  };

  // 🔥 FETCH APPOINTMENTS
  const fetchAppointments = async () => {
    try {
      const res = await API.get("/appointments");

      const map = {};

      res.data.appointments.forEach(app => {
        const studentId =
          typeof app.studentId === "object"
            ? app.studentId._id
            : app.studentId;

        map[studentId] = app;
      });

      setAppointments(map);

    } catch (err) {
      console.log(err);
    }
  };

  // 🔥 COMPLETE APPOINTMENT (FIXED)
  const handleComplete = async (appointmentId) => {
    try {
      if (!window.confirm("Mark this session as completed?")) return;

      await API.patch(`/appointments/${appointmentId}`, {
        status: "DONE" // ✅ FIXED
      });

      alert("✅ Session marked as completed");

      fetchAppointments();

    } catch (err) {
      console.error("❌ ERROR:", err.response?.data || err.message);
    }
  };

  // 🔍 SEARCH
  useEffect(() => {
    const result = students.filter((s) =>
      s.name.toLowerCase().includes(search.toLowerCase())
    );
    setFiltered(result);
  }, [search, students]);

  const openChat = (studentId) => {
    localStorage.setItem("chatStudentId", studentId);
    navigate("/chat");
  };

  // 🔥 COUNTS
  const total = students.length;
  const high = students.filter(s => s.severity === "HIGH").length;
  const medium = students.filter(s => s.severity === "MEDIUM").length;
  const low = students.filter(s => s.severity === "LOW").length;

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "Arial" }}>

      {/* SIDEBAR */}
      <div style={{
        width: "250px",
        background: "#1e293b",
        color: "white",
        padding: "20px"
      }}>
        <h2>Hear Me Out</h2>
        <p>👨‍🏫 Counselor Panel</p>

        <hr style={{ margin: "20px 0" }} />

        <p>📊 Dashboard</p>
        <p>👥 Students</p>
        <p>💬 Chat</p>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, padding: "20px", overflowY: "auto" }}>

        <h2>📊 Overview</h2>

        <div style={{
          display: "flex",
          gap: "20px",
          marginTop: "20px",
          flexWrap: "wrap"
        }}>
          <Card title="Total Students" value={total} />
          <Card title="High Risk 🚨" value={high} color="#ff4d4f" />
          <Card title="Medium" value={medium} color="#faad14" />
          <Card title="Low" value={low} color="#52c41a" />
        </div>

        {/* HIGH RISK */}
        <div style={{ marginTop: "40px" }}>
          <h3 style={{ color: "red" }}>🚨 High Risk Students</h3>

          {students.filter(s => s.severity === "HIGH").length === 0 ? (
            <p>No high-risk students</p>
          ) : (
            students
              .filter(s => s.severity === "HIGH")
              .map((s) => (
                <div key={s._id} style={{
                  padding: "10px",
                  background: "#ffe5e5",
                  marginBottom: "8px",
                  borderRadius: "5px"
                }}>
                  {s.name} needs immediate attention
                </div>
              ))
          )}
        </div>

        {/* SEARCH */}
        <div style={{ marginTop: "40px" }}>
          <input
            placeholder="Search student..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: "10px",
              width: "300px",
              borderRadius: "5px",
              border: "1px solid #ccc"
            }}
          />
        </div>

        {/* TABLE */}
        <h2 style={{ marginTop: "20px" }}>👥 Student List</h2>

        {filtered.length === 0 ? (
          <p>No students found</p>
        ) : (
          <table style={{
            width: "100%",
            borderCollapse: "collapse",
            marginTop: "20px"
          }}>
            <thead>
              <tr style={{ background: "#f4f4f4" }}>
                <th style={cell}>Name</th>
                <th style={cell}>Email</th>
                <th style={cell}>Severity</th>
                <th style={cell}>Status</th>
                <th style={cell}>Action</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((student) => {
                const appointment = appointments[student._id];

                return (
                  <tr key={student._id}>
                    <td style={cell}>{student.name}</td>
                    <td style={cell}>{student.email}</td>

                    <td style={{
                      ...cell,
                      color:
                        student.severity === "HIGH" ? "red" :
                        student.severity === "MEDIUM" ? "orange" :
                        "green"
                    }}>
                      {student.severity || "N/A"}
                    </td>

                    <td style={cell}>
                      {appointment ? (
                        appointment.status === "DONE" ? (
                          <span style={{ color: "green" }}>✅ Completed</span>
                        ) : (
                          <span style={{ color: "orange" }}>{appointment.status}</span>
                        )
                      ) : (
                        "No Appointment"
                      )}
                    </td>

                    <td style={cell}>
                      <button
                        onClick={() => openChat(student._id)}
                        style={btn}
                      >
                        Chat 💬
                      </button>

                      {appointment && appointment.status !== "DONE" && (
                        <button
                          onClick={() => handleComplete(appointment._id)}
                          style={{ ...btn, background: "green", marginLeft: "5px" }}
                        >
                          Complete
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

      </div>
    </div>
  );
}

// CARD
function Card({ title, value, color }) {
  return (
    <div style={{
      padding: "20px",
      background: "#fff",
      borderRadius: "10px",
      boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
      minWidth: "180px",
      textAlign: "center",
      borderTop: `5px solid ${color || "#2196F3"}`
    }}>
      <h4>{title}</h4>
      <h2>{value}</h2>
    </div>
  );
}

// STYLES
const cell = {
  border: "1px solid #ddd",
  padding: "10px",
  textAlign: "center"
};

const btn = {
  padding: "6px 12px",
  background: "#2196F3",
  color: "white",
  border: "none",
  borderRadius: "5px",
  cursor: "pointer"
};

export default CounselorDashboard;