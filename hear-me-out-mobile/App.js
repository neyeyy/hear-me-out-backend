import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";

import LoginScreen          from "./screens/LoginScreen";
import RegisterScreen       from "./screens/RegisterScreen";
import AssessmentScreen     from "./screens/AssessmentScreen";
import StudentDashboardScreen from "./screens/StudentDashboardScreen";
import CalendarScreen       from "./screens/CalendarScreen";
import ChatScreen           from "./screens/ChatScreen";

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{ headerShown: false, animation: "fade_from_bottom" }}
      >
        <Stack.Screen name="Login"      component={LoginScreen} />
        <Stack.Screen name="Register"   component={RegisterScreen} />
        <Stack.Screen name="Assessment" component={AssessmentScreen} />
        <Stack.Screen name="Dashboard"  component={StudentDashboardScreen} />
        <Stack.Screen name="Calendar"   component={CalendarScreen} />
        <Stack.Screen name="Chat"       component={ChatScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
