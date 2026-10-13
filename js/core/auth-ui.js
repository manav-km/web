/**
 * auth-ui.js — nav auth state: [Sign In] when signed out; [bell][avatar] when signed in.
 * Bell sits directly LEFT of the profile picture (§23). Everything here is cosmetic:
 * the "Admin" link is only a convenience — /portfolio/admin data is protected by the backend.
 */
import { onAuth, logOut } from "./auth.js";
import { api, h, fmtDate, label } from "./api.js";
import { listenSignal } from "./rtdb.js";

let menu = null;

function whenNavReady(fn) {
  if (document.querySelector(".site-nav")) fn();
  else document.addEventListener("partials:ready", fn, { once: true });
}

whenNavReady(() => {
  const nav = document.querySelector(".site-nav");
  const signIn = nav.querySelector(".site-nav__signin");
  const bell = nav.querySelector(".site-nav__bell");
  const profile = nav.querySelector(".site-nav__profile");
  const dot = bell.querySelector(".unread-dot");
  let poll = null;
  let unsubSignal = null;

  const closeMenu = () => { menu?.remove(); menu = null; profile.setAttribute("aria-expanded", "false"); };

  async function loadNotifications() {
    try {
      const items = await api("/notifications", { auth: true });
      dot.style.display = items.some((n) => !n.is_read) ? "block" : "none";
      return items;
    } catch { return []; }
  }

  bell.addEventListener("click", async (e) => {
    e.stopPropagation();
    if (menu) return closeMenu();
    const items = await loadNotifications();
    menu = h("div", { class: "menu", role: "menu", "aria-label": "Notifications" },
      items.length ? items.slice(0, 8).map((n) =>
        h("button", { class: n.is_read ? "" : "menu__item--unread", role: "menuitem", onclick: async () => {
          await api(`/notifications/${n.id}/read`, { method: "PATCH", auth: true }).catch(() => {});
          closeMenu(); loadNotifications();
          if (["new_message", "request_status", "review_available"].includes(n.type)) location.href = "/frontend/pages/connect.html";
        } }, `${label(n.type)} · ${fmtDate(n.created_at)}`))
        : h("p", { class: "menu__note" }, "No notifications yet."));
    document.body.append(menu);
  });

  onAuth(async (user) => {
    clearInterval(poll); unsubSignal?.(); unsubSignal = null; closeMenu();
    if (!user) {
      signIn.classList.add("is-ready"); bell.classList.remove("is-ready"); profile.classList.remove("is-ready");
      return;
    }
    signIn.classList.remove("is-ready");
    bell.classList.add("is-ready"); profile.classList.add("is-ready");
    profile.textContent = (user.displayName || user.email || "?").trim().charAt(0).toUpperCase();
    if (user.photoURL) { profile.textContent = ""; profile.append(h("img", { src: user.photoURL, alt: "", width: 32, height: 32, referrerpolicy: "no-referrer" })); }

    let isAdmin = false;
    try { isAdmin = (await api("/auth/bootstrap", { method: "POST", auth: true })).is_admin; } catch { /* nav still works */ }
    window.__isAdmin = isAdmin;
    loadNotifications();
    unsubSignal?.(); unsubSignal = listenSignal(user.uid, () => loadNotifications());
    poll = setInterval(loadNotifications, 120000); // slow fallback poll in case a signal is ever missed

    profile.onclick = (e) => {
      e.stopPropagation();
      if (menu) return closeMenu();
      profile.setAttribute("aria-expanded", "true");
      menu = h("div", { class: "menu", role: "menu" },
        h("p", { class: "menu__note menu__note--muted" }, user.email),
        isAdmin ? h("a", { href: "/portfolio/admin", role: "menuitem" }, "Admin panel") : null,
        h("a", { href: "/frontend/pages/connect.html", role: "menuitem" }, "Connect / my request"),
        h("a", { href: "/frontend/pages/legal.html", role: "menuitem" }, "Terms & Conditions"),
        h("a", { href: "#", role: "menuitem", onclick: async (e) => {
          e.preventDefault();
          try {
            const data = await api("/profile/export", { auth: true });
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a"); a.href = url; a.download = "my-data.json"; a.click();
            URL.revokeObjectURL(url);
          } catch { alert("Could not export data. Please try again."); }
        } }, "Download my data"),
        h("button", { role: "menuitem", onclick: async () => {
          if (!confirm("Permanently delete your account and personal data? This cannot be undone.")) return;
          try {
            await api("/profile/account", { method: "DELETE", auth: true });
            await logOut();
            location.href = "/";
          } catch { alert("Could not delete account. Please try again."); }
        } }, "Delete my account"),
        h("button", { role: "menuitem", onclick: async () => { await logOut(); location.href = "/"; } }, "Sign out"));
      document.body.append(menu);
    };
  });

  document.addEventListener("click", closeMenu);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });
});
