/**
 * boot.js — Startup boot sequence:
 * 1. Writes "Manav Kumar Mishra" in the middle with 'A' in "KUMAR" as the orbital center point.
 * 2. Pages emerge radially from that exact center point in circular order.
 * 3. Pages revolve around the name & initialization with ZERO overlap.
 * 4. Once initialization finishes, pages smoothly slide to their respective places in the navbar.
 * 5. Bypassed ONLY when navigating via the navbar.
 */
(function () {
  "use strict";

  // Only run on the root homepage
  const isHomePage = window.location.pathname === "/" || window.location.pathname === "/index.html";
  if (!isHomePage) return;

  // Check if visitor entered via the navbar
  const enteredViaNavbar = sessionStorage.getItem("entered_via_navbar") === "true";
  sessionStorage.removeItem("entered_via_navbar");

  // If entered via navbar, bypass boot sequence
  if (enteredViaNavbar) {
    return;
  }

  // Prevent background scrolling during boot
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
    { name: "Home", href: "/" },
    { name: "About Me", href: "/frontend/pages/about.html" },
    { name: "Projects", href: "/frontend/pages/projects.html" },
    { name: "Repositories", href: "/frontend/pages/repositories.html" },
    { name: "Achievements", href: "/frontend/pages/achievements.html" },
    { name: "Uploads", href: "/frontend/pages/uploads.html" },
    { name: "Blog", href: "/frontend/pages/blog.html" },
    { name: "Connect", href: "/frontend/pages/connect.html" }
  ];

  // 1. Build Overlay DOM
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

  // Center content wrapper (Title + Terminal)
  const centerContent = document.createElement("div");
  centerContent.className = "boot-center-content";

  // Title with Typewriter
  const titleWrap = document.createElement("div");
  titleWrap.className = "boot-title-wrap";
  titleWrap.innerHTML = `
    <h1 class="boot-title" id="boot-typewriter-text"></h1>
    <span class="boot-cursor" aria-hidden="true">_</span>
  `;
  centerContent.appendChild(titleWrap);

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
  centerContent.appendChild(terminal);
  stage.appendChild(centerContent);

  // Orbital layer: fixed viewport layer for zero-overlap coordinate precision
  const orbitLayer = document.createElement("div");
  orbitLayer.className = "boot-orbit-layer";
  overlay.appendChild(orbitLayer);

  overlay.appendChild(stage);

  // Mount to body immediately
  if (document.body) {
    document.body.prepend(overlay);
  } else {
    document.addEventListener("DOMContentLoaded", () => document.body.prepend(overlay));
  }

  // Terminal live clock
  const clockEl = terminal.querySelector("#boot-clock");
  function updateClock() {
    const d = new Date();
    clockEl.textContent = d.toTimeString().split(" ")[0];
  }
  updateClock();

  // Escape key handler
  function onKeyDown(e) {
    if (e.key === "Escape") {
      finishBoot();
    }
  }
  window.addEventListener("keydown", onKeyDown);

  // 2. Orbital System & State
  const pills = [];
  const pillStates = [];
  const totalPages = PAGES.length;

  PAGES.forEach((page, i) => {
    const pill = document.createElement("div");
    pill.className = "boot-page-pill";
    pill.textContent = page.name;
    orbitLayer.appendChild(pill);
    pills.push(pill);

    pillStates.push({
      baseAngle: (i * 2 * Math.PI) / totalPages, // 45-deg separation in circular order
      progress: 0,      // 0 (at center) to 1 (full orbit distance)
      scale: 0,
      opacity: 0,
      emerged: false,
      lastScreenX: 0,
      lastScreenY: 0
    });
  });

  /**
   * Exact center of the page as the middle point for emergence and revolution.
   */
  function getCenterPoint() {
    return {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2
    };
  }

  /**
   * Calculates orbital radii with dynamic clearance around the centered stage
   * so revolving pills NEVER overlap the title text or the terminal console.
   */
  function getOrbitRadii() {
    const isMobile = window.innerWidth <= 680;
    const stageEl = document.querySelector(".boot-center-content") || document.querySelector(".boot-stage");

    let halfW = 210;
    let halfH = 135;

    if (stageEl) {
      const r = stageEl.getBoundingClientRect();
      halfW = r.width / 2;
      halfH = r.height / 2;
    }

    // Safety clearance so pills (half-width ~60px, half-height ~15px) stay completely clear
    const clearanceX = isMobile ? 55 : 85;
    const clearanceY = isMobile ? 40 : 65;

    let rx = halfW + clearanceX;
    let ry = halfH + clearanceY;

    // Viewport bounds
    const maxRx = (window.innerWidth / 2) - 25;
    const maxRy = (window.innerHeight / 2) - 25;

    rx = Math.min(rx, maxRx);
    ry = Math.min(ry, maxRy);

    // Guaranteed minimums
    rx = Math.max(rx, isMobile ? 180 : 360);
    ry = Math.max(ry, isMobile ? 210 : 250);

    return { rx, ry };
  }

  let orbitAngle = 0;
  let rafId = null;
  let isDocking = false;

  function renderOrbit() {
    if (isDocking) return;

    const center = getCenterPoint();
    const { rx, ry } = getOrbitRadii();
    orbitAngle += 0.007; // smooth revolution speed

    pillStates.forEach((state, idx) => {
      if (state.progress <= 0) {
        pills[idx].style.opacity = "0";
        pills[idx].style.transform = `translate(${center.x}px, ${center.y}px) translate(-50%, -50%) scale(0)`;
        return;
      }

      const currentAngle = state.baseAngle + orbitAngle;
      const curDist = state.progress;

      // Revolution centered precisely at page center (50vw, 50vh) with zero overlap
      const x = center.x + Math.cos(currentAngle) * (rx * curDist);
      const y = center.y + Math.sin(currentAngle) * (ry * curDist);

      state.lastScreenX = x;
      state.lastScreenY = y;

      pills[idx].style.opacity = String(state.opacity);
      pills[idx].style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${state.scale})`;
    });

    rafId = requestAnimationFrame(renderOrbit);
  }

  rafId = requestAnimationFrame(renderOrbit);

  // 3. Typewrite Name & Trigger Radial Emergence
  const typewriterEl = overlay.querySelector("#boot-typewriter-text");
  const logsBodyEl = overlay.querySelector("#boot-logs-body");
  const progressFillEl = overlay.querySelector("#boot-progress");
  const fullName = "MANAV KUMAR MISHRA";

  let charIdx = 0;
  let isTerminated = false;

  function renderChars(chars) {
    typewriterEl.textContent = chars;
  }

  function typeName() {
    if (isTerminated) return;
    if (charIdx <= fullName.length) {
      renderChars(fullName.slice(0, charIdx));

      // As letters type out, trigger pages emerging from the center in circular order
      const emergenceIndex = Math.floor((charIdx / fullName.length) * totalPages);
      for (let i = 0; i < emergenceIndex && i < totalPages; i++) {
        if (!pillStates[i].emerged) {
          emergePill(i);
        }
      }

      charIdx++;
      setTimeout(typeName, 45 + Math.random() * 25);
    } else {
      // Ensure all remaining pills emerge if any haven't yet
      pillStates.forEach((state, i) => {
        if (!state.emerged) emergePill(i);
      });
      // Start terminal initialization steps
      setTimeout(runNextStep, 220);
    }
  }

  // Animate a pill emerging smoothly from the 'A' in "KUMAR" to the full zero-overlap orbit
  function emergePill(idx) {
    const state = pillStates[idx];
    state.emerged = true;
    const startTime = performance.now();
    const duration = 580; // ms to reach orbit

    function stepEmergence(now) {
      if (isDocking) return;
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - t, 3);

      state.progress = eased;
      state.scale = eased;
      state.opacity = Math.min(1, eased * 1.5);

      if (t < 1) {
        requestAnimationFrame(stepEmergence);
      } else {
        state.progress = 1;
        state.scale = 1;
        state.opacity = 1;
      }
    }

    requestAnimationFrame(stepEmergence);
  }

  // Start typing after initial pause
  setTimeout(typeName, 180);

  // 4. Run the 6 Terminal Steps
  let stepIdx = 0;
  const stepIntervals = [380, 420, 390, 460, 420, 400];

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

      // Add active step line
      const line = document.createElement("div");
      line.className = "boot-step is-active";
      line.innerHTML = `
        <span class="boot-step__icon">❯</span>
        <span class="boot-step__text">${stepData.text}</span>
        <span class="boot-step__tag">${stepData.tag}</span>
      `;
      logsBodyEl.appendChild(line);
      logsBodyEl.scrollTop = logsBodyEl.scrollHeight;

      // Update progress bar
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
      // All steps done! Trigger the slide to the navbar!
      setTimeout(finishBoot, 350);
    }
  }

  // 5. Sliding Docking Transition to the Navbar
  let finished = false;
  function finishBoot() {
    if (finished) return;
    finished = true;
    isTerminated = true;
    isDocking = true;
    if (rafId) cancelAnimationFrame(rafId);
    window.removeEventListener("keydown", onKeyDown);

    // Fade out central text and terminal smoothly
    centerContent.style.transition = "opacity 0.45s ease, transform 0.45s ease";
    centerContent.style.opacity = "0";
    centerContent.style.transform = "scale(0.96)";
    skipBtn.style.opacity = "0";

    // Find the real navbar links in the site header
    const navLinks = Array.from(document.querySelectorAll(".site-nav__links a"));

    pills.forEach((pill, idx) => {
      const pageData = PAGES[idx];
      let targetEl = null;

      if (navLinks.length) {
        targetEl = navLinks.find((a) => a.textContent.trim().toLowerCase() === pageData.name.toLowerCase()) || navLinks[idx];
      }

      if (targetEl) {
        const targetRect = targetEl.getBoundingClientRect();

        // Calculate absolute target screen coordinates
        if (targetRect.width > 0 && targetRect.top >= 0) {
          const targetX = targetRect.left + targetRect.width / 2;
          const targetY = targetRect.top + targetRect.height / 2;

          pill.style.transition = "transform 0.85s cubic-bezier(0.2, 0.9, 0.3, 1.2), opacity 0.85s ease, background 0.4s ease, border-color 0.4s ease";
          pill.style.transform = `translate(${targetX}px, ${targetY}px) translate(-50%, -50%) scale(0.95)`;
          pill.style.background = "rgba(47, 139, 255, 0.22)";
          pill.style.borderColor = "var(--accent-blue)";
          pill.style.boxShadow = "0 0 20px rgba(47, 139, 255, 0.7)";
          return;
        }
      }

      // Fallback for mobile / collapsed menu: slide upwards towards top center
      const curX = pillStates[idx].lastScreenX;
      const curY = pillStates[idx].lastScreenY;
      pill.style.transition = "transform 0.75s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.75s ease";
      pill.style.transform = `translate(${curX}px, ${curY - 260}px) translate(-50%, -50%) scale(0.6)`;
      pill.style.opacity = "0";
    });

    // Clean up overlay once docking animation completes
    setTimeout(() => {
      overlay.classList.add("is-exiting");
      document.body.style.overflow = originalOverflow;

      setTimeout(() => {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
        document.dispatchEvent(new CustomEvent("boot:complete"));
      }, 700);
    }, 850);
  }
})();
