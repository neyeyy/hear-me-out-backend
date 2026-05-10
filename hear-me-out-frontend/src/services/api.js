import axios from "axios";

const API = axios.create({
  baseURL: "https://hear-me-out-backend-production.up.railway.app/api",
});

// 🔥 ATTACH TOKEN TO EVERY REQUEST
API.interceptors.request.use(
  (req) => {
    const token = localStorage.getItem("token");
    if (token) {
      req.headers.Authorization = `Bearer ${token}`;
    }
    console.log("REQUEST SENT:", req.url);
    return req;
  },
  (error) => Promise.reject(error)
);

// 🔥 HANDLE ERRORS
API.interceptors.response.use(
  (response) => response,
  (error) => {
    console.log("API ERROR:", error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export default API;