/**
 * transitions.js — polished MPA navigation without becoming an SPA.
 *
 * Every link still does a real navigation (a real GET request to a real
 * URL) — this only smooths the visual handoff. If JS fails to load, plain
 * <a href> navigation still works with zero dependency on this file.
 */
(function () {
  "use strict";

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const supportsViewTransitions = "startViewTransition" in document;

  // Fade the page in on load (covers both the VT-supported and fallback paths)
  document.documentElement.classList.add("page-enter");
  requestAnimationFrame(() => {
    document.documentElement.classList.add("page-enter-active");
  });

  if (prefersReducedMotion) return; // instant navigation, no intercept needed

  document.addEventListener("click", (e) => {
    const link = e.target.closest("a");
    if (!link) return;

    const isInternal = link.origin === window.location.origin;
    const isSamePage = link.href === window.location.href;
    const opensNewTab = link.target === "_blank" || e.metaKey || e.ctrlKey || e.shiftKey;

    if (!isInternal || isSamePage || opensNewTab) return;

    e.preventDefault();
    const destination = link.href;

    if (supportsViewTransitions) {
      document.startViewTransition(() => {
        window.location.href = destination;
      });
      return;
    }

    // CSS fallback: fade out, then navigate
    document.documentElement.classList.add("page-exit-active");
    setTimeout(() => {
      window.location.href = destination;
    }, 180);
  });
})();
