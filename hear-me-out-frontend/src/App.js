import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Login from "./pages/Login";
import Assessment from "./pages/Assessment";
import StudentDashboard from "./pages/student/StudentDashboard";
import Chat from "./pages/Chat";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/assessment" element={<Assessment />} />
        <Route path="/student" element={<StudentDashboard />} />
        <Route path="/chat" element={<Chat />} />
      </Routes>
    </Router>
  );
}

export default App;