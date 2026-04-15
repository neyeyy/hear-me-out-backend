import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ⚠️ Change this to your machine's local IP when testing on a real device
// e.g. "http://192.168.1.10:5000/api"
const BASE_URL = "http://10.0.2.2:5000/api"; // Android emulator → localhost

const API = axios.create({ baseURL: BASE_URL });

// Auto-attach JWT token to every request
API.interceptors.request.use(async (config) => {
  try {
    const token = await AsyncStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (e) {
    // ignore
  }
  return config;
});

export default API;
