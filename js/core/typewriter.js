/**
 * typewriter.js — cycles through key roles and areas under the hero name
 * with a realistic mechanical typewriter effect, cursor blink, and accessible fallback.
 */
(function () {
  "use strict";

  const target = document.getElementById("hero-typewriter");
  if (!target) return;

  const phrases = [
    "Web Development",
    "PC Applications & Software",
    "AI & Automation Systems",
    "Robotics & Hardware",
    "APIs & Backend Architecture"
  ];

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // For users who prefer reduced motion, just show the primary title statically
  if (prefersReducedMotion) {
    target.textContent = phrases[0];
    return;
  }

  let phraseIndex = 0;
  let charIndex = phrases[0].length; // Start with full initial text "Web Development"
  let isDeleting = true;             // First transition is deleting after initial pause
  let timerId = null;
  let started = false;

  function tick() {
    clearTimeout(timerId);
    const currentPhrase = phrases[phraseIndex];
    let speed = 95;

    if (isDeleting) {
      charIndex--;
      target.textContent = currentPhrase.substring(0, charIndex);
      speed = 50; // steady, clean deletion pace
    } else {
      charIndex++;
      target.textContent = currentPhrase.substring(0, charIndex);
      speed = 95 + Math.random() * 30; // natural mechanical typing rhythm
    }

    if (!isDeleting && charIndex === currentPhrase.length) {
      // Hold phrase on screen so visitor can comfortably read it
      speed = 2400;
      isDeleting = true;
    } else if (isDeleting && charIndex === 0) {
      isDeleting = false;
      phraseIndex = (phraseIndex + 1) % phrases.length;
      speed = 600; // pleasant breath before typing next phrase
    }

    timerId = setTimeout(tick, speed);
  }

  function startTyping() {
    if (started) return;
    started = true;
    clearTimeout(timerId);
    // Initial display pause of the default phrase
    timerId = setTimeout(tick, 2200);
  }

  // If bootloader is active on page, wait until it finishes
  if (document.querySelector(".boot-overlay")) {
    document.addEventListener("boot:complete", startTyping, { once: true });
    // Fallback in case boot was skipped or event missed
    setTimeout(startTyping, 4500);
  } else {
    // Normal visit without bootloader: start after brief entrance pause
    setTimeout(startTyping, 800);
  }
})();
