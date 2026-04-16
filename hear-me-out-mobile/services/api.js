import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

// Automatically use whichever IP the Expo dev server is running on.
// This means the app works on any network — home, school, hotspot, etc.
const getBaseUrl = () => {
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(":").shift();
    if (host && host !== "localhost" && host !== "127.0.0.1") {
      return `http://${host}:5000/api`;
    }
  }
  // Fallback if hostUri is unavailable (e.g. production build)
  return "http://192.168.8.101:5000/api";
};

const BASE_URL = getBaseUrl();

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
