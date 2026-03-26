import { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";

const questions = [
  "I feel nervous or anxious",
  "I have trouble sleeping",
  "I feel overwhelmed",
  "I feel sad or hopeless",
  "I have difficulty concentrating"
];

function Assessment() {
  const [answers, setAnswers] = useState(Array(questions.length).fill(0));
  const [result, setResult] = useState(null);

  const navigate = useNavigate(); // ✅ required

  const handleChange = (index, value) => {
    const newAnswers = [...answers];
    newAnswers[index] = Number(value);
    setAnswers(newAnswers);
  };

  const submitAssessment = async () => {
    try {
      const res = await API.post("/assessment", { answers });
      setResult(res.data);
    } catch (err) {
      console.log(err);
      alert("Error submitting assessment");
    }
  };

  const goToDashboard = () => {
    navigate("/student"); // 👉 manual redirect
  };

  return (
    <div style={{
      maxWidth: "500px",
      margin: "auto",
      padding: "20px",
      fontFamily: "Arial"
    }}>
      <h2 style={{ textAlign: "center" }}>Mental Health Assessment</h2>

      {/* QUESTIONS */}
      {!result && questions.map((q, index) => (
        <div key={index} style={{ marginBottom: "15px" }}>
          <p>{q}</p>

          <select
            value={answers[index]}
            onChange={(e) => handleChange(index, e.target.value)}
            style={{ width: "100%", padding: "8px" }}
          >
            <option value={0}>0 - Not at all</option>
            <option value={1}>1 - Several days</option>
            <option value={2}>2 - More than half the days</option>
            <option value={3}>3 - Nearly every day</option>
          </select>
        </div>
      ))}

      {/* SUBMIT BUTTON */}
      {!result && (
        <button
          onClick={submitAssessment}
          style={{
            width: "100%",
            padding: "12px",
            background: "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "8px"
          }}
        >
          Submit Assessment
        </button>
      )}

      {/* RESULT */}
      {result && (
        <div style={{
          marginTop: "20px",
          padding: "15px",
          background: "#f0f4ff",
          borderRadius: "10px",
          textAlign: "center"
        }}>
          <h3>Result</h3>
          <p><strong>Score:</strong> {result.score}</p>
          <p><strong>Severity:</strong> {result.severity}</p>

          {/* ✅ OK BUTTON */}
          <button
            onClick={goToDashboard}
            style={{
              marginTop: "15px",
              padding: "10px 20px",
              background: "#2196F3",
              color: "white",
              border: "none",
              borderRadius: "8px"
            }}
          >
            OK
          </button>
        </div>
      )}
    </div>
  );
}

export default Assessment;