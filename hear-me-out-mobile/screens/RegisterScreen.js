import { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Platform, ActivityIndicator, ScrollView, Modal,
  Keyboard, Dimensions,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import API from "../services/api";

const YEAR_LEVELS = ["Grade 11", "Grade 12", "1st Year", "2nd Year", "3rd Year", "4th Year"];
const SCREEN_HEIGHT = Dimensions.get("window").height;

export default function RegisterScreen({ navigation }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [studentId, setStudentId] = useState("");
  const [yearLevel, setYearLevel] = useState("");
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [error, setError] = useState("");
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Small card at rest; while the keyboard is open the card grows to fill
  // the screen so scrolling reveals more of it smoothly, instead of a
  // fixed-size box with the background peeking around it mid-scroll.
  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const onShow = Keyboard.addListener(showEvt, () => setKeyboardVisible(true));
    const onHide = Keyboard.addListener(hideEvt, () => setKeyboardVisible(false));
    return () => { onShow.remove(); onHide.remove(); };
  }, []);

  const handleRegister = async () => {
    if (!name || !email || !password || !studentId) { setError("Please fill in all fields."); return; }
    setError("");
    try {
      setLoading(true);
      const res = await API.post("/auth/register", { name, email, password, yearLevel, studentId });
      if (res.data.success) {
        navigation.navigate("Login");
      } else {
        setError(res.data.message || "Registration failed.");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={["#4ECDC4", "#44A08D", "#6C63FF"]} style={styles.container}>
      <View style={styles.blob1} />
      <View style={styles.blob2} />

      <KeyboardAwareScrollView
        style={styles.kav}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
        extraScrollHeight={24}
        keyboardOpeningTime={0}
      >
          <View style={[styles.card, keyboardVisible && styles.cardExpanded]}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.logo}>🌱</Text>
              <Text style={styles.title}>Create Account</Text>
              <Text style={styles.subtitle}>Start your wellness journey today</Text>
            </View>

            {/* Name */}
            <View style={styles.group}>
              <Text style={styles.label}>FULL NAME</Text>
              <View style={[styles.inputRow, focusedField === "name" && styles.inputRowFocused]}>
                <Ionicons name="person-outline" size={18} color="#44A08D" style={styles.fieldIconVec} />
                <TextInput
                  placeholder="Your full name"
                  placeholderTextColor="#9CA3AF"
                  value={name}
                  onChangeText={setName}
                  onFocus={() => setFocusedField("name")}
                  onBlur={() => setFocusedField(null)}
                  style={styles.input}
                />
              </View>
            </View>

            {/* Email */}
            <View style={styles.group}>
              <Text style={styles.label}>EMAIL ADDRESS</Text>
              <View style={[styles.inputRow, focusedField === "email" && styles.inputRowFocused]}>
                <Ionicons name="mail-outline" size={18} color="#44A08D" style={styles.fieldIconVec} />
                <TextInput
                  placeholder="you@university.edu"
                  placeholderTextColor="#9CA3AF"
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => setFocusedField("email")}
                  onBlur={() => setFocusedField(null)}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={styles.input}
                />
              </View>
            </View>

            {/* Student ID */}
            <View style={styles.group}>
              <Text style={styles.label}>STUDENT ID</Text>
              <View style={[styles.inputRow, focusedField === "studentId" && styles.inputRowFocused]}>
                <Ionicons name="card-outline" size={18} color="#44A08D" style={styles.fieldIconVec} />
                <TextInput
                  placeholder="e.g. 24-0001"
                  placeholderTextColor="#9CA3AF"
                  value={studentId}
                  onChangeText={setStudentId}
                  onFocus={() => setFocusedField("studentId")}
                  onBlur={() => setFocusedField(null)}
                  autoCapitalize="characters"
                  style={styles.input}
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.group}>
              <Text style={styles.label}>PASSWORD</Text>
              <View style={[styles.inputRow, focusedField === "password" && styles.inputRowFocused]}>
                <Ionicons name="lock-closed-outline" size={18} color="#44A08D" style={styles.fieldIconVec} />
                <TextInput
                  placeholder="••••••••"
                  placeholderTextColor="#9CA3AF"
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
                  secureTextEntry={!showPass}
                  style={[styles.input, { flex: 1 }]}
                />
                <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.eye}>
                  <Ionicons name={showPass ? "eye-off-outline" : "eye-outline"} size={18} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Year Level */}
            <View style={styles.group}>
              <Text style={styles.label}>YEAR LEVEL</Text>
              <TouchableOpacity
                onPress={() => setShowYearPicker(true)}
                style={[styles.inputRow, showYearPicker && styles.inputRowFocused]}
                activeOpacity={0.75}
              >
                <Ionicons name="school-outline" size={18} color="#44A08D" style={styles.fieldIconVec} />
                <Text style={[styles.input, !yearLevel && { color: "#9CA3AF" }]}>
                  {yearLevel || "Select year level"}
                </Text>
                <Text style={{ color: "#9CA3AF", fontSize: 12 }}>▾</Text>
              </TouchableOpacity>
            </View>

            {!!error && <Text style={{ color:"#F87171", fontSize:13, fontWeight:"600", textAlign:"center", marginBottom:8 }}>{error}</Text>}

            {/* Button */}
            <TouchableOpacity
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={["#4ECDC4", "#44A08D"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.btn, loading && { opacity: 0.75 }]}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnText}>Create Account →</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Footer */}
            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate("Login")}>
                <Text style={styles.link}>Sign in</Text>
              </TouchableOpacity>
            </View>
          </View>
      </KeyboardAwareScrollView>

      {/* Year Level picker */}
      <Modal
        visible={showYearPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowYearPicker(false)}
      >
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => setShowYearPicker(false)}
        >
          <View style={styles.pickerSheet}>
            <Text style={styles.pickerTitle}>Select Year Level</Text>
            {YEAR_LEVELS.map((yr) => (
              <TouchableOpacity
                key={yr}
                onPress={() => { setYearLevel(yr); setShowYearPicker(false); }}
                style={[styles.pickerOption, yearLevel === yr && styles.pickerOptionActive]}
              >
                <Text style={[styles.pickerOptionText, yearLevel === yr && styles.pickerOptionTextActive]}>
                  {yr}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  blob1: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(255,255,255,0.07)",
    top: -80,
    right: -80,
  },
  blob2: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(255,255,255,0.05)",
    bottom: -60,
    left: -50,
  },
  kav: {
    flex: 1,
    width: "100%",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.97)",
    borderRadius: 28,
    padding: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.22,
    shadowRadius: 32,
    elevation: 12,
  },
  cardExpanded: {
    minHeight: SCREEN_HEIGHT - 120,
    borderRadius: 20,
  },
  header: {
    alignItems: "center",
    marginBottom: 28,
  },
  logo: {
    fontSize: 48,
    marginBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1A1A2E",
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: "#6B7280",
  },
  group: {
    marginBottom: 16,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: "#374151",
    letterSpacing: 0.8,
    marginBottom: 7,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 14 : 2,
  },
  inputRowFocused: {
    borderColor: "#4ECDC4",
    backgroundColor: "#F0FDFB",
  },
  fieldIcon: {
    fontSize: 17,
    marginRight: 10,
  },
  fieldIconVec: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: "#1A1A2E",
    paddingVertical: Platform.OS === "android" ? 10 : 0,
  },
  eye: {
    padding: 4,
  },
  btn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 6,
    shadowColor: "#4ECDC4",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  btnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 24,
  },
  footerText: {
    fontSize: 14,
    color: "#6B7280",
  },
  link: {
    fontSize: 14,
    color: "#4ECDC4",
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  pickerSheet: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 12,
  },
  pickerTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 12,
  },
  pickerOption: {
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  pickerOptionActive: {
    backgroundColor: "#F0FDFB",
  },
  pickerOptionText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1A1A2E",
  },
  pickerOptionTextActive: {
    color: "#44A08D",
  },
});
