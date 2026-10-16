/**
 * boot.js — Cinematic startup boot sequence for first-time direct URL visits.
 *
 * Sequence:
 * 1. Verifies if visitor arrived directly via URL for the first time in this session.
 * 2. Renders orbital ring with revolving page pills around the official logo.
 * 3. Typewrites "MANAV KUMAR MISHRA" with terminal monospace cursor.
 * 4. Iterates through the 6 system initialization steps.
 * 5. Smoothly docks/transitions the interface into the main page and navbar.
 */
(function () {
  "use strict";

  // Check if we should run boot sequence
  const hasBooted = sessionStorage.getItem("has_booted");
  const isDirectUrl = !document.referrer || !document.referrer.startsWith(window.location.origin);
  const isForceBoot = new URLSearchParams(window.location.search).get("boot") === "true";

  // Only run on the root homepage for direct first-time session entries, or when ?boot=true
  const isHomePage = window.location.pathname === "/" || window.location.pathname === "/index.html";

  if (!isHomePage || ((hasBooted || !isDirectUrl) && !isForceBoot)) {
    return;
  }

  // Prevent scroll during boot
  const originalOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";

  const STEPS = [
    { text: "Loading frontend content...", tag: "SYS" },
    { text: "Mounting design and UI...", tag: "UI" },
    { text: "Verifying functions...", tag: "VFY" },
    { text: "Syncing with backend...", tag: "API" },
    { text: "All systems nominal...", tag: "OK" },
    { text: "Launching interface...", tag: "EXEC" }
  ];

  const PAGES = [
    "Home",
    "About Me",
    "Projects",
    "Repositories",
    "Achievements",
    "Uploads",
    "Blog",
    "Connect"
  ];

  // Build the overlay DOM
  const overlay = document.createElement("div");
  overlay.className = "boot-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-label", "System Boot Sequence");

  // Atmospheric background
  const atmosphere = document.createElement("div");
  atmosphere.className = "boot-atmosphere";
  atmosphere.innerHTML = `
    <div class="boot-orb boot-orb--blue"></div>
    <div class="boot-orb boot-orb--red"></div>
  `;
  overlay.appendChild(atmosphere);

  // Skip button
  const skipBtn = document.createElement("button");
  skipBtn.className = "boot-skip-btn";
  skipBtn.setAttribute("type", "button");
  skipBtn.setAttribute("data-cursor-hover", "");
  skipBtn.innerHTML = `<span>SKIP</span> <span>[ESC]</span> ❯❯`;
  skipBtn.addEventListener("click", finishBoot);
  overlay.appendChild(skipBtn);

  // Stage container
  const stage = document.createElement("div");
  stage.className = "boot-stage";

  // Orbital system
  const orbitWrap = document.createElement("div");
  orbitWrap.className = "boot-orbit-wrap";

  // Track
  const orbitTrack = document.createElement("div");
  orbitTrack.className = "boot-orbit-track";

  // Center logo
  const centerLogo = document.createElement("div");
  centerLogo.className = "boot-center-logo";
  centerLogo.innerHTML = `<img src="/assets/branding/logo.png" alt="Manav-KM Logo" width="36" height="36" />`;

  // Attach 8 orbital page nodes spaced radially
  const radius = 135; // px from center
  const totalPages = PAGES.length;

  PAGES.forEach((pageName, idx) => {
    const angleDeg = (360 / totalPages) * idx;
    const angleRad = (angleDeg * Math.PI) / 180;
    const x = Math.round(Math.cos(angleRad) * radius);
    const y = Math.round(Math.sin(angleRad) * radius);

    const node = document.createElement("div");
    node.className = "boot-orbit-node";
    node.style.transform = `translate(${x}px, ${y}px)`;

    const pill = document.createElement("span");
    pill.className = "boot-node-pill";
    pill.textContent = pageName;

    node.appendChild(pill);
    orbitTrack.appendChild(node);
  });

  orbitWrap.appendChild(orbitTrack);
  orbitWrap.appendChild(centerLogo);
  stage.appendChild(orbitWrap);

  // Typewriter title container
  const titleWrap = document.createElement("div");
  titleWrap.className = "boot-title-wrap";
  titleWrap.innerHTML = `
    <h1 class="boot-title" id="boot-typewriter-text"></h1>
    <span class="boot-cursor" aria-hidden="true">_</span>
  `;
  stage.appendChild(titleWrap);

  // Terminal box
  const terminal = document.createElement("div");
  terminal.className = "boot-terminal";
  terminal.innerHTML = `
    <div class="boot-terminal__header">
      <div class="boot-terminal__lights">
        <span class="boot-light boot-light--red"></span>
        <span class="boot-light boot-light--yellow"></span>
        <span class="boot-light boot-light--green"></span>
      </div>
      <span class="boot-terminal__title">SYSTEM INITIALIZATION // v2.6</span>
      <span class="boot-terminal__time" id="boot-clock">00:00:00</span>
    </div>
    <div class="boot-terminal__body" id="boot-logs-body"></div>
    <div class="boot-progress-bar">
      <div class="boot-progress-fill" id="boot-progress"></div>
    </div>
  `;
  stage.appendChild(terminal);
  overlay.appendChild(stage);

  // Mount overlay to document body immediately
  if (document.body) {
    document.body.prepend(overlay);
  } else {
    document.addEventListener("DOMContentLoaded", () => document.body.prepend(overlay));
  }

  // Update clock in terminal
  const clockEl = terminal.querySelector("#boot-clock");
  function updateClock() {
    const d = new Date();
    clockEl.textContent = d.toTimeString().split(" ")[0];
  }
  updateClock();

  // Escape key to skip
  function onKeyDown(e) {
    if (e.key === "Escape") {
      finishBoot();
    }
  }
  window.addEventListener("keydown", onKeyDown);

  // Execution states
  const typewriterEl = overlay.querySelector("#boot-typewriter-text");
  const logsBodyEl = overlay.querySelector("#boot-logs-body");
  const progressFillEl = overlay.querySelector("#boot-progress");
  const fullName = "MANAV KUMAR MISHRA";

  let isTerminated = false;
  let charIdx = 0;

  // 1. Typewrite the name
  function typeName() {
    if (isTerminated) return;
    if (charIdx <= fullName.length) {
      typewriterEl.textContent = fullName.slice(0, charIdx);
      charIdx++;
      setTimeout(typeName, 38 + Math.random() * 25);
    } else {
      // Name finished, begin running the terminal boot steps
      setTimeout(runNextStep, 180);
    }
  }

  // Initial brief delay before typing
  setTimeout(typeName, 150);

  // 2. Run the 6 terminal steps
  let stepIdx = 0;
  const stepIntervals = [380, 420, 390, 460, 400, 420];

  function runNextStep() {
    if (isTerminated) return;
    if (stepIdx < STEPS.length) {
      const stepData = STEPS[stepIdx];

      // Mark previous step as done
      const prevStep = logsBodyEl.querySelector(".boot-step.is-active");
      if (prevStep) {
        prevStep.classList.remove("is-active");
        prevStep.classList.add("is-done");
        const icon = prevStep.querySelector(".boot-step__icon");
        if (icon) icon.textContent = "✓";
      }

      // Create new active step line
      const line = document.createElement("div");
      line.className = "boot-step is-active";
      line.innerHTML = `
        <span class="boot-step__icon">❯</span>
        <span class="boot-step__text">${stepData.text}</span>
        <span class="boot-step__tag">${stepData.tag}</span>
      `;
      logsBodyEl.appendChild(line);

      // Scroll logs to bottom if needed
      logsBodyEl.scrollTop = logsBodyEl.scrollHeight;

      // Update progress fill
      const pct = Math.round(((stepIdx + 1) / STEPS.length) * 100);
      progressFillEl.style.width = `${pct}%`;

      const delay = stepIntervals[stepIdx] || 400;
      stepIdx++;
      setTimeout(runNextStep, delay);
    } else {
      // Mark last step done
      const lastStep = logsBodyEl.querySelector(".boot-step.is-active");
      if (lastStep) {
        lastStep.classList.remove("is-active");
        lastStep.classList.add("is-done");
        const icon = lastStep.querySelector(".boot-step__icon");
        if (icon) icon.textContent = "✓";
      }
      // Finished all steps -> trigger smooth launch transition
      setTimeout(finishBoot, 350);
    }
  }

  // 3. Smooth exit transition into main website
  let finished = false;
  function finishBoot() {
    if (finished) return;
    finished = true;
    isTerminated = true;
    window.removeEventListener("keydown", onKeyDown);

    // Save session flag so repeating visits in this session skip boot
    sessionStorage.setItem("has_booted", "true");

    // Docking animation: pills animate towards navbar
    overlay.classList.add("is-docking");

    setTimeout(() => {
      overlay.classList.add("is-exiting");
      document.body.style.overflow = originalOverflow;

      setTimeout(() => {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
        // Emit custom event in case other components wish to react to boot finish
        document.dispatchEvent(new CustomEvent("boot:complete"));
      }, 620);
    }, 280);
  }
})();
