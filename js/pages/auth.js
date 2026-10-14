/**
 * auth.js (page script) — Handles authentication logic on the dedicated /frontend/pages/auth.html page.
 * Formatted with neat multi-box sections: Box 1 (Personal Info), Box 2 (Business Info), Box 3 (Legal & Privacy).
 */
import { onAuth, signIn, signUp, signInGoogle, resetPassword, friendlyAuthError, setUserProfile } from "../core/auth.js";
import { api, h } from "../core/api.js";
import { TURNSTILE_SITE_KEY } from "../core/config.js";

(function () {
  "use strict";

  const tabIn = document.getElementById("tab-signin");
  const tabUp = document.getElementById("tab-signup");
  const form = document.getElementById("auth-form");
  const signedInBox = document.getElementById("auth-signed-in");
  const alertBox = document.getElementById("auth-alert");

  // Box containers
  const boxPersonal = document.getElementById("box-personal");
  const boxBusiness = document.getElementById("box-business");
  const boxLegal = document.getElementById("box-legal");
  const personalTitle = boxPersonal?.querySelector(".auth-box__title");

  // Box 1 rows & columns
  const rowPersonal1 = document.getElementById("row-personal-1");
  const rowPersonal2 = document.getElementById("row-personal-2");
  const rowPersonal3 = document.getElementById("row-personal-3");
  const colName = document.getElementById("col-name");
  const colAddress = document.getElementById("col-address");
  const colPhone = document.getElementById("col-phone");
  const colPassConfirm = document.getElementById("col-pass-confirm");

  // Personal Info inputs
  const inputName = document.getElementById("auth-name");
  const inputAddress = document.getElementById("auth-address");
  const inputEmail = document.getElementById("auth-email");
  const inputPhone = document.getElementById("auth-phone");
  const inputPass = document.getElementById("auth-pass");
  const inputPassConfirm = document.getElementById("auth-pass-confirm");

  // Business Info inputs
  const inputBusinessOrg = document.getElementById("auth-business-org");
  const inputBusinessAddress = document.getElementById("auth-business-address");
  const inputBusinessEmail = document.getElementById("auth-business-email");
  const inputBusinessPhone = document.getElementById("auth-business-phone");
  const inputBusinessType = document.getElementById("auth-business-type");
  const inputBusinessDesignation = document.getElementById("auth-business-designation");

  // Legal & Privacy inputs
  const inputDob = document.getElementById("auth-dob");
  const checkAge = document.getElementById("auth-age");
  const checkPriv = document.getElementById("auth-priv");
  const turnstileContainer = document.getElementById("auth-turnstile");

  // Action buttons
  const btnReset = document.getElementById("auth-reset");
  const btnSubmit = document.getElementById("auth-submit");
  const btnGoogle = document.getElementById("auth-google");
  const btnForgot = document.getElementById("auth-forgot");
  const forgotWrap = document.getElementById("auth-forgot-wrap");

  const heading = document.getElementById("auth-heading");
  const subheading = document.getElementById("auth-subheading");

  // Restrict DOB to at least 18 years ago
  if (inputDob) {
    const maxDob = new Date();
    maxDob.setFullYear(maxDob.getFullYear() - 18);
    inputDob.setAttribute("max", maxDob.toISOString().split("T")[0]);
  }

  // Cloudflare Turnstile mount
  let turnstileWidgetId = null;
  function mountTurnstile() {
    if (!turnstileContainer) return;
    const tryRender = () => {
      if (!window.turnstile) return setTimeout(tryRender, 150);
      if (turnstileWidgetId !== null) return;
      try {
        turnstileWidgetId = window.turnstile.render(turnstileContainer, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: "dark",
        });
      } catch { /* already rendered or failed */ }
    };
    tryRender();
  }
  mountTurnstile();

  // Read URL query parameter: ?mode=signin or default to ?mode=signup
  const urlParams = new URLSearchParams(window.location.search);
  let mode = urlParams.get("mode") === "signin" ? "signin" : "signup";

  function showAlert(msg, isOk = false) {
    alertBox.replaceChildren(
      h("p", { class: `notice ${isOk ? "notice--ok" : "notice--error"}` }, msg)
    );
    alertBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function clearAlert() {
    alertBox.replaceChildren();
  }

  function setMode(m) {
    mode = m;
    const isSignUp = mode === "signup";

    tabIn.setAttribute("aria-pressed", String(!isSignUp));
    tabUp.setAttribute("aria-pressed", String(isSignUp));

    if (isSignUp) {
      if (personalTitle) personalTitle.textContent = "Personal Info";
      if (rowPersonal1) rowPersonal1.style.display = "grid";
      if (rowPersonal2) {
        rowPersonal2.style.display = "grid";
        rowPersonal2.style.gridTemplateColumns = "";
      }
      if (rowPersonal3) {
        rowPersonal3.style.display = "grid";
        rowPersonal3.style.gridTemplateColumns = "";
      }
      if (colName) colName.style.display = "";
      if (colAddress) colAddress.style.display = "";
      if (colPhone) colPhone.style.display = "";
      if (colPassConfirm) colPassConfirm.style.display = "";

      if (boxBusiness) boxBusiness.style.display = "block";
      if (boxLegal) boxLegal.style.display = "block";
      if (btnReset) btnReset.style.display = "inline-flex";
      if (forgotWrap) forgotWrap.style.display = "none";

      btnSubmit.textContent = "Sign Up";
      inputPass.autocomplete = "new-password";
      heading.textContent = "CREATE ACCOUNT";
      subheading.textContent = "Create your client account to start a project, discuss requirements, and track milestones.";
    } else {
      if (personalTitle) personalTitle.textContent = "Account Credentials";
      if (rowPersonal1) rowPersonal1.style.display = "none";
      if (rowPersonal2) {
        rowPersonal2.style.display = "grid";
        rowPersonal2.style.gridTemplateColumns = "1fr";
      }
      if (rowPersonal3) {
        rowPersonal3.style.display = "grid";
        rowPersonal3.style.gridTemplateColumns = "1fr";
      }
      if (colPhone) colPhone.style.display = "none";
      if (colPassConfirm) colPassConfirm.style.display = "none";

      if (boxBusiness) boxBusiness.style.display = "none";
      if (boxLegal) boxLegal.style.display = "none";
      if (btnReset) btnReset.style.display = "none";
      if (forgotWrap) forgotWrap.style.display = "block";

      btnSubmit.textContent = "Sign In";
      inputPass.autocomplete = "current-password";
      heading.textContent = "SIGN IN";
      subheading.textContent = "Welcome back! Sign in to access your projects, messages, and settings.";
    }

    clearAlert();
  }

  tabIn.addEventListener("click", () => setMode("signin"));
  tabUp.addEventListener("click", () => setMode("signup"));

  // Reset button handler
  if (btnReset) {
    btnReset.addEventListener("click", () => {
      clearAlert();
      if (window.turnstile && turnstileWidgetId !== null) {
        try { window.turnstile.reset(turnstileWidgetId); } catch { /* ignore */ }
      }
    });
  }

  // Check initial mode
  setMode(mode);

  // Form submission
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearAlert();

    const emailVal = inputEmail.value.trim();
    const passVal = inputPass.value;

    if (mode === "signin") {
      if (!emailVal || !passVal) {
        showAlert("Please enter both your email address and password.");
        return;
      }
    } else {
      // Validate Sign Up inputs
      const nameVal = inputName.value.trim();
      const addressVal = inputAddress.value.trim();
      const phoneVal = inputPhone.value.trim();
      const passConfirmVal = inputPassConfirm.value;
      const dobVal = inputDob.value;

      if (!nameVal) {
        showAlert("Please enter your full legal name.");
        inputName.focus();
        return;
      }

      if (!addressVal) {
        showAlert("Please enter your address.");
        inputAddress.focus();
        return;
      }

      if (!emailVal) {
        showAlert("Please enter a valid email address.");
        inputEmail.focus();
        return;
      }

      if (!phoneVal) {
        showAlert("Please enter your phone number.");
        inputPhone.focus();
        return;
      }

      if (passVal.length < 8) {
        showAlert("Password must be at least 8 characters long.");
        inputPass.focus();
        return;
      }

      if (passVal !== passConfirmVal) {
        showAlert("Passwords do not match. Please re-enter your password in both fields.");
        inputPassConfirm.focus();
        return;
      }

      if (!dobVal) {
        showAlert("Please enter your date of birth.");
        inputDob.focus();
        return;
      }

      // Check age >= 18
      const dobDate = new Date(dobVal);
      const today = new Date();
      let calcAge = today.getFullYear() - dobDate.getFullYear();
      const monthDiff = today.getMonth() - dobDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dobDate.getDate())) {
        calcAge--;
      }
      if (calcAge < 18) {
        showAlert("You must be at least 18 years of age to register.");
        inputDob.focus();
        return;
      }

      if (!checkAge.checked) {
        showAlert("Please confirm that you are over 18 years of age.");
        checkAge.focus();
        return;
      }

      if (!checkPriv.checked) {
        showAlert("Please confirm that you agree to our Privacy Policy and Terms.");
        checkPriv.focus();
        return;
      }

      // Cloudflare Turnstile token check if active
      if (window.turnstile && turnstileWidgetId !== null) {
        const token = window.turnstile.getResponse(turnstileWidgetId);
        if (!token) {
          showAlert("Please complete the Cloudflare bot prevention check.");
          return;
        }
      }
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
        const addressVal = inputAddress.value.trim();
        const phoneVal = inputPhone.value.trim();
        const orgVal = inputBusinessOrg.value.trim();
        const bAddressVal = inputBusinessAddress.value.trim();
        const bPhoneVal = inputBusinessPhone.value.trim();
        const bTypeVal = inputBusinessType.value.trim();
        const bDesigVal = inputBusinessDesignation.value.trim();

        const profileData = {
          full_name: nameVal || undefined,
          phone: phoneVal || undefined,
          country: addressVal || undefined,
          profession: bDesigVal || bTypeVal || undefined,
          business: orgVal ? `${orgVal}${bAddressVal ? ` (${bAddressVal})` : ""}` : undefined,
        };

        if (nameVal) {
          await setUserProfile(cred.user, { displayName: nameVal }).catch(() => {});
        }
        await api("/profile", { method: "PUT", body: profileData, auth: true }).catch(() => {});
        await api("/auth/confirm-age", { method: "POST", body: { age_confirmed: true, privacy_accepted: true }, auth: true }).catch(() => {});

        showAlert("Account created successfully! Redirecting...", true);
        finishRedirect();
      }
    } catch (err) {
      showAlert(friendlyAuthError(err));
      btnSubmit.disabled = false;
      btnSubmit.textContent = mode === "signup" ? "Sign Up" : "Sign In";
      if (window.turnstile && turnstileWidgetId !== null) {
        try { window.turnstile.reset(turnstileWidgetId); } catch { /* ignore */ }
      }
    }
  });

  // Google sign in
  btnGoogle.addEventListener("click", async () => {
    clearAlert();
    if (mode === "signup" && (!checkAge.checked || !checkPriv.checked)) {
      showAlert("Please confirm you are over 18 and accept the Privacy Policy before continuing with Google.");
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
