/**
 * consent-banner.js — cookie/analytics consent banner.
 * Shows only if consent has not been recorded yet and GA ID is configured.
 * Imports from analytics.js to record the choice.
 */
import { GA_MEASUREMENT_ID } from "./config.js";
import { acceptAnalytics, declineAnalytics, hasConsent } from "./analytics.js";

const HAS_ID = Boolean(
  GA_MEASUREMENT_ID &&
  !GA_MEASUREMENT_ID.startsWith("YOUR_") &&
  GA_MEASUREMENT_ID.startsWith("G-")
);
const IS_ADMIN = typeof location !== "undefined" && location.pathname.startsWith("/portfolio/admin");

if (HAS_ID && !IS_ADMIN && !hasConsent()) {
  let existingChoice = null;
  try {
    existingChoice = localStorage.getItem("ga_consent");
  } catch {
    /* private mode */
  }

  if (existingChoice === null) {
    setTimeout(() => {
      const banner = document.createElement("div");
      banner.className = "consent-banner";
      banner.setAttribute("role", "dialog");
      banner.setAttribute("aria-label", "Analytics consent");
      banner.setAttribute("aria-live", "polite");

      const text = document.createElement("p");
      text.textContent =
        "This site uses Google Analytics to understand visitor usage. No personal information is shared with advertisers. You can choose whether to allow analytics.";

      const btnAccept = document.createElement("button");
      btnAccept.className = "btn btn--primary btn--sm";
      btnAccept.type = "button";
      btnAccept.textContent = "Accept";
      btnAccept.onclick = () => {
        acceptAnalytics();
        banner.remove();
      };

      const btnDecline = document.createElement("button");
      btnDecline.className = "btn btn--ghost btn--sm";
      btnDecline.type = "button";
      btnDecline.textContent = "Decline";
      btnDecline.onclick = () => {
        declineAnalytics();
        banner.remove();
      };

      const btns = document.createElement("div");
      btns.className = "consent-banner__btns";
      btns.append(btnDecline, btnAccept);

      banner.append(text, btns);
      document.body.append(banner);
    }, 1500);
  }
}
