import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import * as Updates from "expo-updates";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { identify } from "./services/socket";

import LoginScreen            from "./screens/LoginScreen";
import RegisterScreen         from "./screens/RegisterScreen";
import AssessmentScreen       from "./screens/AssessmentScreen";
import StudentDashboardScreen from "./screens/StudentDashboardScreen";
import CalendarScreen         from "./screens/CalendarScreen";
import ChatScreen             from "./screens/ChatScreen";
import ForgotPasswordScreen   from "./screens/ForgotPasswordScreen";

const Stack = createNativeStackNavigator();

export default function App() {
  // true until we've checked whether a logged-in session already exists —
  // closing/reopening the app (e.g. swiping it away) restarts this JS process,
  // and without this check it always landed back on Login even with a still-valid
  // session saved in AsyncStorage.
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession,      setHasSession]      = useState(false);

  // Actively check for and apply a newer OTA update on every launch, rather
  // than relying on the default silent "downloads now, applies next launch"
  // behavior — which is easy to mistake for updates not working at all.
  useEffect(() => {
    async function applyLatestUpdate() {
      if (__DEV__) {
        await AsyncStorage.setItem("lastUpdateCheck", JSON.stringify({ at: Date.now(), result: "skipped (dev mode)" }));
        return;
      }
      try {
        const { isAvailable } = await Updates.checkForUpdateAsync();
        if (isAvailable) {
          await AsyncStorage.setItem("lastUpdateCheck", JSON.stringify({ at: Date.now(), result: "found update, downloading…" }));
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync(); // app restarts here — nothing after this line runs
        } else {
          await AsyncStorage.setItem("lastUpdateCheck", JSON.stringify({ at: Date.now(), result: "already up to date" }));
        }
      } catch (e) {
        // No network, no update server reachable, etc. — continue with
        // whatever bundle is already installed, but record why so it's
        // visible on the Profile screen instead of failing invisibly.
        await AsyncStorage.setItem("lastUpdateCheck", JSON.stringify({ at: Date.now(), result: `error: ${e?.message || e}` }));
      }
    }
    applyLatestUpdate();
  }, []);

  useEffect(() => {
    async function restoreSession() {
      try {
        const [token, role, userId] = await Promise.all([
          AsyncStorage.getItem("token"),
          AsyncStorage.getItem("role"),
          AsyncStorage.getItem("userId"),
        ]);
        const valid = !!token && role === "student";
        setHasSession(valid);
        if (valid && userId) identify(userId, role);
      } catch (e) {
        // Storage unreadable — fall back to requiring login.
      } finally {
        setCheckingSession(false);
      }
    }
    restoreSession();
  }, []);

  if (checkingSession) {
    return (
      <View style={{ flex: 1, backgroundColor: "#1a1a2e", alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#6C63FF" size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Stack.Navigator
        initialRouteName={hasSession ? "Dashboard" : "Login"}
        screenOptions={{ headerShown: false, animation: "fade_from_bottom" }}
      >
        <Stack.Screen name="Login"      component={LoginScreen} />
        <Stack.Screen name="Register"   component={RegisterScreen} />
        <Stack.Screen name="Assessment" component={AssessmentScreen} />
        <Stack.Screen name="Dashboard"  component={StudentDashboardScreen} initialParams={{ step: "pick" }} />
        <Stack.Screen name="Calendar"   component={CalendarScreen} />
        <Stack.Screen name="Chat"           component={ChatScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
