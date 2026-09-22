import { io } from "socket.io-client";

// A single socket instance for the whole app — created once, shared by any
// screen that needs it (chat, presence, live appointment updates), instead
// of each screen opening its own connection.
const socket = io("https://hear-me-out-backend-production-8100.up.railway.app");

let currentIdentity = null;

// Registers this device as online for the given user, and automatically
// re-sends that identity if the socket reconnects (e.g. after a network
// blip) — the server forgets it on every disconnect, this doesn't.
export function identify(userId, role) {
  currentIdentity = userId ? { userId: String(userId), role } : null;
  if (currentIdentity) socket.emit("identify", currentIdentity);
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
