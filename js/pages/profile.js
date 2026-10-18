import { onAuth, logOut, setUserProfile } from "../core/auth.js";
import { api, h } from "../core/api.js";

const gate = document.getElementById("profile-auth-gate");
const content = document.getElementById("profile-content");

const avatarDisplay = document.getElementById("profile-avatar-display");
const avatarTrigger = document.getElementById("profile-avatar-trigger");
const nameHeader = document.getElementById("profile-name-header");
const emailHeader = document.getElementById("profile-email-header");
const metaHeader = document.getElementById("profile-meta-header");
const adminBadge = document.getElementById("profile-admin-badge");

const form = document.getElementById("profile-form");

// Personal Info
const fullNameInput = document.getElementById("p-full-name");
const addressInput = document.getElementById("p-address");
const emailInput = document.getElementById("p-email");
const phoneInput = document.getElementById("p-phone");
const passInput = document.getElementById("p-pass");
const passConfirmInput = document.getElementById("p-pass-confirm");

// Profile Picture Upload
const avatarBrowseBtn = document.getElementById("p-avatar-browse-btn");
const avatarRemoveBtn = document.getElementById("p-avatar-remove-btn");
const avatarFileInput = document.getElementById("p-avatar-file");
const avatarUploadStatus = document.getElementById("p-avatar-upload-status");
const avatarUrlInput = document.getElementById("p-avatar-url");

// Business Info
const bizOrgInput = document.getElementById("p-business-org");
const bizAddressInput = document.getElementById("p-business-address");
const bizEmailInput = document.getElementById("p-business-email");
const bizPhoneInput = document.getElementById("p-business-phone");
const bizTypeInput = document.getElementById("p-business-type");
const bizDesigInput = document.getElementById("p-business-designation");

// Legal & Privacy Info
const dobInput = document.getElementById("p-dob");
const dobLabel = document.getElementById("p-dob-label");
const dobHint = document.getElementById("p-dob-hint");
const ageConfirmedCheck = document.getElementById("p-age-confirmed");
const privacyConfirmedCheck = document.getElementById("p-privacy-confirmed");

const statusMsg = document.getElementById("profile-status-msg");
const saveBtn = document.getElementById("profile-save-btn");

const exportBtn = document.getElementById("profile-export-btn");
const logoutBtn = document.getElementById("profile-logout-btn");
const deleteBtn = document.getElementById("profile-delete-btn");

