import { io } from "socket.io-client";
import AsyncStorage from "@react-native-async-storage/async-storage";

// A single socket instance for the whole app — created once, shared by any
// screen that needs it (chat, presence, live appointment updates), instead
// of each screen opening its own connection.
//
// The server now rejects any connection without a valid JWT, so the token
// has to be supplied here. `auth` as a function (rather than a plain
// object) is re-invoked on every connection/reconnection attempt, so it
// always reads whatever token is in storage AT THAT MOMENT — including the
// very first attempt, which happens before login if the app is cold-started
// with no session yet (it'll just retry, via the client's built-in
// reconnection backoff, once a token exists).
const socket = io("https://hear-me-out-backend.onrender.com", {
  auth: (cb) => AsyncStorage.getItem("token").then((token) => cb({ token })),
});

let currentIdentity = null;

// Registers this device as online for the given user, and automatically
// re-sends that identity if the socket reconnects (e.g. after a network
// blip) — the server forgets it on every disconnect, this doesn't.
export function identify(userId, role) {
  currentIdentity = userId ? { userId: String(userId), role } : null;
  if (!currentIdentity) return;
  // identify() is always called right after login/session-restore, i.e.
  // exactly when a token is guaranteed to exist — if the socket hasn't
  // connected yet (e.g. it tried once before login and is sitting in
  // reconnection backoff), nudge it to retry right now instead of waiting.
  if (!socket.connected) socket.connect();
  else socket.emit("identify", currentIdentity);
}

// Call on logout so this device stops showing as online immediately,
// instead of only once the socket actually disconnects.
export function clearIdentity() {
  currentIdentity = null;
  socket.emit("unidentify");
}

socket.on("connect", () => {
  if (currentIdentity) socket.emit("identify", currentIdentity);
});

export default socket;
