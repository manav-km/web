/**
 * footer-year.js — sets the footer's copyright year.
 * Runs after "partials:ready" (dispatched by include.js) since the footer
 * markup doesn't exist in the DOM until that partial is injected.
 */
document.addEventListener("partials:ready", () => {
  const el = document.getElementById("footer-year");
  if (el) el.textContent = new Date().getFullYear();
});
