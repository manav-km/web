/**
 * auth.js (page script) — Handles authentication logic on the dedicated /frontend/pages/auth.html page.
 */
import { onAuth, signIn, signUp, signInGoogle, resetPassword, friendlyAuthError, setUserProfile } from "../core/auth.js";
import { api, h } from "../core/api.js";

(function () {
  "use strict";

  const tabIn = document.getElementById("tab-signin");
  const tabUp = document.getElementById("tab-signup");
  const form = document.getElementById("auth-form");
  const signedInBox = document.getElementById("auth-signed-in");
  const alertBox = document.getElementById("auth-alert");

  const rowName = document.getElementById("row-name");
  const rowAge = document.getElementById("row-age");
  const rowPriv = document.getElementById("row-priv");

  const inputName = document.getElementById("auth-name");
  const inputEmail = document.getElementById("auth-email");
  const inputPass = document.getElementById("auth-pass");
  const checkAge = document.getElementById("auth-age");
  const checkPriv = document.getElementById("auth-priv");

  const btnSubmit = document.getElementById("auth-submit");
  const btnGoogle = document.getElementById("auth-google");
  const btnForgot = document.getElementById("auth-forgot");

  const heading = document.getElementById("auth-heading");
  const subheading = document.getElementById("auth-subheading");

  // Read URL query parameter: ?mode=signin or default to ?mode=signup
  const urlParams = new URLSearchParams(window.location.search);
  let mode = urlParams.get("mode") === "signin" ? "signin" : "signup";

  function showAlert(msg, isOk = false) {
    alertBox.replaceChildren(
      h("p", { class: `notice ${isOk ? "notice--ok" : "notice--error"}` }, msg)
    );
  }

  function clearAlert() {
    alertBox.replaceChildren();
  }

  function setMode(m) {
    mode = m;
    const isSignUp = mode === "signup";

    tabIn.setAttribute("aria-pressed", String(!isSignUp));
    tabUp.setAttribute("aria-pressed", String(isSignUp));

    rowName.style.display = isSignUp ? "grid" : "none";
    rowAge.style.display = isSignUp ? "flex" : "none";
    rowPriv.style.display = isSignUp ? "flex" : "none";

    btnSubmit.textContent = isSignUp ? "Create Account" : "Sign In";
    inputPass.autocomplete = isSignUp ? "new-password" : "current-password";

    heading.textContent = isSignUp ? "CREATE ACCOUNT" : "SIGN IN";
    subheading.textContent = isSignUp
      ? "Create your client account to start a project, discuss requirements, and track milestones."
      : "Welcome back! Sign in to access your projects, messages, and settings.";

    clearAlert();
  }

  tabIn.addEventListener("click", () => setMode("signin"));
  tabUp.addEventListener("click", () => setMode("signup"));

  // Check initial state
  setMode(mode);

  // Form submission
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearAlert();

    const emailVal = inputEmail.value.trim();
    const passVal = inputPass.value;

    if (mode === "signup" && !inputName.value.trim()) {
      showAlert("Please enter your full name.");
      inputName.focus();
      return;
    }

    if (!emailVal || passVal.length < 8) {
      showAlert("Enter a valid email address and a password of at least 8 characters.");
      return;
    }

    if (mode === "signup" && (!checkAge.checked || !checkPriv.checked)) {
      showAlert("You must confirm you are 18+ and accept the Terms & Conditions.");
      return;
    }

    btnSubmit.disabled = true;
    btnSubmit.textContent = "Processing...";

    try {
      if (mode === "signin") {
        await signIn(emailVal, passVal);
        showAlert("Signed in successfully! Redirecting...", true);
        finishRedirect();
      } else {
        const cred = await signUp(emailVal, passVal);
        const nameVal = inputName.value.trim();
        if (nameVal) {
          await setUserProfile(cred.user, { displayName: nameVal }).catch(() => {});
          await api("/profile", { method: "PUT", body: { full_name: nameVal }, auth: true }).catch(() => {});
        }
        await api("/auth/confirm-age", { method: "POST", body: { age_confirmed: true, privacy_accepted: true }, auth: true }).catch(() => {});
        showAlert("Account created successfully! Redirecting...", true);
        finishRedirect();
      }
    } catch (err) {
      showAlert(friendlyAuthError(err));
      btnSubmit.disabled = false;
      btnSubmit.textContent = mode === "signup" ? "Create Account" : "Sign In";
    }
  });

  // Google sign in
  btnGoogle.addEventListener("click", async () => {
    clearAlert();
    if (mode === "signup" && (!checkAge.checked || !checkPriv.checked)) {
      showAlert("Please confirm you are 18+ and accept the Terms & Conditions before continuing with Google.");
      return;
    }

    try {
      await signInGoogle();
      if (checkAge.checked && checkPriv.checked) {
        await api("/auth/confirm-age", { method: "POST", body: { age_confirmed: true, privacy_accepted: true }, auth: true }).catch(() => {});
      }
      showAlert("Signed in with Google! Redirecting...", true);
      finishRedirect();
    } catch (err) {
      showAlert(friendlyAuthError(err));
    }
  });

  // Password reset
  btnForgot.addEventListener("click", async () => {
    clearAlert();
    const emailVal = inputEmail.value.trim();
    if (!emailVal) {
      showAlert("Please enter your email address in the field above first, then click reset again.");
      inputEmail.focus();
      return;
    }

    try {
      await resetPassword(emailVal);
      showAlert("Password reset link sent! Check your inbox.", true);
    } catch (err) {
      showAlert(friendlyAuthError(err));
    }
  });

  function finishRedirect() {
    // If redirected here from a specific page (e.g. ?redirect=/frontend/pages/connect.html), go there
    const redirectTarget = urlParams.get("redirect") || "/frontend/pages/connect.html";
    setTimeout(() => {
      window.location.href = redirectTarget;
    }, 900);
  }

  // Handle active session if user is already signed in
  onAuth((user) => {
    if (user && !form.dataset.submitting) {
      form.style.display = "none";
      signedInBox.style.display = "block";
      heading.textContent = "ACCOUNT READY";
      subheading.textContent = `Signed in as ${user.displayName || user.email}`;
    }
  });
})();
