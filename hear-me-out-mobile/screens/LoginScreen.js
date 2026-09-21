import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Image, Modal, ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import API from "../services/api";

const LOGO = require("../assets/logo.png");

const TERMS_TEXT = `Last updated: 2026

1. Acceptance of Terms
By using Hear Me Out, you agree to these Terms of Use. This app is intended for students and guidance counselors of STI College Global City as part of the school's wellness and counseling support program.

2. Not a Crisis Service
Hear Me Out supports mood tracking, self-assessment, and communication with your school's Guidance Office. It is not a substitute for emergency or professional medical care. If you are in crisis or in danger, please contact a local emergency hotline or go to the nearest hospital immediately.

3. Your Account
You are responsible for keeping your login credentials confidential and for all activity under your account. Please provide accurate information, including your assessment answers, so that counselors can better support you.

4. Appropriate Use
Chat and appointment features are meant for honest, respectful communication with your assigned counselor. Misuse of these features may result in account restrictions.

5. Changes to These Terms
We may update these Terms from time to time. Continued use of the app after changes are posted means you accept the revised Terms.`;

const PRIVACY_TEXT = `Last updated: 2026

1. What We Collect
Hear Me Out collects the information you provide directly: your name, email, year level, mood entries, assessment answers and scores, appointment details, and messages sent through the in-app chat.

2. How We Use It
Your information is used to track your emotional well-being over time, generate severity-based appointment recommendations, and let your assigned guidance counselor understand your situation so they can provide appropriate support.

3. Who Can See It
Your mood entries, assessment results, and chat messages are visible only to you and your assigned guidance counselor. The Guidance Office may view aggregated, de-identified trends (such as mood or risk-level statistics) for reporting purposes.

4. Data Storage & Security
Your data is stored securely and access is restricted to authenticated accounts. We do not sell or share your personal information with third parties outside of STI College Global City's counseling program.

5. Your Choices
You may request a copy of your data or ask that your account be deactivated by contacting the Guidance Office directly.

6. Contact
Questions about this policy can be directed to the STI College Global City Guidance Office.`;

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [error, setError] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [activeDoc, setActiveDoc] = useState(null); // "terms" | "privacy" | null

  const handleLogin = async () => {
    if (!email || !password) { setError("Please enter your email and password."); return; }
    if (!agreed) { setError("Please agree to the Terms & Privacy Policy to continue."); return; }
    setError("");
    try {
      setLoading(true);
      const res = await API.post("/auth/login", { email, password });

      if (!res.data.token) { setError("Login failed. Please try again."); return; }

      const user = res.data.user;
      if (!user || !user.role || !user.id) { setError("Login error. Please try again."); return; }

      await AsyncStorage.multiSet([
        ["token", res.data.token],
        ["role", user.role],
        ["userId", user.id],
        ["name", user.name || ""],
        ["email", user.email || ""],
      ]);

      if (user.role === "student") {
        try {
          const check = await API.get(`/assessment/check/${user.id}`);
          if (check.data.hasAssessment) {
            navigation.replace("Dashboard", { step: "pick" });
          } else {
            navigation.replace("Assessment");
          }
        } catch {
          navigation.replace("Assessment");
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={["#667eea", "#764ba2"]} style={styles.container}>
      <View style={styles.blob1} />
      <View style={styles.blob2} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.kav}
      >
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{
              width: 80, height: 80, borderRadius: 40,
              backgroundColor: "#1a1a2e",
              alignItems: "center", justifyContent: "center",
              marginBottom: 10, overflow: "hidden"
            }}>
              <Image source={LOGO} style={{ width: 72, height: 72, resizeMode: "contain" }} />
            </View>
            <Text style={styles.title}>Hear Me Out</Text>
            <Text style={styles.subtitle}>Your mental wellness companion</Text>
          </View>

          {/* Email */}
          <View style={styles.group}>
            <Text style={styles.label}>EMAIL ADDRESS</Text>
            <View style={[styles.inputRow, focusedField === "email" && styles.inputRowFocused]}>
              <Text style={styles.fieldIcon}>✉️</Text>
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

          {/* Password */}
          <View style={styles.group}>
            <Text style={styles.label}>PASSWORD</Text>
            <View style={[styles.inputRow, focusedField === "password" && styles.inputRowFocused]}>
              <Text style={styles.fieldIcon}>🔒</Text>
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
                <Text>{showPass ? "🙈" : "👁️"}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Terms agreement */}
          <TouchableOpacity
            onPress={() => setAgreed(v => !v)}
            style={styles.agreeRow}
            activeOpacity={0.75}
          >
            <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
              {agreed && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.agreeText}>
              I agree to the{" "}
              <Text style={styles.agreeLink} onPress={() => setActiveDoc("terms")}>Terms</Text>
              {" "}&{" "}
              <Text style={styles.agreeLink} onPress={() => setActiveDoc("privacy")}>Privacy Policy</Text>
            </Text>
          </TouchableOpacity>

          {!!error && (
            <Text style={{
              color: "#F87171", fontSize: 13,
              fontWeight: "600", textAlign: "center", marginBottom: 8
            }}>
              {error}
            </Text>
          )}

          {/* Button */}
          <TouchableOpacity
            onPress={handleLogin}
            disabled={loading || !agreed}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={["#6C63FF", "#764ba2"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.btn, (loading || !agreed) && { opacity: 0.5 }]}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>Sign In →</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Footer */}
          <View style={[styles.footerRow, { marginTop: 24 }]}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate("Register")}>
              <Text style={styles.link}>Create one</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.footerRow, { marginTop: 8 }]}>
            <TouchableOpacity onPress={() => navigation.navigate("ForgotPassword")}>
              <Text style={styles.link}>Forgot password?</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Terms / Privacy Policy popup */}
      <Modal
        visible={!!activeDoc}
        transparent
        animationType="slide"
        onRequestClose={() => setActiveDoc(null)}
      >
        <View style={styles.docOverlay}>
          <View style={styles.docSheet}>
            <View style={styles.docHeader}>
              <TouchableOpacity onPress={() => setActiveDoc(null)} style={styles.docBackBtn} activeOpacity={0.75}>
                <Text style={styles.docBackBtnText}>← Back</Text>
              </TouchableOpacity>
              <Text style={styles.docTitle}>
                {activeDoc === "terms" ? "Terms of Use" : "Privacy Policy"}
              </Text>
            </View>
            <ScrollView style={styles.docBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.docText}>
                {activeDoc === "terms" ? TERMS_TEXT : PRIVACY_TEXT}
              </Text>
            </ScrollView>
          </View>
        </View>
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
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: "rgba(255,255,255,0.07)",
    top: -100,
    right: -100,
  },
  blob2: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(255,101,132,0.1)",
    bottom: -80,
    left: -60,
  },
  kav: {
    width: "100%",
    paddingHorizontal: 24,
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
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  title: {
    fontSize: 26,
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
    marginBottom: 18,
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
    borderColor: "#6C63FF",
    backgroundColor: "#FAFBFF",
  },
  fieldIcon: {
    fontSize: 17,
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
    shadowColor: "#6C63FF",
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
    alignItems: "center",
  },
  footerText: {
    fontSize: 14,
    color: "#6B7280",
  },
  link: {
    fontSize: 14,
    color: "#6C63FF",
    fontWeight: "700",
    textDecorationLine: "underline",
  },

  /* ── Terms agreement ── */
  agreeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 16,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: "#6C63FF",
    borderColor: "#6C63FF",
  },
  checkmark: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
  agreeText: {
    flex: 1,
    fontSize: 13,
    color: "#4B5563",
    lineHeight: 19,
  },
  agreeLink: {
    color: "#6C63FF",
    fontWeight: "700",
    textDecorationLine: "underline",
  },

  /* ── Terms / Privacy popup ── */
  docOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  docSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "82%",
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
  },
  docHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  docBackBtn: {
    paddingVertical: 6,
    paddingRight: 4,
  },
  docBackBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#6C63FF",
  },
  docTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1A1A2E",
  },
  docBody: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  docText: {
    fontSize: 14,
    lineHeight: 22,
    color: "#374151",
    paddingBottom: 24,
  },
});