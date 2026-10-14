/**
 * atmosphere.js — subtle mouse-reactive parallax on the background orbs.
 * Transform-only (no layout thrash), capped displacement, does nothing
 * under prefers-reduced-motion or on touch devices (no mouse to react to).
 */
(function () {
  "use strict";

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion) return;

  const orbs = document.querySelectorAll(".atmosphere__orb");
  if (!orbs.length) return;

  const MAX_SHIFT = 40; // px displacement for tangible, atmospheric depth
  let targetX = 0;
  let targetY = 0;
  let currentX = 0;
  let currentY = 0;
  let rafId = null;

  function update() {
    currentX += (targetX - currentX) * 0.08;
    currentY += (targetY - currentY) * 0.08;

    orbs.forEach((orb, i) => {
      const dir = i % 2 === 0 ? 1 : -1;
      orb.style.setProperty("--shift-x", `${(currentX * dir).toFixed(2)}px`);
      orb.style.setProperty("--shift-y", `${(currentY * dir).toFixed(2)}px`);
    });

    if (Math.abs(targetX - currentX) > 0.05 || Math.abs(targetY - currentY) > 0.05) {
      rafId = requestAnimationFrame(update);
    } else {
      rafId = null;
    }
  }

  window.addEventListener("mousemove", (e) => {
    targetX = (e.clientX / window.innerWidth - 0.5) * MAX_SHIFT;
    targetY = (e.clientY / window.innerHeight - 0.5) * MAX_SHIFT;

    if (!rafId) {
      rafId = requestAnimationFrame(update);
    }
  }, { passive: true });
})();
