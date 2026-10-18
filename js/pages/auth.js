/**
 * auth.js (page script) — Handles authentication logic on the dedicated /frontend/pages/auth.html page.
 * Formatted with neat multi-box sections: Box 1 (Personal Info), Box 2 (Business Info), Box 3 (Legal & Privacy).
 */
import {
  signIn, signUp, signInGoogle,
  resetPassword, friendlyAuthError, setUserProfile
} from "../core/auth.js";
import { api, h } from "../core/api.js";
import { TURNSTILE_SITE_KEY } from "../core/config.js";

(function () {
  "use strict";

  const tabIn = document.getElementById("tab-signin");
  const tabUp = document.getElementById("tab-signup");
  const form = document.getElementById("auth-form");
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

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  function calculateAge(dobStr) {
    if (!dobStr) return 0;
    const parts = dobStr.split("-").map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return 0;
    const [y, m, d] = parts;
    const today = new Date();
    let age = today.getFullYear() - y;
    const monthDiff = (today.getMonth() + 1) - m;
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < d)) {
      age--;
    }
    return age;
  }

  // DOB date picker: allow selecting year from 1900-01-01 up to current date
  if (inputDob) {
    inputDob.setAttribute("min", "1900-01-01");
    inputDob.setAttribute("max", todayStr);

    const onDobClick = () => {
      if (!inputDob.value) {
        inputDob.value = todayStr;
      }
    };
    inputDob.addEventListener("click", onDobClick);
    inputDob.addEventListener("focus", onDobClick);

    inputDob.addEventListener("change", () => {
      if (checkAge && checkAge.checked && inputDob.value) {
        if (calculateAge(inputDob.value) < 18) {
          checkAge.checked = false;
          showAlert("Based on the date of birth entered, you must be at least 18 years of age to register.");
        } else {
          clearAlert();
        }
      }
    });
  }

  // Require DOB before confirming 18+
  if (checkAge) {
    checkAge.addEventListener("click", (e) => {
      if (checkAge.checked) {
        if (!inputDob || !inputDob.value) {
          e.preventDefault();
          checkAge.checked = false;
          showAlert("Please enter your date of birth first before confirming you are over 18.");
          if (inputDob) {
            inputDob.focus();
            try { inputDob.showPicker(); } catch (_) {}
          }
          return;
        }

        const age = calculateAge(inputDob.value);
        if (age < 18) {
          e.preventDefault();
          checkAge.checked = false;
          showAlert("Based on the date of birth entered, you must be at least 18 years of age to register.");
          inputDob.focus();
          return;
        }

        clearAlert();
      }
    });
  }

  // Cloudflare Turnstile mount
  let turnstileWidgetId = null;
  let turnstileToken = null;
  let turnstileFailed = false;

  function mountTurnstile() {
    if (!turnstileContainer) return;
    const tryRender = () => {
      if (!window.turnstile) return setTimeout(tryRender, 150);
      if (turnstileWidgetId !== null) return;
      try {
        turnstileWidgetId = window.turnstile.render(turnstileContainer, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: "dark",
          callback: (token) => {
            turnstileToken = token;
          },
          "error-callback": (code) => {
            console.warn("Turnstile error code:", code);
            turnstileFailed = true;
          },
          "expired-callback": () => {
            turnstileToken = null;
          },
        });
      } catch (err) {
        console.warn("Turnstile render error:", err);
        turnstileFailed = true;
      }
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
      turnstileToken = null;
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

      // Cloudflare Turnstile token check if active & rendered without error
      if (window.turnstile && turnstileWidgetId !== null && !turnstileFailed) {
        const token = turnstileToken || window.turnstile.getResponse(turnstileWidgetId);
        if (!token) {
          showAlert("Please complete the Cloudflare verification check.");
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
          address: addressVal || undefined,
          business_org: orgVal || undefined,
          business_address: bAddressVal || undefined,
          business_email: inputBusinessEmail.value.trim() || undefined,
          business_phone: bPhoneVal || undefined,
          business_type: bTypeVal || undefined,
          business_designation: bDesigVal || undefined,
          dob: inputDob.value || undefined,
          age_confirmed: true,
          privacy_accepted: true,
        };

        if (nameVal) {
          await setUserProfile(cred.user, { displayName: nameVal }).catch(() => {});
        }
        await api("/profile", { method: "PUT", body: profileData, auth: true }).catch(() => {});
        await api("/auth/confirm-age", { method: "POST", body: { age_confirmed: true, privacy_accepted: true }, auth: true }).catch(() => {});
        try {
          localStorage.setItem(`user_profile_data_${cred.user.uid}`, JSON.stringify(profileData));
        } catch (_) {}

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

  // Google sign-in
  if (btnGoogle) {
    btnGoogle.addEventListener("click", async () => {
      clearAlert();
      if (mode === "signup") {
        const dobVal = inputDob ? inputDob.value : "";
        if (!dobVal) {
          showAlert("Please enter your date of birth before continuing with Google sign-up.");
          if (inputDob) {
            inputDob.focus();
            try { inputDob.showPicker(); } catch (_) {}
          }
          return;
        }

        const age = calculateAge(dobVal);
        if (age < 18) {
          showAlert("You must be at least 18 years of age to register.");
          if (inputDob) inputDob.focus();
          return;
        }

        if (!checkAge.checked) {
          showAlert("Please confirm you are over 18 before continuing with Google sign-up.");
          checkAge.focus();
          return;
        }

        if (!checkPriv.checked) {
          showAlert("Please confirm you agree to our Privacy Policy and Terms before continuing with Google sign-up.");
          checkPriv.focus();
          return;
        }
      }

      try {
        const cred = await signInGoogle();
        if (mode === "signup") {
          const profileData = {
            full_name: (inputName?.value.trim()) || cred.user.displayName || undefined,
            dob: inputDob.value || undefined,
            age_confirmed: true,
            privacy_accepted: true,
          };
          if (inputAddress?.value.trim()) profileData.address = inputAddress.value.trim();
          if (inputPhone?.value.trim()) profileData.phone = inputPhone.value.trim();
          if (inputBusinessOrg?.value.trim()) profileData.business_org = inputBusinessOrg.value.trim();
          if (inputBusinessAddress?.value.trim()) profileData.business_address = inputBusinessAddress.value.trim();
          if (inputBusinessEmail?.value.trim()) profileData.business_email = inputBusinessEmail.value.trim();
          if (inputBusinessPhone?.value.trim()) profileData.business_phone = inputBusinessPhone.value.trim();
          if (inputBusinessType?.value.trim()) profileData.business_type = inputBusinessType.value.trim();
          if (inputBusinessDesignation?.value.trim()) profileData.business_designation = inputBusinessDesignation.value.trim();

          await api("/profile", { method: "PUT", body: profileData, auth: true }).catch(() => {});
          await api("/auth/confirm-age", { method: "POST", body: { age_confirmed: true, privacy_accepted: true }, auth: true }).catch(() => {});
          try {
            localStorage.setItem(`user_profile_data_${cred.user.uid}`, JSON.stringify(profileData));
          } catch (_) {}
        }
        showAlert("Signed in with Google! Redirecting...", true);
        finishRedirect();
      } catch (err) {
        showAlert(friendlyAuthError(err));
      }
    });
  }

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

})();
