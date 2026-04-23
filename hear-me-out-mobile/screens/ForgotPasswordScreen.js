import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import API from "../services/api";

export default function ForgotPasswordScreen({ navigation }) {
  const [step,    setStep]    = useState("request"); // "request" | "code"
  const [email,   setEmail]   = useState("");
  const [code,    setCode]    = useState("");
  const [newPw,   setNewPw]   = useState("");
  const [conPw,   setConPw]   = useState("");
  const [showPw,  setShowPw]  = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [success, setSuccess] = useState(false);
  const [focused, setFocused] = useState(null);
  const [generatedCode, setGeneratedCode] = useState("");

  const handleRequest = async () => {
    if (!email) { setError("Please enter your email."); return; }
    setError("");
    try {
      setLoading(true);
      const res = await API.post("/auth/forgot-password", { email });
      if (res.data.success) {
        setGeneratedCode(res.data.code);
        setStep("code");
      } else {
        setError(res.data.message || "Request failed.");
      }
    } catch (e) {
      setError(e.response?.data?.message || "Something went wrong.");
    } finally { setLoading(false); }
  };

  const handleReset = async () => {
    if (!code || !newPw || !conPw) { setError("Please fill in all fields."); return; }
    if (newPw !== conPw) { setError("Passwords do not match."); return; }
    if (newPw.length < 6) { setError("Password must be at least 6 characters."); return; }
    setError("");
    try {
      setLoading(true);
      const res = await API.post("/auth/reset-password", { email, code: code.toUpperCase(), newPassword: newPw });
      if (res.data.success) {
        setSuccess(true);
      } else {
        setError(res.data.message || "Reset failed.");
      }
    } catch (e) {
      setError(e.response?.data?.message || "Something went wrong.");
    } finally { setLoading(false); }
  };

  if (success) {
    return (
      <LinearGradient colors={["#667eea", "#764ba2"]} style={s.container}>
        <View style={s.card}>
          <Text style={{ fontSize: 56, textAlign: "center", marginBottom: 16 }}>✅</Text>
          <Text style={s.title}>Password Reset!</Text>
          <Text style={s.subtitle}>Your password has been updated.{"\n"}You can now sign in.</Text>
          <TouchableOpacity onPress={() => navigation.navigate("Login")} activeOpacity={0.85}>
            <LinearGradient colors={["#6C63FF", "#764ba2"]} start={{ x:0, y:0 }} end={{ x:1, y:0 }} style={s.btn}>
              <Text style={s.btnText}>Back to Sign In →</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={["#667eea", "#764ba2"]} style={s.container}>
      <View style={s.blob1} />
      <View style={s.blob2} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.kav}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={s.card}>

            {step === "request" ? (
              <>
                <View style={s.header}>
                  <Text style={s.logo}>🔑</Text>
                  <Text style={s.title}>Forgot Password</Text>
                  <Text style={s.subtitle}>Enter your email to get a recovery code</Text>
                </View>

                <View style={s.group}>
                  <Text style={s.label}>EMAIL ADDRESS</Text>
                  <View style={[s.inputRow, focused === "email" && s.inputRowFocused]}>
                    <Text style={s.icon}>✉️</Text>
                    <TextInput
                      placeholder="you@university.edu"
                      placeholderTextColor="#9CA3AF"
                      value={email}
                      onChangeText={setEmail}
                      onFocus={() => setFocused("email")}
                      onBlur={() => setFocused(null)}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      style={s.input}
                    />
                  </View>
                </View>

                {!!error && <Text style={s.error}>{error}</Text>}

                <TouchableOpacity onPress={handleRequest} disabled={loading} activeOpacity={0.85}>
                  <LinearGradient colors={["#6C63FF","#764ba2"]} start={{ x:0,y:0 }} end={{ x:1,y:0 }} style={[s.btn, loading && { opacity:0.75 }]}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Get Recovery Code →</Text>}
                  </LinearGradient>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={s.header}>
                  <Text style={s.logo}>🔐</Text>
                  <Text style={s.title}>Reset Password</Text>
                  <Text style={s.subtitle}>Use the code below to set a new password</Text>
                </View>

                {/* Show the generated code prominently */}
                <View style={s.codePillWrap}>
                  <Text style={s.codePillLabel}>Your recovery code</Text>
                  <Text style={s.codePill}>{generatedCode}</Text>
                  <Text style={s.codeNote}>⏰ Expires in 15 minutes</Text>
                </View>

                <View style={s.group}>
                  <Text style={s.label}>RECOVERY CODE</Text>
                  <View style={[s.inputRow, focused === "code" && s.inputRowFocused]}>
                    <Text style={s.icon}>🔑</Text>
                    <TextInput
                      placeholder="Enter code above"
                      placeholderTextColor="#9CA3AF"
                      value={code}
                      onChangeText={t => setCode(t.toUpperCase())}
                      onFocus={() => setFocused("code")}
                      onBlur={() => setFocused(null)}
                      autoCapitalize="characters"
                      style={[s.input, { letterSpacing: 4, fontWeight: "700" }]}
                    />
                  </View>
                </View>

                <View style={s.group}>
                  <Text style={s.label}>NEW PASSWORD</Text>
                  <View style={[s.inputRow, focused === "pw" && s.inputRowFocused]}>
                    <Text style={s.icon}>🔒</Text>
                    <TextInput
                      placeholder="Min. 6 characters"
                      placeholderTextColor="#9CA3AF"
                      value={newPw}
                      onChangeText={setNewPw}
                      onFocus={() => setFocused("pw")}
                      onBlur={() => setFocused(null)}
                      secureTextEntry={!showPw}
                      style={[s.input, { flex:1 }]}
                    />
                    <TouchableOpacity onPress={() => setShowPw(!showPw)} style={s.eye}>
                      <Text>{showPw ? "🙈" : "👁️"}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={s.group}>
                  <Text style={s.label}>CONFIRM PASSWORD</Text>
                  <View style={[s.inputRow, focused === "cpw" && s.inputRowFocused]}>
                    <Text style={s.icon}>🔒</Text>
                    <TextInput
                      placeholder="Re-enter password"
                      placeholderTextColor="#9CA3AF"
                      value={conPw}
                      onChangeText={setConPw}
                      onFocus={() => setFocused("cpw")}
                      onBlur={() => setFocused(null)}
                      secureTextEntry
                      style={s.input}
                    />
                  </View>
                </View>

                {!!error && <Text style={s.error}>{error}</Text>}

                <TouchableOpacity onPress={handleReset} disabled={loading} activeOpacity={0.85}>
                  <LinearGradient colors={["#6C63FF","#764ba2"]} start={{ x:0,y:0 }} end={{ x:1,y:0 }} style={[s.btn, loading && { opacity:0.75 }]}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Reset Password →</Text>}
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}

            <View style={s.footerRow}>
              <Text style={s.footerText}>Remember it? </Text>
              <TouchableOpacity onPress={() => navigation.navigate("Login")}>
                <Text style={s.link}>Sign in</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  container: { flex:1, justifyContent:"center", alignItems:"center" },
  blob1: { position:"absolute", width:360, height:360, borderRadius:180, backgroundColor:"rgba(255,255,255,0.07)", top:-100, right:-100 },
  blob2: { position:"absolute", width:260, height:260, borderRadius:130, backgroundColor:"rgba(255,101,132,0.1)", bottom:-80, left:-60 },
  kav: { width:"100%", paddingHorizontal:24, paddingVertical:24 },
  card: { backgroundColor:"rgba(255,255,255,0.97)", borderRadius:28, padding:32, shadowColor:"#000", shadowOffset:{ width:0, height:16 }, shadowOpacity:0.22, shadowRadius:32, elevation:12 },
  header: { alignItems:"center", marginBottom:24 },
  logo: { fontSize:48, marginBottom:10 },
  title: { fontSize:24, fontWeight:"800", color:"#1A1A2E", letterSpacing:-0.5, marginBottom:4, textAlign:"center" },
  subtitle: { fontSize:13, color:"#6B7280", textAlign:"center" },
  group: { marginBottom:16 },
  label: { fontSize:11, fontWeight:"700", color:"#374151", letterSpacing:0.8, marginBottom:7 },
  inputRow: { flexDirection:"row", alignItems:"center", backgroundColor:"#F9FAFB", borderRadius:14, borderWidth:2, borderColor:"#E5E7EB", paddingHorizontal:14, paddingVertical: Platform.OS === "ios" ? 14 : 2 },
  inputRowFocused: { borderColor:"#6C63FF", backgroundColor:"#FAFBFF" },
  icon: { fontSize:17, marginRight:10 },
  input: { flex:1, fontSize:15, color:"#1A1A2E", paddingVertical: Platform.OS === "android" ? 10 : 0 },
  eye: { padding:4 },
  error: { color:"#F87171", fontSize:13, fontWeight:"600", textAlign:"center", marginBottom:8 },
  btn: { borderRadius:14, paddingVertical:16, alignItems:"center", marginTop:6, shadowColor:"#6C63FF", shadowOffset:{ width:0, height:8 }, shadowOpacity:0.35, shadowRadius:14, elevation:6 },
  btnText: { color:"#fff", fontSize:16, fontWeight:"700", letterSpacing:0.3 },
  codePillWrap: { alignItems:"center", marginBottom:20, padding:16, backgroundColor:"#EEF0FD", borderRadius:16 },
  codePillLabel: { fontSize:12, color:"#7B7F9E", marginBottom:8 },
  codePill: { fontSize:28, fontWeight:"800", letterSpacing:8, color:"#5B6BD8" },
  codeNote: { fontSize:11, color:"#9CA3AF", marginTop:6 },
  footerRow: { flexDirection:"row", justifyContent:"center", marginTop:24 },
  footerText: { fontSize:14, color:"#6B7280" },
  link: { fontSize:14, color:"#6C63FF", fontWeight:"700", textDecorationLine:"underline" },
});
