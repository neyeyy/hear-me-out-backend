import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register"; // ✅ MUST EXIST
import Assessment from "./pages/Assessment";
import StudentDashboard from "./pages/student/StudentDashboard";
import Chat from "./pages/Chat";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} /> {/* ✅ THIS LINE */}
        <Route path="/assessment" element={<Assessment />} />
        <Route path="/student" element={<StudentDashboard />} />
        <Route path="/chat" element={<Chat />} />
      </Routes>
    </Router>
  );
}

export default App;