import { useEffect, useState, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, KeyboardAvoidingView, Platform, SafeAreaView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { io } from "socket.io-client";

// ⚠️ Change to your local IP when testing on a real device
const socket = io("http://10.0.2.2:5000");

export default function ChatScreen({ navigation }) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [userId, setUserId] = useState(null);
  const [roomId, setRoomId] = useState(null);

  const flatRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    const init = async () => {
      const uid = await AsyncStorage.getItem("userId");
      setUserId(uid);
      setRoomId(uid); // student's roomId is their userId

      socket.emit("joinRoom", uid);
    };

    init();

    socket.on("loadMessages", (data) => {
      setMessages(data);
    });

    socket.on("receiveMessage", (data) => {
      setMessages((prev) => [...prev, data]);
    });

    socket.on("messagesSeen", (updatedMessages) => {
      setMessages(updatedMessages);
    });

    socket.on("typing", () => setIsTyping(true));
    socket.on("stopTyping", () => setIsTyping(false));

    return () => {
      socket.off("receiveMessage");
      socket.off("loadMessages");
      socket.off("messagesSeen");
      socket.off("typing");
      socket.off("stopTyping");
    };
  }, []);

  useEffect(() => {
    if (messages.length > 0 && userId) {
      const hasUnseen = messages.some(
        (m) => !m.seen && String(m.senderId) !== String(userId)
      );
      if (hasUnseen && roomId) {
        socket.emit("markSeen", { roomId: String(roomId), userId: String(userId) });
      }
    }
  }, [messages, userId, roomId]);

  const handleTyping = (text) => {
    setMessage(text);
    socket.emit("typing", { roomId });
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("stopTyping", { roomId });
    }, 1000);
  };

  const sendMessage = () => {
    if (!message.trim() || !roomId || !userId) return;
    socket.emit("sendMessage", {
      roomId: String(roomId),
      senderId: String(userId),
      message: message.trim(),
    });
    socket.emit("stopTyping", { roomId });
    setMessage("");
  };

  const formatTime = (ts) => {
    if (!ts) return "";
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const renderMessage = ({ item, index }) => {
    const isMe = String(item.senderId) === String(userId);
    const isLast = index === messages.length - 1;

    return (
      <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowThem]}>
        {!isMe && (
          <View style={styles.theirAvatar}>
            <Text style={{ fontSize: 14 }}>👨‍⚕️</Text>
          </View>
        )}
        <View style={isMe ? styles.myBubble : styles.theirBubble}>
          <Text style={isMe ? styles.myBubbleText : styles.theirBubbleText}>
            {item.message}
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.timeText}>{formatTime(item.createdAt)}</Text>
            {isMe && isLast && (
              <Text style={styles.seenText}>{item.seen ? " ✓✓" : " ✓"}</Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#6C63FF" }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        {/* Header */}
        <LinearGradient colors={["#6C63FF", "#764ba2"]} style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <View style={styles.counselorAvatar}>
              <Text style={{ fontSize: 22 }}>👨‍⚕️</Text>
            </View>
            <View>
              <Text style={styles.headerName}>Your Counselor</Text>
              <Text style={styles.headerStatus}>
                {isTyping ? "Typing…" : "Online ●"}
              </Text>
            </View>
          </View>
          <Text style={styles.headerHeart}>💙</Text>
        </LinearGradient>

        {/* Messages */}
        {messages.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyTitle}>No messages yet</Text>
            <Text style={styles.emptyText}>Start the conversation with your counselor</Text>
          </View>
        ) : (
          <FlatList
            ref={flatRef}
            data={messages}
            keyExtractor={(_, i) => String(i)}
            renderItem={renderMessage}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() =>
              flatRef.current?.scrollToEnd({ animated: true })
            }
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Typing indicator */}
        {isTyping && (
          <View style={styles.typingRow}>
            <View style={styles.theirAvatar}>
              <Text style={{ fontSize: 12 }}>👨‍⚕️</Text>
            </View>
            <View style={styles.typingBubble}>
              <Text style={styles.typingText}>Typing…</Text>
            </View>
          </View>
        )}

        {/* Input */}
        <View style={styles.inputBar}>
          <View style={styles.inputWrap}>
            <TextInput
              value={message}
              onChangeText={handleTyping}
              placeholder="Type a message…"
              placeholderTextColor="#9CA3AF"
              style={styles.input}
              multiline
              maxLength={500}
            />
          </View>
          <TouchableOpacity
            onPress={sendMessage}
            activeOpacity={0.8}
            disabled={!message.trim()}
          >
            <LinearGradient
              colors={message.trim() ? ["#6C63FF", "#764ba2"] : ["#D1D5DB", "#D1D5DB"]}
              style={styles.sendBtn}
            >
              <Text style={styles.sendIcon}>➤</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    paddingTop: 8,
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  backText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  counselorAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerName: { color: "#fff", fontWeight: "700", fontSize: 15 },
  headerStatus: { color: "rgba(255,255,255,0.8)", fontSize: 12, marginTop: 1 },
  headerHeart: { fontSize: 20 },

  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F3F4F8",
    gap: 10,
  },
  emptyIcon: { fontSize: 52, marginBottom: 4 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#1A1A2E" },
  emptyText: { fontSize: 13, color: "#9CA3AF", textAlign: "center", paddingHorizontal: 40 },

  messageList: {
    padding: 14,
    paddingBottom: 4,
    backgroundColor: "#F3F4F8",
    flexGrow: 1,
  },
  msgRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 8,
    gap: 6,
  },
  msgRowMe: { justifyContent: "flex-end" },
  msgRowThem: { justifyContent: "flex-start" },
  theirAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
  },
  myBubble: {
    backgroundColor: "#6C63FF",
    borderRadius: 18,
    borderBottomRightRadius: 4,
    padding: 12,
    maxWidth: "72%",
    shadowColor: "#6C63FF",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  myBubbleText: { color: "#fff", fontSize: 14, lineHeight: 20 },
  theirBubble: {
    backgroundColor: "#fff",
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    padding: 12,
    maxWidth: "72%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  theirBubbleText: { color: "#1A1A2E", fontSize: 14, lineHeight: 20 },
  metaRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 4 },
  timeText: { fontSize: 9, opacity: 0.65, color: "inherit" },
  seenText: { fontSize: 9, opacity: 0.65 },

  typingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingBottom: 6,
    backgroundColor: "#F3F4F8",
  },
  typingBubble: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  typingText: { color: "#9CA3AF", fontSize: 12, fontStyle: "italic" },

  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  inputWrap: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 10 : 2,
    maxHeight: 100,
  },
  input: {
    fontSize: 14,
    color: "#1A1A2E",
    paddingVertical: Platform.OS === "android" ? 8 : 0,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#6C63FF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  sendIcon: { color: "#fff", fontSize: 17, fontWeight: "700" },
});
