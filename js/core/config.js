/**
 * config.js — PUBLIC configuration only. Nothing in this file is secret.
 * Firebase web config values are designed to be public (they identify the
 * project; security is enforced by Firebase rules + backend token checks).
 * NEVER put the Supabase service-role key, OpenRouter key, GitHub token or
 * Firebase service-account JSON in the frontend.
 */
// API base URL: automatically uses localhost:8000 when running locally,
// and your production backend URL when running live.
export const API_BASE =
  typeof location !== "undefined" && (location.hostname === "localhost" || location.hostname === "127.0.0.1")
    ? "http://localhost:8000/api/v1"
    : "https://portfolio-api-dqgyshzydocnsnxyzumc.a.run.app/api/v1"; // Replace with your final Cloud Run service URL once deployed

// Public — safe in the browser; the matching secret lives only on the backend (TURNSTILE_SECRET_KEY).
export const TURNSTILE_SITE_KEY = "0x4AAAAAAFOkivNtITAFrg2I";

export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDZmr_viAjkSl02asaybmJHhZYVYMTKYcc",
  authDomain: "manav-km-portfolio.firebaseapp.com",
  projectId: "manav-km-portfolio",
  appId: "1:703625663638:web:ec770cfe039a534c21deb7",
  // Chat now lives in Realtime Database and the browser reads/writes it
  // directly, so this needs the real RTDB URL (see docs/firebase.md).
  databaseURL: "https://manav-km-portfolio-default-rtdb.asia-southeast1.firebasedatabase.app",
};

// Google Analytics 4 Measurement ID. Set to a real G-XXXXXXXXXX value to enable GA.
// Leave as empty string to keep GA in no-op mode (no network requests made).
export const GA_MEASUREMENT_ID = "G-2S7V6QD7PW"; // TODO: replace with your real G- ID

// Runtime guard: API must be HTTPS in production
if (typeof API_BASE !== "undefined" && API_BASE.startsWith("http:") && typeof location !== "undefined" && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
  console.error("API_BASE must use HTTPS in production");
}
