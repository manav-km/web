/**
 * atmosphere.js — subtle mouse-reactive parallax on the background orbs.
 * Transform-only (no layout thrash), capped displacement, does nothing
 * under prefers-reduced-motion or on touch devices (no mouse to react to).
 */
(function () {
  "use strict";

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
  if (prefersReducedMotion || isCoarsePointer) return;

  const orbs = document.querySelectorAll(".atmosphere__orb");
  if (!orbs.length) return;

  const MAX_SHIFT = 24; // px — kept small so it stays atmospheric, not distracting

  window.addEventListener("mousemove", (e) => {
    const xRatio = e.clientX / window.innerWidth - 0.5;
    const yRatio = e.clientY / window.innerHeight - 0.5;
    orbs.forEach((orb, i) => {
      const direction = i % 2 === 0 ? 1 : -1;
      orb.style.transform = `translate(${xRatio * MAX_SHIFT * direction}px, ${yRatio * MAX_SHIFT * direction}px)`;
    });
  }, { passive: true });
})();
