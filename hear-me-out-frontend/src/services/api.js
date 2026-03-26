import axios from "axios";

const API = axios.create({
  baseURL: "http://localhost:5000/api",
});

// 🔥 ATTACH TOKEN TO EVERY REQUEST
API.interceptors.request.use(
  (req) => {
    const token = localStorage.getItem("token");

    if (token) {
      req.headers.Authorization = `Bearer ${token}`;
    }

    console.log("REQUEST SENT:", req.url); // 👈 DEBUG
    return req;
  },
  (error) => Promise.reject(error)
);

// 🔥 HANDLE ERRORS (OPTIONAL BUT GOOD)
API.interceptors.response.use(
  (response) => response,
  (error) => {
    console.log("API ERROR:", error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export default API;