/**
 * include.js — loads and caches shared nav/footer partials into every page.
 * Caches in sessionStorage for zero-latency instant transitions between pages.
 */
(async function () {
  "use strict";

  const mounts = document.querySelectorAll("[data-include]");
  await Promise.all(
    Array.from(mounts).map(async (el) => {
      const name = el.getAttribute("data-include");
      const cacheKey = `partial_${name}`;
      try {
        let html = null;
        try {
          html = sessionStorage.getItem(cacheKey);
        } catch (_) {}

        if (!html) {
          const res = await fetch(`/shared/${name}.html`);
          if (!res.ok) throw new Error(`Failed to load ${name}`);
          html = await res.text();
          try {
            sessionStorage.setItem(cacheKey, html);
          } catch (_) {}
        }
        el.innerHTML = html;
      } catch (err) {
        console.warn(`[include.js] Could not load partial "${name}":`, err);
      }
    })
  );

  // Auto-set footer year without needing separate script
  const footerYear = document.getElementById("footer-year");
  if (footerYear) {
    footerYear.textContent = new Date().getFullYear();
  }

  document.dispatchEvent(new CustomEvent("partials:ready"));
  initNav();
})();

// Flag when a visitor navigates to the home page via the navbar
document.addEventListener("click", (e) => {
  const a = e.target.closest(".site-nav a");
  if (!a) return;
  try {
    const url = new URL(a.href, window.location.origin);
    if (url.pathname === "/" || url.pathname === "/index.html") {
      sessionStorage.setItem("entered_via_navbar", "true");
    }
  } catch (_) {}
}, true);

function initNav() {
  const nav = document.querySelector(".site-nav");
  if (!nav) return;

  // Mark the current page's nav link for styling + screen readers
  const current = nav.querySelector(`a[href="${window.location.pathname}"]`);
  if (current) current.setAttribute("aria-current", "page");

  // Mobile menu toggle
  const toggle = nav.querySelector(".site-nav__menu-toggle");
  const links = nav.querySelector(".site-nav__links");
  if (toggle && links) {
    toggle.addEventListener("click", () => {
      const isOpen = links.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(isOpen));
    });
  }

  // Auth-state UI: default to showing Sign In button until auth-ui resolves
  const signIn = nav.querySelector(".site-nav__signin");
  if (signIn && !window.__authResolved) {
    signIn.classList.add("is-ready");
    signIn.style.display = "inline-flex";
  }
}
