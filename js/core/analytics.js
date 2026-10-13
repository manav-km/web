/**
 * analytics.js — Google Analytics 4, consent-banner gated.
 * - No-op if GA_MEASUREMENT_ID is empty or placeholder.
 * - Disabled entirely on the admin page.
 * - Fires only after the user accepts analytics via the consent banner.
 * - IP anonymization enabled.
 */
import { GA_MEASUREMENT_ID } from "./config.js";

const IS_ADMIN = typeof location !== "undefined" && location.pathname.startsWith("/portfolio/admin");
const HAS_ID = Boolean(
  GA_MEASUREMENT_ID &&
  !GA_MEASUREMENT_ID.startsWith("YOUR_") &&
  GA_MEASUREMENT_ID.startsWith("G-")
);

const CONSENT_KEY = "ga_consent";

let _initialized = false;

function _init() {
  if (_initialized || !HAS_ID || IS_ADMIN) return;
  _initialized = true;

  const s = document.createElement("script");
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  s.async = true;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () {
    window.dataLayer.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", GA_MEASUREMENT_ID, {
    anonymize_ip: true,
    send_page_view: true,
  });
}

/** Call this after user accepts analytics consent. */
export function acceptAnalytics() {
  try {
    localStorage.setItem(CONSENT_KEY, "1");
  } catch {
    /* private mode */
  }
  _init();
}

/** Call this if user declines. */
export function declineAnalytics() {
  try {
    localStorage.setItem(CONSENT_KEY, "0");
  } catch {
    /* private mode */
  }
}

/** Returns true if consent was previously given. */
export function hasConsent() {
  try {
    return localStorage.getItem(CONSENT_KEY) === "1";
  } catch {
    return false;
  }
}

// Auto-init if consent was previously given (returning visitor)
if (hasConsent()) {
  _init();
}
