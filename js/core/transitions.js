/**
 * transitions.js — polished MPA navigation without becoming an SPA.
 *
 * Every link still does a real navigation (a real GET request to a real
 * URL) — this only smooths the visual handoff. If JS fails to load, plain
 * <a href> navigation still works with zero dependency on this file.
 */
(function () {
  "use strict";

  // Smooth entrance transition on page load
  document.documentElement.classList.add("page-enter");
  requestAnimationFrame(() => {
    document.documentElement.classList.add("page-enter-active");
  });
})();
