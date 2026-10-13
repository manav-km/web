/**
 * cursor.js — custom cursor (desktop only).
 *
 * Security/usability notes:
 * - Never the only way to perceive interactivity — it's purely decorative.
 *   Real focus/hover states (see components.css) work with it disabled.
 * - Fully disabled on touch/coarse-pointer devices; no layout dependency
 *   on it existing.
 */
(function () {
  "use strict";

  const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (isCoarsePointer) return; // native cursor on touch devices, no DOM cost

  const dot = document.createElement("div");
  dot.id = "cursor-dot";
  dot.setAttribute("aria-hidden", "true");
  document.body.appendChild(dot);

  let targetX = window.innerWidth / 2;
  let targetY = window.innerHeight / 2;
  let currentX = targetX;
  let currentY = targetY;

  window.addEventListener("mousemove", (e) => {
    targetX = e.clientX;
    targetY = e.clientY;
  }, { passive: true });

  function raf() {
    // spring-lag toward the pointer for a refined feel rather than 1:1 tracking
    const ease = prefersReducedMotion ? 1 : 0.2;
    currentX += (targetX - currentX) * ease;
    currentY += (targetY - currentY) * ease;
    dot.style.transform = `translate(${currentX}px, ${currentY}px) translate(-50%, -50%)`;
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  const HOVER_SELECTOR = "a, button, input, select, textarea, [data-cursor-hover], .card";
  const DESTRUCTIVE_SELECTOR = "[data-cursor-glow='red']";

  document.addEventListener("mouseover", (e) => {
    const target = e.target.closest(HOVER_SELECTOR);
    if (!target) return;
    dot.classList.add("is-hovering");
    dot.classList.toggle("glow-red", Boolean(target.closest(DESTRUCTIVE_SELECTOR)));
  });

  document.addEventListener("mouseout", (e) => {
    const target = e.target.closest(HOVER_SELECTOR);
    if (!target) return;
    dot.classList.remove("is-hovering", "glow-red");
  });
})();
