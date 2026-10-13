/**
 * auth.js — Firebase Authentication (client side). Firebase is the ONLY auth system.
 * The backend re-verifies every ID token; nothing here is trusted for authorization.
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signInWithPopup, GoogleAuthProvider, signOut, sendEmailVerification, sendPasswordResetEmail,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { FIREBASE_CONFIG } from "./config.js";

const app = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);

export const currentUser = () => auth.currentUser;
export const getIdToken = async () => (auth.currentUser ? auth.currentUser.getIdToken() : null);

/** Resolves once Firebase has restored (or not) the session, then keeps calling cb on changes. */
export function onAuth(cb) { return onAuthStateChanged(auth, cb); }

export async function signIn(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}
export async function signUp(email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  try { await sendEmailVerification(cred.user); } catch { /* non-fatal */ }
  return cred;
}
export const signInGoogle = () => signInWithPopup(auth, new GoogleAuthProvider());
export const resetPassword = (email) => sendPasswordResetEmail(auth, email);
export const logOut = () => signOut(auth);
export const resendVerification = (user) => sendEmailVerification(user);

export function friendlyAuthError(err) {
  const map = {
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/user-not-found": "Incorrect email or password.",
    "auth/wrong-password": "Incorrect email or password.",
    "auth/email-already-in-use": "An account with this email already exists.",
    "auth/weak-password": "Use a password of at least 8 characters.",
    "auth/invalid-email": "That email address doesn't look right.",
    "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
    "auth/popup-closed-by-user": "Sign-in was cancelled.",
    "auth/network-request-failed": "Network error. Check your connection.",
  };
  return map[err?.code] || "Couldn't sign you in. Please try again.";
}
