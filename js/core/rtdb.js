/**
 * rtdb.js — direct browser access to Firebase Realtime Database.
 * Conversations/messages are READ here but WRITTEN only by the backend
 * (see services/firebase_rtdb.py) — this module's send/typing/draft/presence
 * writes are the paths RTDB rules allow a client to write directly.
 */
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getDatabase, ref, onValue, off, set, remove, onDisconnect, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import { FIREBASE_CONFIG } from "./config.js";

const app = getApps()[0] || initializeApp(FIREBASE_CONFIG);
const db = getDatabase(app);

/** Live conversation metadata (latest preview, active state). Returns an unsubscribe fn. */
export function listenConversation(convId, cb) {
  const r = ref(db, `conversations/${convId}`);
  onValue(r, (snap) => cb(snap.val()));
  return () => off(r);
}

/** Live message list, newest-last. Returns an unsubscribe fn. */
export function listenMessages(convId, cb) {
  const r = ref(db, `messages/${convId}`);
  onValue(r, (snap) => {
    const val = snap.val() || {};
    cb(Object.values(val).sort((a, b) => a.created_at - b.created_at));
  });
  return () => off(r);
}

/** Draft — client writes directly (low-stakes, per-keystroke; see docs/architecture.md). */
export function listenDraft(convId, uid, cb) {
  const r = ref(db, `drafts/${convId}/${uid}`);
  onValue(r, (snap) => cb(snap.val()?.content || ""));
  return () => off(r);
}
export function saveDraft(convId, uid, content) {
  const r = ref(db, `drafts/${convId}/${uid}`);
  return content ? set(r, { content, updated_at: Date.now() }) : remove(r);
}

/** Typing indicator — ephemeral, auto-clears on disconnect. */
export function listenTyping(convId, otherUid, cb) {
  const r = ref(db, `typing/${convId}/${otherUid}`);
  onValue(r, (snap) => cb(Boolean(snap.val())));
  return () => off(r);
}
let typingTimer = null;
export function setTyping(convId, uid, isTyping) {
  const r = ref(db, `typing/${convId}/${uid}`);
  set(r, isTyping);
  onDisconnect(r).set(false);
  clearTimeout(typingTimer);
  if (isTyping) typingTimer = setTimeout(() => set(r, false), 5000); // auto-clear if the user stops without an explicit "stopped" event
}

/** Presence — standard Firebase recipe: flip to offline the instant the connection drops. */
export function initPresence(uid) {
  const connectedRef = ref(db, ".info/connected");
  const myRef = ref(db, `presence/${uid}`);
  onValue(connectedRef, (snap) => {
    if (!snap.val()) return;
    onDisconnect(myRef).set({ online: false, last_changed: serverTimestamp() });
    set(myRef, { online: true, last_changed: serverTimestamp() });
  });
}
export function listenPresence(uid, cb) {
  const r = ref(db, `presence/${uid}`);
  onValue(r, (snap) => cb(snap.val()?.online === true));
  return () => off(r);
}

/** Unread count — a client may only zero their own (enforced by RTDB rules too). */
export function listenUnread(uid, convId, cb) {
  const r = ref(db, `unread/${uid}/${convId}`);
  onValue(r, (snap) => cb(snap.val() || 0));
  return () => off(r);
}
export function clearUnread(uid, convId) {
  return set(ref(db, `unread/${uid}/${convId}`), 0);
}

/** Non-chat live notification ping (new status, review available, etc.) — see services/realtime.py. */
export function listenSignal(uid, cb) {
  const r = ref(db, `signals/${uid}`);
  onValue(r, (snap) => { if (snap.val()) cb(snap.val()); });
  return () => off(r);
}
