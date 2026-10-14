import { onAuth, logOut } from "../core/auth.js";
import { api, h } from "../core/api.js";

const gate = document.getElementById("profile-auth-gate");
const content = document.getElementById("profile-content");

const avatarDisplay = document.getElementById("profile-avatar-display");
const nameHeader = document.getElementById("profile-name-header");
const emailHeader = document.getElementById("profile-email-header");
const metaHeader = document.getElementById("profile-meta-header");
const adminBadge = document.getElementById("profile-admin-badge");

const form = document.getElementById("profile-form");
const fullNameInput = document.getElementById("p-full-name");
const phoneInput = document.getElementById("p-phone");
const countryInput = document.getElementById("p-country");
const professionInput = document.getElementById("p-profession");
const businessInput = document.getElementById("p-business");
const avatarUrlInput = document.getElementById("p-avatar-url");
const statusMsg = document.getElementById("profile-status-msg");
const saveBtn = document.getElementById("profile-save-btn");

const exportBtn = document.getElementById("profile-export-btn");
const logoutBtn = document.getElementById("profile-logout-btn");
const deleteBtn = document.getElementById("profile-delete-btn");

function showMsg(text, isOk = false) {
  statusMsg.replaceChildren(
    h("p", { class: `notice ${isOk ? "notice--ok" : "notice--error"}` }, text)
  );
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

  function setAvatar(url, fallbackInitial) {
    avatarDisplay.textContent = "";
    if (url) {
      avatarDisplay.appendChild(h("img", {
        src: url,
        alt: "Avatar",
        referrerpolicy: "no-referrer"
      }));
    } else {
      avatarDisplay.textContent = (fallbackInitial || "?").trim().charAt(0).toUpperCase();
    }
  }

  setAvatar(user.photoURL, user.displayName || user.email);

  // Check admin
  let isAdmin = false;
  try {
    isAdmin = (await api("/auth/bootstrap", { method: "POST", auth: true })).is_admin;
  } catch { /* ignore */ }
  if (user.email === "manavkmlko@gmail.com") isAdmin = true;
  if (isAdmin && adminBadge) {
    adminBadge.style.display = "inline-block";
  }

  // Load existing profile from backend
  try {
    const profile = await api("/profile", { auth: true });
    if (profile) {
      if (profile.full_name) {
        fullNameInput.value = profile.full_name;
        nameHeader.textContent = profile.full_name;
      }
      if (profile.phone) phoneInput.value = profile.phone;
      if (profile.country) countryInput.value = profile.country;
      if (profile.profession) professionInput.value = profile.profession;
      if (profile.business) businessInput.value = profile.business;
      if (profile.avatar_url) {
        avatarUrlInput.value = profile.avatar_url;
        setAvatar(profile.avatar_url, profile.full_name || user.email);
      }
    }
  } catch (err) {
    console.warn("Could not load backend profile:", err);
  }

  // Handle form submission
  form.onsubmit = async (e) => {
    e.preventDefault();
    saveBtn.disabled = true;
    statusMsg.replaceChildren();

    const payload = {
      full_name: fullNameInput.value.trim() || null,
      phone: phoneInput.value.trim() || null,
      country: countryInput.value.trim() || null,
      profession: professionInput.value.trim() || null,
      business: businessInput.value.trim() || null,
      avatar_url: avatarUrlInput.value.trim() || null,
    };

    try {
      const updated = await api("/profile", {
        method: "PUT",
        body: payload,
        auth: true,
      });

      if (updated.full_name) nameHeader.textContent = updated.full_name;
      if (updated.avatar_url) {
        setAvatar(updated.avatar_url, updated.full_name || user.email);
      }
      showMsg("Profile details saved successfully!", true);
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
