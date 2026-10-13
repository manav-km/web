# Design & Motion System — Phase 3

Tokens live in [`frontend/css/tokens.css`](../frontend/css/tokens.css) and
are the single source of truth for color, type, spacing, and motion timing.
Every component below is built ONLY from those variables — no ad-hoc hex
codes or magic pixel values in component CSS.

## Typography

- **Display** (`--font-display`): hero headlines only — homepage name,
  page hero titles ("PROJECTS", "ACHIEVEMENTS", etc.). Large, tight
  line-height (`--lh-tight`), restrained letter-spacing.
- **Body** (`--font-body`): everything else — descriptions, form labels,
  admin tables, nav.
- **Mono** (`--font-mono`): repo language stats, code snippets, timestamps
  in the audit log.
- Uppercase is used sparingly — nav items and section labels only, always
  with `--ls-uppercase` tracking so it doesn't feel cramped.

## Color usage rule

Red and blue are **light sources**: box-shadow glows, gradient edges,
border accents, the cursor's hover glow, hover states on interactive
elements. They are never used as large fill backgrounds or button fills —
buttons are white-on-black or black-on-white, with a red/blue glow
appearing only on hover/focus. This keeps the "controlled lighting" feel
from §2 instead of drifting into a neon UI.

## Core components

| Component | Notes |
|---|---|
| **Button (primary)** | White fill, black text, `--radius-md`. On hover: subtle scale (1.02) + glow using `--accent-blue-glow` or `--accent-red-glow` depending on context (e.g. destructive admin actions get red). |
| **Button (secondary/ghost)** | Transparent, `--border-hairline`, white text; hover brightens the border to `--border-strong`. |
| **Card** | `--bg-near-black`, `--radius-lg`, `--shadow-card`, hairline border. Used for project tiles, achievement tiles, upload tiles. |
| **Table** (admin) | Real `<table>`, sticky header row, `--border-hairline` row dividers, horizontal scroll wrapper on small screens (§46) — never collapses into cards. |
| **Modal** | Centered, `--bg-elevated`, backdrop blur + dim; used for the Connect auth gate and confirmation dialogs. |
| **Drawer** | Slides from the right, `--bg-elevated`, used for the client chat and admin record detail views. |
| **Notification bell** | Sits directly left of the profile picture (§23); unread count as a small red dot/badge, never confused visually with the messenger button. |
| **Messenger button** | Floating circle, bottom-right, only rendered once a client request exists for that user. |
| **Star rating input** | Five filled/outline star icons per question; no sliders, dropdowns, or text substitutes (§24). |

## Custom cursor (desktop only)

- Default: `--cursor-size-default` white dot, follows the pointer with a
  slight lag (spring easing, not 1:1) for a "refined" rather than
  mechanical feel.
- On hover of any interactive element (buttons, links, cards, nav items,
  form fields): expands to `--cursor-size-hover`, blends in a soft
  red-or-blue glow (`--cursor-glow-blend`) depending on the element's
  semantic context (e.g. destructive admin actions glow red).
- Disabled entirely on touch devices — detected via
  `matchMedia('(pointer: coarse)')`, falling back to the native cursor with
  no layout dependency on the custom one.

## Page transitions

- MPA navigation: on link click, fade + slight upward translate of the
  outgoing content over `--duration-page-transition`, then the browser
  navigates; the incoming page fades in on load. Implemented with the View
  Transitions API where supported, with a plain CSS fade as the fallback so
  it degrades gracefully with older browsers or JS disabled (§6).
- Respects `prefers-reduced-motion` — transitions collapse to nearly
  instant (`--duration-page-transition: 1ms` under that media query, see
  tokens.css).

## Background atmosphere

- A single low-opacity animated gradient/orb layer behind hero sections,
  with subtle mouse-parallax (translate, not scale, to avoid layout
  thrashing). Capped frame budget — pure CSS/transform animation, no
  canvas particle system unless a specific page needs it, to protect
  performance on lower-end devices (§48, §52).

## Reveal-on-scroll

- Content sections fade+rise into view once ~20% visible
  (`IntersectionObserver`), `--duration-base`, one-shot (no re-triggering
  on scroll-up) so the page doesn't feel jittery.

## Accessibility guarantees

- Every interactive element has a visible focus state independent of the
  custom cursor (a 2px outline using `--accent-blue`).
- All motion above respects `prefers-reduced-motion`.
- Keyboard navigation reaches everything the mouse can — the cursor and
  hover glow are enhancements, never the only way to discover
  interactivity (§47).
