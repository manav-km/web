/**
 * include.js — loads the shared nav/footer partials into every page.
 *
 * Why fetch() instead of duplicating markup on every page: this is a plain
 * multi-page site with no build step or templating engine, so a single
 * source of truth for the nav/footer avoids 8 copies drifting out of sync.
 * If fetch fails (offline, blocked), the page still works — it just shows
 * its own <noscript> fallback nav (see the markup in each page's <body>).
 */
(async function () {
  "use strict";

  const mounts = document.querySelectorAll("[data-include]");
  await Promise.all(
    Array.from(mounts).map(async (el) => {
      const name = el.getAttribute("data-include");
      try {
        const res = await fetch(`/shared/${name}.html`);
        if (!res.ok) throw new Error(`Failed to load ${name}`);
        el.innerHTML = await res.text();
      } catch (err) {
        console.warn(`[include.js] Could not load partial "${name}":`, err);
        // el keeps whatever <noscript>-safe fallback was already in the markup
      }
    })
  );

  document.dispatchEvent(new CustomEvent("partials:ready"));
  initNav();
})();

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