function showMsg(text, isOk = false) {
  statusMsg.replaceChildren(
    h("p", { class: `notice ${isOk ? "notice--ok" : "notice--error"}` }, text)
  );
  statusMsg.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function setAvatar(url, fallbackInitial) {
  avatarDisplay.textContent = "";
  if (url) {
    avatarDisplay.appendChild(h("img", {
      src: url,
      alt: "Avatar",
      referrerpolicy: "no-referrer"
    }));
    if (avatarRemoveBtn) avatarRemoveBtn.style.display = "inline-flex";
  } else {
    avatarDisplay.textContent = (fallbackInitial || "?").trim().charAt(0).toUpperCase();
    if (avatarRemoveBtn) avatarRemoveBtn.style.display = "none";
  }
}

function applyDobState(dobValue) {
  if (!dobInput) return;
  dobInput.disabled = false;
  dobInput.readOnly = false;
  dobInput.style.opacity = "1";
  dobInput.style.cursor = "default";
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  dobInput.setAttribute("min", "1900-01-01");
  dobInput.setAttribute("max", todayStr);

  const onDobClick = () => {
    if (!dobInput.value) {
      dobInput.value = todayStr;
    }
  };
  dobInput.removeEventListener("click", onDobClick);
  dobInput.removeEventListener("focus", onDobClick);
  dobInput.addEventListener("click", onDobClick);
  dobInput.addEventListener("focus", onDobClick);

  if (dobValue) {
    dobInput.value = dobValue;
  }
}

onAuth(async (user) => {
  if (!user) {
    if (gate) gate.style.display = "block";
    if (content) content.style.display = "none";
    return;
  }

  if (gate) gate.style.display = "none";
  if (content) content.style.display = "block";

  // Render header
  emailHeader.textContent = user.email || "";
  nameHeader.textContent = user.displayName || "Account Profile";
  if (user.metadata?.creationTime) {
    metaHeader.textContent = `Member since ${new Date(user.metadata.creationTime).toLocaleDateString()}`;
  }

  // Pre-fill email (always readonly/uneditable)
  if (emailInput) {
    emailInput.value = user.email || "";
  }
  if (fullNameInput && !fullNameInput.value) {
    fullNameInput.value = user.displayName || "";
  }
  if (avatarUrlInput && !avatarUrlInput.value) {
    avatarUrlInput.value = user.photoURL || "";
  }

  setAvatar(user.photoURL, user.displayName || user.email);

  // Check admin
  const isOwner = user.email && user.email.toLowerCase() === "manavkmlko@gmail.com";
  let isAdmin = isOwner;
  try {
    const bootstrapRes = await api("/auth/bootstrap", { method: "POST", auth: true });
    if (bootstrapRes?.is_admin) isAdmin = true;
  } catch { /* ignore */ }

  if (isAdmin && adminBadge) {
    adminBadge.style.display = "inline-block";
  }

  // File Upload Handlers (from computer)
  if (avatarBrowseBtn && avatarFileInput) {
    avatarBrowseBtn.onclick = () => avatarFileInput.click();
  }
  if (avatarTrigger && avatarFileInput) {
    avatarTrigger.onclick = () => avatarFileInput.click();
  }

  if (avatarFileInput) {
    avatarFileInput.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const validMimes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
      if (!validMimes.includes(file.type)) {
        if (avatarUploadStatus) {
          avatarUploadStatus.textContent = "Please select a PNG, JPG, or WebP image.";
          avatarUploadStatus.style.color = "var(--status-danger)";
        }
        return;
      }

      if (file.size > 2 * 1024 * 1024) {
        if (avatarUploadStatus) {
          avatarUploadStatus.textContent = "Image is larger than 2 MB. Please choose a smaller image.";
          avatarUploadStatus.style.color = "var(--status-danger)";
        }
        return;
      }

      // Live local preview immediately
      const localUrl = URL.createObjectURL(file);
      setAvatar(localUrl, fullNameInput.value || user.email);

      // Upload to Supabase Storage via backend signed URL
      if (avatarUploadStatus) {
        avatarUploadStatus.textContent = "Uploading image...";
        avatarUploadStatus.style.color = "var(--fg-muted)";
      }
      if (avatarBrowseBtn) avatarBrowseBtn.disabled = true;

      try {
        const creds = await api("/profile/avatar-upload-url", {
          method: "POST",
          body: { content_type: file.type, size: file.size },
          auth: true,
        });

        const targetUrl = creds.signed_url || creds.signedURL || creds.url;
        if (!targetUrl) throw new Error("Could not acquire upload destination.");

        const uploadRes = await fetch(targetUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });

        if (!uploadRes.ok) {
          throw new Error(`Upload failed with status ${uploadRes.status}`);
        }

        avatarUrlInput.value = creds.public_url;
        if (avatarUploadStatus) {
          avatarUploadStatus.textContent = "Photo uploaded! Click 'Save Changes' to apply.";
          avatarUploadStatus.style.color = "var(--status-success)";
        }
        if (avatarRemoveBtn) avatarRemoveBtn.style.display = "inline-flex";
      } catch (err) {
        console.warn("Avatar upload failed:", err);
        if (avatarUploadStatus) {
          avatarUploadStatus.textContent = "Upload failed: " + (err.message || "server error");
          avatarUploadStatus.style.color = "var(--status-danger)";
        }
      } finally {
        if (avatarBrowseBtn) avatarBrowseBtn.disabled = false;
        avatarFileInput.value = "";
      }
    };
  }

  if (avatarRemoveBtn) {
    avatarRemoveBtn.onclick = () => {
      avatarUrlInput.value = "";
      setAvatar("", fullNameInput.value || user.email);
      avatarRemoveBtn.style.display = "none";
      if (avatarUploadStatus) {
        avatarUploadStatus.textContent = "Picture removed. Click 'Save Changes' to apply.";
        avatarUploadStatus.style.color = "var(--fg-muted)";
      }
    };
  }

  // Try loading local cached data first for instant display
  let cachedData = null;
  try {
    const stored = localStorage.getItem(`user_profile_data_${user.uid}`);
    if (stored) cachedData = JSON.parse(stored);
  } catch (_) {}

  if (cachedData) {
    populateFields(cachedData, user);
  }

  // Load existing profile from backend
  try {
    const profile = await api("/profile", { auth: true });
    if (profile) {
      populateFields(profile, user);
      try {
        const merged = Object.assign({}, cachedData || {}, profile);
        localStorage.setItem(`user_profile_data_${user.uid}`, JSON.stringify(merged));
      } catch (_) {}
    }
  } catch (err) {
    console.warn("Could not load backend profile:", err);
  }

  function populateFields(data, authUser) {
    if (data.email || authUser.email) {
      emailInput.value = data.email || authUser.email;
    }
    if (data.full_name || authUser.displayName) {
      const name = data.full_name || authUser.displayName;
      fullNameInput.value = name;
      nameHeader.textContent = name;
    }
    if (data.address || data.country) {
      addressInput.value = data.address || data.country;
    }
    if (data.phone) {
      phoneInput.value = data.phone;
    }
    if (data.business_org || data.business) {
      bizOrgInput.value = data.business_org || data.business;
    }
    if (data.business_address) {
      bizAddressInput.value = data.business_address;
    }
    if (data.business_email) {
      bizEmailInput.value = data.business_email;
    }
    if (data.business_phone) {
      bizPhoneInput.value = data.business_phone;
    }
    if (data.business_type) {
      bizTypeInput.value = data.business_type;
    }
    if (data.business_designation || data.profession) {
      bizDesigInput.value = data.business_designation || data.profession;
    }
    const currentAvatar = data.avatar_url || authUser.photoURL;
    if (currentAvatar) {
      avatarUrlInput.value = currentAvatar;
      setAvatar(currentAvatar, fullNameInput.value || authUser.email);
    }
    // Date of Birth: set value and allow full editing
    applyDobState(data.dob);

    // Legal & Privacy checkboxes
    if (ageConfirmedCheck) {
      ageConfirmedCheck.checked = data.age_confirmed !== undefined ? Boolean(data.age_confirmed) : true;
    }
    if (privacyConfirmedCheck) {
      privacyConfirmedCheck.checked = data.privacy_accepted !== undefined ? Boolean(data.privacy_accepted) : true;
    }
  }

  // Handle form submission
  form.onsubmit = async (e) => {
    e.preventDefault();
    saveBtn.disabled = true;
    statusMsg.replaceChildren();

    // Check age confirmation and privacy acceptance checkboxes
    if (ageConfirmedCheck && !ageConfirmedCheck.checked) {
      showMsg("Please confirm that you are at least 18 years of age.");
      saveBtn.disabled = false;
      ageConfirmedCheck.focus();
      return;
    }
    if (privacyConfirmedCheck && !privacyConfirmedCheck.checked) {
      showMsg("Please agree to the Privacy Policy & Terms.");
      saveBtn.disabled = false;
      privacyConfirmedCheck.focus();
      return;
    }

    // If DOB is entered, check 18+ requirement
    if (dobInput && dobInput.value) {
      const dobDate = new Date(dobInput.value);
      const today = new Date();
      let calcAge = today.getFullYear() - dobDate.getFullYear();
      const monthDiff = today.getMonth() - dobDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dobDate.getDate())) {
        calcAge--;
      }
      if (calcAge < 18) {
        showMsg("You must be at least 18 years of age based on the date of birth provided.");
        saveBtn.disabled = false;
        dobInput.focus();
        return;
      }
    }

    // Optional password change validation
    const newPass = passInput ? passInput.value : "";
    const newPassConfirm = passConfirmInput ? passConfirmInput.value : "";
    if (newPass || newPassConfirm) {
      if (newPass.length < 8) {
        showMsg("New password must be at least 8 characters long.");
        saveBtn.disabled = false;
        passInput?.focus();
        return;
      }
      if (newPass !== newPassConfirm) {
        showMsg("New password and confirmation do not match.");
        saveBtn.disabled = false;
        passConfirmInput?.focus();
        return;
      }
    }

    const payload = {
      email: emailInput.value.trim() || null,
      full_name: fullNameInput.value.trim() || null,
      address: addressInput.value.trim() || null,
      phone: phoneInput.value.trim() || null,
      avatar_url: avatarUrlInput.value.trim() || null,
      business_org: bizOrgInput.value.trim() || null,
      business_address: bizAddressInput.value.trim() || null,
      business_email: bizEmailInput.value.trim() || null,
      business_phone: bizPhoneInput.value.trim() || null,
      business_type: bizTypeInput.value.trim() || null,
      business_designation: bizDesigInput.value.trim() || null,
      dob: dobInput ? (dobInput.value || null) : null,
      age_confirmed: ageConfirmedCheck ? ageConfirmedCheck.checked : true,
      privacy_accepted: privacyConfirmedCheck ? privacyConfirmedCheck.checked : true,
    };

    try {
      const updated = await api("/profile", {
        method: "PUT",
        body: payload,
        auth: true,
      });

      // Update Firebase auth user profile so nav and avatar immediately reflect changes
      const newName = fullNameInput.value.trim();
      const newPic = avatarUrlInput.value.trim();
      await setUserProfile(user, {
        displayName: newName || user.displayName,
        photoURL: newPic || null,
      }).catch(() => {});

      if (newName) nameHeader.textContent = newName;
      if (payload.email) emailHeader.textContent = payload.email;
      setAvatar(newPic, newName || user.email);

      // Persist to local storage
      try {
        const stored = localStorage.getItem(`user_profile_data_${user.uid}`);
        const currentCached = stored ? JSON.parse(stored) : {};
        const merged = Object.assign({}, currentCached, payload, updated);
        localStorage.setItem(`user_profile_data_${user.uid}`, JSON.stringify(merged));
      } catch (_) {}

      if (passInput) passInput.value = "";
      if (passConfirmInput) passConfirmInput.value = "";

      showMsg("Profile details saved successfully!", true);
      if (avatarUploadStatus) avatarUploadStatus.textContent = "";
    } catch (err) {
      showMsg(err.message || "Could not save profile. Please try again.");
    } finally {
      saveBtn.disabled = false;
    }
  };

  // Export data
  exportBtn.onclick = async () => {
    exportBtn.disabled = true;
    try {
      const data = await api("/profile/export", { auth: true });
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `my-data-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Could not export data. Please try again.");
    } finally {
      exportBtn.disabled = false;
    }
  };

  // Log out
  logoutBtn.onclick = async () => {
    await logOut();
    window.location.href = "/";
  };

  // Delete account
  deleteBtn.onclick = async () => {
    const confirmed = confirm(
      "Are you sure you want to permanently delete your account and personal data? This action cannot be undone."
    );
    if (!confirmed) return;

    deleteBtn.disabled = true;
    try {
      await api("/profile/account", { method: "DELETE", auth: true });
      try { localStorage.removeItem(`user_profile_data_${user.uid}`); } catch (_) {}
      await logOut();
      window.location.href = "/";
    } catch {
      alert("Could not delete account. Please try again later.");
      deleteBtn.disabled = false;
    }
  };

  // Support direct hash navigation from footer (#data, #delete)
  function handleHash() {
    const hash = window.location.hash.toLowerCase();
    if (hash === "#data" || hash === "#download") {
      exportBtn?.scrollIntoView({ behavior: "smooth", block: "center" });
      exportBtn?.focus();
    } else if (hash === "#delete" || hash === "#danger") {
      deleteBtn?.scrollIntoView({ behavior: "smooth", block: "center" });
      deleteBtn?.focus();
    }
  }

  setTimeout(handleHash, 250);
  window.addEventListener("hashchange", handleHash);
});
