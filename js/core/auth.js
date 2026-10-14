/**
 * auth.js — Firebase Authentication (client side). Firebase is the ONLY auth system.
 * The backend re-verifies every ID token; nothing here is trusted for authorization.
 */
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signInWithPopup, GoogleAuthProvider, OAuthProvider, signOut, sendEmailVerification, sendPasswordResetEmail,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { FIREBASE_CONFIG } from "./config.js";

const app = getApps().length > 0 ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
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
export const setUserProfile = (user, data) => updateProfile(user, data);

// OAuth Providers
export const signInGoogle = () => signInWithPopup(auth, new GoogleAuthProvider());

export const signInApple = () => {
  const provider = new OAuthProvider("apple.com");
  provider.addScope("email");
  provider.addScope("name");
  return signInWithPopup(auth, provider);
};

export const signInMicrosoft = () => {
  const provider = new OAuthProvider("microsoft.com");
  provider.setCustomParameters({
    prompt: "select_account",
  });
  return signInWithPopup(auth, provider);
};

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
    "auth/cancelled-popup-request": "Sign-in was cancelled.",
    "auth/popup-blocked": "Popup was blocked by your browser. Please allow popups for this site.",
    "auth/network-request-failed": "Network error. Check your connection.",
    "auth/account-exists-with-different-credential": "An account already exists with this email address using a different sign-in method.",
    "auth/operation-not-allowed": "This sign-in provider is not enabled yet in your Firebase Console. Please enable it under Authentication > Sign-in method.",
    "auth/unauthorized-domain": "This domain is not authorized for OAuth in the Firebase Console.",
  };
  return map[err?.code] || err?.message || "Couldn't sign you in. Please try again.";
}
