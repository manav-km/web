/**
 * auth-ui.js — nav auth state: [Sign In] when signed out; [bell][avatar] when signed in.
 * Bell sits directly LEFT of the profile picture (§23). Everything here is cosmetic:
 * the "Admin" link is only a convenience — /portfolio/admin data is protected by the backend.
 */
import { onAuth, logOut } from "./auth.js";
import { api, h, fmtDate, label } from "./api.js";
import { listenSignal } from "./rtdb.js";

let menu = null;
let currentAuthUser = null;
let authReady = false;
let authReadyResolver;
const authReadyPromise = new Promise((resolve) => {
  authReadyResolver = resolve;
});

/**
 * Checks whether the user is logged in.
 * If signed in, lets them enter connect.html.
 * If not signed in, redirects them to auth.html.
 */
export async function handleConnectAccess(event) {
  if (event) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return; // Allow open in new tab / right click
    }
    event.preventDefault();
  }

  const user = authReady ? currentAuthUser : await authReadyPromise;
  if (user) {
    window.location.href = "/frontend/pages/connect.html";
  } else {
    window.location.href = "/frontend/pages/auth.html?redirect=" + encodeURIComponent("/frontend/pages/connect.html");
  }
}
window.handleConnectAccess = handleConnectAccess;

// Intercept all Connect clicks across any page
document.addEventListener("click", (e) => {
  const connectLink = e.target.closest('a[href*="connect.html"]');
  if (connectLink && !window.location.pathname.endsWith("connect.html")) {
    handleConnectAccess(e);
  }
});

function whenNavReady(fn) {
  if (document.querySelector(".site-nav")) {
    fn();
    return;
  }
  const handler = () => {
    if (document.querySelector(".site-nav")) {
      document.removeEventListener("partials:ready", handler);
      fn();
    }
  };
  document.addEventListener("partials:ready", handler);
  // Also poll shortly just in case partials:ready fired before listener registered
  const interval = setInterval(() => {
    if (document.querySelector(".site-nav")) {
      clearInterval(interval);
      document.removeEventListener("partials:ready", handler);
      fn();
    }
  }, 30);
  setTimeout(() => clearInterval(interval), 5000);
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
    currentAuthUser = user;
    if (!authReady) {
      authReady = true;
      authReadyResolver(user);
    }
    window.__authResolved = true;
    clearInterval(poll); unsubSignal?.(); unsubSignal = null; closeMenu();
    const links = nav.querySelector(".site-nav__links");
    const existingAdmin = links?.querySelector(".nav-admin-item");

    if (!user) {
      signIn.classList.add("is-ready");
      signIn.style.display = "inline-flex";
      bell.classList.remove("is-ready");
      bell.style.display = "none";
      profile.classList.remove("is-ready");
      profile.style.display = "none";
      existingAdmin?.remove();
      return;
    }

    signIn.classList.remove("is-ready");
    signIn.style.display = "none";
    bell.classList.add("is-ready");
    bell.style.display = "inline-flex";
    profile.classList.add("is-ready");
    profile.style.display = "inline-grid";
    profile.setAttribute("title", "My Profile & Settings");

    profile.textContent = "";
    if (user.photoURL) {
      profile.append(h("img", { src: user.photoURL, alt: user.displayName || "Avatar", referrerpolicy: "no-referrer" }));
    } else {
      profile.textContent = (user.displayName || user.email || "?").trim().charAt(0).toUpperCase();
    }

    let isAdmin = false;
    try {
      isAdmin = (await api("/auth/bootstrap", { method: "POST", auth: true })).is_admin;
    } catch { /* nav still works */ }
    if (user.email === "manavkmlko@gmail.com") isAdmin = true;
    window.__isAdmin = isAdmin;

    if (isAdmin && links && !links.querySelector(".nav-admin-item")) {
      const li = h("li", { class: "nav-admin-item" },
        h("a", { href: "/portfolio/admin", class: "nav-admin-badge" }, "Admin")
      );
      links.appendChild(li);
    }

    loadNotifications();
    unsubSignal?.(); unsubSignal = listenSignal(user.uid, () => loadNotifications());
    poll = setInterval(loadNotifications, 120000); // slow fallback poll in case a signal is ever missed

    // User requested clicking PFP redirects directly to profile settings page
    profile.onclick = (e) => {
      e.stopPropagation();
      window.location.href = "/frontend/pages/profile.html";
    };
  });

  document.addEventListener("click", closeMenu);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });
});
