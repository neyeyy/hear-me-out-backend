import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Assessment from "./pages/Assessment";
import StudentDashboard from "./pages/student/StudentDashboard";
import Chat from "./pages/Chat";
import CounselorDashboard from "./pages/CounselorDashboard"; // 🔥 NEW

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/assessment" element={<Assessment />} />
        <Route path="/student" element={<StudentDashboard />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/admin" element={<CounselorDashboard />} /> {/* 🔥 NEW */}
      </Routes>
    </Router>
  );
}

export default App;