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
  let charIndex = 0;
  let isDeleting = false;
  let typingSpeed = 90;

  function tick() {
    const currentPhrase = phrases[phraseIndex];

    if (isDeleting) {
      charIndex--;
      target.textContent = currentPhrase.substring(0, charIndex);
      typingSpeed = 45;
    } else {
      charIndex++;
      target.textContent = currentPhrase.substring(0, charIndex);
      typingSpeed = 85 + Math.random() * 35; // slight natural jitter
    }

    if (!isDeleting && charIndex === currentPhrase.length) {
      // Pause at end of phrase
      typingSpeed = 2200;
      isDeleting = true;
    } else if (isDeleting && charIndex === 0) {
      isDeleting = false;
      phraseIndex = (phraseIndex + 1) % phrases.length;
      typingSpeed = 500; // brief pause before starting next word
    }

    setTimeout(tick, typingSpeed);
  }

  // Start initial typing delay
  setTimeout(tick, 600);
})();
