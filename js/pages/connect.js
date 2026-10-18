import { onAuth, resendVerification } from "../core/auth.js";
import { api, h, fmtDateDay, label } from "../core/api.js";
import { TURNSTILE_SITE_KEY } from "../core/config.js";
import * as rtdb from "../core/rtdb.js";

const content = document.getElementById("connect-content");
const mount = document.getElementById("connect-dynamic");
let messengerBtn = null;

/* ------------------------------------------------------------------ Auth check & redirect */
function redirectToAuth() {
  window.location.href = "/frontend/pages/auth.html?redirect=" + encodeURIComponent(window.location.pathname + window.location.search);
}


/* ------------------------------------------------------------------ Request form */
const CATS = [["website", "Website"], ["pc_app", "PC App"], ["mobile_app", "Mobile App"], ["ai_automation", "AI / Automation"], ["robotics", "Robotics"], ["other", "Other"]];

function field(id, text, control) { return h("div", { class: "field" }, h("label", { for: id }, `${text} *`), control); }

/** Renders the Cloudflare Turnstile widget once the script has loaded; token is read at submit time. */
function mountTurnstile(container) {
  let widgetId = null;
  const tryRender = () => {
    if (!window.turnstile) return setTimeout(tryRender, 150);
    widgetId = window.turnstile.render(container, { sitekey: TURNSTILE_SITE_KEY, theme: "dark" });
  };
  tryRender();
  return () => (window.turnstile && widgetId !== null ? window.turnstile.getResponse(widgetId) : null);
}

async function renderForm(user) {
  if (!user.emailVerified) {
    const msg = h("div", { "aria-live": "polite" });
    return h("div", { class: "panel" },
      h("p", { class: "notice notice--error" }, "Please verify your email before submitting a project request — check your inbox for the link we sent when you signed up."),
      msg,
      h("button", { class: "btn btn--ghost btn--sm", onclick: async (e) => {
        e.target.disabled = true;
        try { await resendVerification(user); msg.replaceChildren(h("p", { class: "notice notice--ok" }, "Verification email sent — check your inbox, then refresh this page.")); }
        catch { msg.replaceChildren(h("p", { class: "notice notice--error" }, "Couldn't send the email right now — try again shortly.")); }
        finally { e.target.disabled = false; }
      } }, "Resend verification email"));
  }

  let profile = {};
  try { profile = await api("/profile", { auth: true }); } catch { /* prefill is best-effort */ }
  const input = (id, val, type = "text", extra = {}) => h("input", { id, name: id, type, value: val || "", required: true, ...extra });
  const f = {
    full_name: input("full_name", profile.full_name || user.displayName, "text", { autocomplete: "name" }),
    email: input("email", user.email, "email", { autocomplete: "email" }),
    phone: input("phone", profile.phone, "tel", { autocomplete: "tel" }),
    country: input("country", profile.country, "text", { autocomplete: "country-name" }),
    profession: input("profession", profile.profession),
    business: input("business", profile.business, "text", { autocomplete: "organization" }),
    category: h("select", { id: "category", required: true }, h("option", { value: "" }, "Select…"), CATS.map(([v, l]) => h("option", { value: v }, l))),
    deadline: (() => {
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const d = input("deadline", "", "date", { min: "1900-01-01" });
      const fillToday = () => { if (!d.value) d.value = todayStr; };
      d.addEventListener("click", fillToday);
      d.addEventListener("focus", fillToday);
      return d;
    })(),
    budget: input("budget", "", "text", { placeholder: "e.g. ₹20,000 – ₹40,000" }),
    project_description: h("textarea", { id: "project_description", required: true, minlength: 10, maxlength: 5000 }),
  };
  const out = h("div", { "aria-live": "polite" });
  const btn = h("button", { class: "btn btn--primary", type: "submit" }, "SUBMIT");
  const turnstileBox = h("div", { class: "cf-turnstile" });
  const getTurnstileToken = mountTurnstile(turnstileBox);

  const reqAge = h("input", { id: "req-age", type: "checkbox", required: true });
  const reqPriv = h("input", { id: "req-priv", type: "checkbox", required: true });
  const ageField = h("div", { class: "field field--check" }, reqAge, h("label", { for: "req-age" }, "I confirm I am 18 years of age or older *"));
  const privField = h("div", { class: "field field--check" }, reqPriv, h("label", { for: "req-priv" }, "I have read and accept the ", h("a", { href: "/frontend/pages/legal.html", target: "_blank" }, "Terms & Conditions"), " *"));

  const form = h("form", { class: "form", novalidate: true, onsubmit: async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(Object.entries(f).map(([k, el]) => [k, el.value.trim()]));
    const missing = Object.entries(body).find(([, v]) => !v);
    if (missing) return out.replaceChildren(h("p", { class: "notice notice--error" }, `Please fill in every required field (${label(missing[0])}).`));
    if (body.project_description.length < 10) return out.replaceChildren(h("p", { class: "notice notice--error" }, "Please describe your project in a bit more detail."));
    if (!reqAge.checked || !reqPriv.checked) {
      return out.replaceChildren(h("p", { class: "notice notice--error" }, "You must confirm you are 18+ and accept the Terms & Conditions before submitting."));
    }
    body.age_confirmed = true;
    body.privacy_accepted = true;
    body.turnstile_token = getTurnstileToken();
    btn.disabled = true;
    try {
      await api("/connect", { method: "POST", body, auth: true });
      out.replaceChildren(h("p", { class: "notice notice--ok" }, "Thanks — your request was received. You can now message me using the chat button."));
      form.reset(); await renderStatus(user);
    } catch (err) {
      out.replaceChildren(h("p", { class: "notice notice--error", role: "alert" }, err.message));
      window.turnstile?.reset();
    }
    finally { btn.disabled = false; }
  } },
    h("div", { class: "form__row" }, field("full_name", "Full Name", f.full_name), field("email", "Email", f.email)),
    h("div", { class: "form__row" }, field("phone", "Phone Number", f.phone), field("country", "Country", f.country)),
    h("div", { class: "form__row" }, field("profession", "Profession", f.profession), field("business", "Business / Organization", f.business)),
    field("category", "What are you looking for?", f.category),
    h("div", { class: "form__row" },
      field("deadline", "When would you like this project to be completed?", f.deadline),
      field("budget", "What is the maximum budget you're willing to allocate?", f.budget)),
    field("project_description", "Tell me about your project / idea", f.project_description),
    ageField, privField,
    turnstileBox, out, btn);
  return form;
}

/* ------------------------------------------------------------------ Existing requests, messenger, review */
async function renderStatus(user) {
  const box = document.getElementById("request-status");
  box.replaceChildren();
  let reqs = [];
  try { reqs = await api("/connect/mine", { auth: true }); } catch { return; }
  if (!reqs.length) { messengerBtn?.remove(); messengerBtn = null; return; }

  const latest = reqs.sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const progressBox = h("div", {});
  box.append(h("div", { class: "panel" }, h("h3", {}, "Your request"),
    h("dl", {}, h("dt", {}, "Status"), h("dd", {}, h("span", { class: `badge badge--${latest.status}` }, label(latest.status))),
      h("dt", {}, "Type"), h("dd", {}, label(latest.category)), h("dt", {}, "Submitted"), h("dd", {}, fmtDateDay(latest.created_at))),
    progressBox));

  api(`/requests/${latest.id}/progress`, { auth: true }).then((p) => {
    progressBox.replaceChildren(
      h("h4", { class: "progress-label" }, `Progress — ${p.completion_percent}%`),
      h("div", { class: "progress-track" }, (() => {
        const fill = h("div", { class: "progress-fill" });
        fill.style.setProperty("--progress", `${p.completion_percent}%`);
        return fill;
      })()),
      h("p", { class: "tile__meta" }, `Current stage: ${p.current_stage} · Next: ${p.next}`));
  }).catch(() => {});

  if (latest.rtdb_conversation_id) mountMessenger(latest.rtdb_conversation_id, user);
  if (latest.status === "completed") {
    let existing = null;
    try { existing = await api(`/reviews/${latest.id}`, { auth: true }); } catch { /* none */ }
    box.append(existing ? h("p", { class: "notice notice--ok" }, "Thanks for your review!") : reviewForm(latest.id, box, user));
  }
}

const QUESTIONS = [
  ["overall_rating", "Overall experience"],
  ["professionalism_rating", "How would you rate my behavior/professionalism?"],
  ["satisfaction_rating", "How satisfied were you with the website/project?"],
  ["expectations_rating", "How well did the final result match your expectations?"],
  ["usability_rating", "How well did you understand/use the final product?"],
  ["pricing_rating", "Was the pricing reasonable for what you received?"],
  ["sufficiency_rating", "Was the final result sufficient for your needs?"],
];

function starInput(key, text, values) {
  const labelId = `lbl-${key}`;
  const stars = [1, 2, 3, 4, 5].map((n) => h("button", {
    type: "button", class: "star", role: "radio", "aria-checked": "false", "aria-label": `${n} star${n > 1 ? "s" : ""}`, tabindex: n === 1 ? "0" : "-1",
    onclick: () => set(n),
    onkeydown: (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); set(Math.min(5, (values[key] || 0) + 1)); }
      if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); set(Math.max(1, (values[key] || 1) - 1)); }
    } }, "★"));
  const wrap = h("div", { class: "stars", role: "radiogroup", "aria-labelledby": labelId }, stars);
  function set(n) {
    values[key] = n;
    stars.forEach((s, i) => { s.setAttribute("aria-checked", String(i + 1 === n)); s.classList.toggle("is-on", i < n); s.tabIndex = i + 1 === n ? 0 : -1; });
    stars[n - 1].focus();
  }
  return h("div", { class: "field" }, h("span", { id: labelId }, text), wrap);
}

function reviewForm(requestId, box, user) {
  const values = {};
  const note = h("textarea", { id: "review-note", maxlength: 2000 });
  const out = h("div", { "aria-live": "polite" });
  return h("form", { class: "form", novalidate: true, onsubmit: async (e) => {
    e.preventDefault();
    if (QUESTIONS.some(([k]) => !values[k])) return out.replaceChildren(h("p", { class: "notice notice--error" }, "Please rate every question with 1–5 stars."));
    try { await api(`/reviews/${requestId}`, { method: "POST", body: { ...values, note: note.value.trim() || null }, auth: true }); await renderStatus(user); }
    catch (err) { out.replaceChildren(h("p", { class: "notice notice--error", role: "alert" }, err.message)); }
  } },
    h("h3", {}, "How did it go? Leave a review"),
    QUESTIONS.map(([k, t]) => starInput(k, t, values)),
    h("div", { class: "field" }, h("label", { for: "review-note" }, "Additional note (optional)"), note),
    out, h("button", { class: "btn btn--primary", type: "submit" }, "Submit review"));
}

/* ------------------------------------------------------------------ Messenger (instant — direct RTDB reads) */
function mountMessenger(conversationId, user) {
  if (messengerBtn) return;
  rtdb.initPresence(user.uid);
  const dot = h("span", { class: "unread-dot" });
  messengerBtn = h("button", { class: "messenger-btn", "aria-label": "Open chat", "data-cursor-hover": "", onclick: () => open() }, "💬", dot);
  document.body.append(messengerBtn);

  const list = h("div", { class: "drawer__body", "aria-live": "polite" });
  const typingNote = h("p", { class: "typing-note" });
  const typingDots = h("span", { class: "typing-dots" }, h("span", {}), h("span", {}), h("span", {}));
  const presenceDot = h("span", { class: "presence-dot" });
  const box = h("textarea", { "aria-label": "Message", maxlength: 4000, placeholder: "Write a message…" });
  const draftTag = h("span", { class: "draft-tag" });
  const drawer = h("aside", { class: "drawer", "aria-label": "Chat" },
    h("div", { class: "drawer__head" }, h("strong", {}, presenceDot, "Chat"), h("button", { class: "link-btn", onclick: () => close() }, "Close")),
    list, typingNote,
    h("div", { class: "drawer__foot" }, box, draftTag,
      h("div", { class: "row-gap" },
        h("button", { class: "btn btn--primary btn--sm", onclick: send }, "Send"),
        h("button", { class: "btn btn--ghost btn--sm", "data-cursor-glow": "red", onclick: discard }, "Delete draft"))));
  document.body.append(drawer);

  let unsubMsgs = null, unsubDraft = null, unsubTyping = null, unsubUnread = null, unsubPresence = null, adminUid = null;

  rtdb.listenConversation(conversationId, (convo) => {
    const newAdminUid = Object.keys(convo?.participants || {}).find((uid) => uid !== user.uid) || null;
    if (newAdminUid && newAdminUid !== adminUid) {
      adminUid = newAdminUid;
      unsubPresence?.();
      unsubPresence = rtdb.listenPresence(adminUid, (online) => presenceDot.classList.toggle("is-online", online));
    }
  });

  function render(msgs) {
    if (!msgs.length) return list.replaceChildren(h("p", { class: "state" }, "No messages yet. Say hello!"));
    list.replaceChildren(...msgs.map((m) => h("div", { class: `msg${m.sender_uid === user.uid ? " msg--mine" : ""}` }, m.content, h("span", { class: "msg__time" }, fmtDateDay(m.created_at)))));
    list.scrollTop = list.scrollHeight;
  }

  function open() {
    drawer.classList.add("is-open"); dot.style.display = "none";
    unsubMsgs = rtdb.listenMessages(conversationId, render);
    unsubDraft = rtdb.listenDraft(conversationId, user.uid, (c) => { if (document.activeElement !== box) box.value = c; });
    if (adminUid) unsubTyping = rtdb.listenTyping(conversationId, adminUid, (t) => typingNote.replaceChildren(t ? typingDots : ""));
    api(`/messages/${conversationId}`, { auth: true }).catch(() => {}); // marks read server-side
    box.focus();
  }
  function close() {
    drawer.classList.remove("is-open");
    unsubMsgs?.(); unsubDraft?.(); unsubTyping?.();
    rtdb.setTyping(conversationId, user.uid, false);
    messengerBtn.focus();
  }
  async function send() {
    const text = box.value.trim(); if (!text) return;
    try { await api(`/messages/${conversationId}`, { method: "POST", body: { content: text }, auth: true }); box.value = ""; draftTag.textContent = ""; rtdb.setTyping(conversationId, user.uid, false); }
    catch (e) { draftTag.textContent = e.message; }
  }
  async function discard() { box.value = ""; await rtdb.saveDraft(conversationId, user.uid, ""); draftTag.textContent = "Draft deleted"; }

  let saveT = null;
  box.addEventListener("input", () => {
    rtdb.setTyping(conversationId, user.uid, true);
    clearTimeout(saveT); draftTag.textContent = "Saving draft…";
    saveT = setTimeout(() => { rtdb.saveDraft(conversationId, user.uid, box.value); draftTag.textContent = box.value ? "Draft saved" : ""; }, 500);
  });
  box.addEventListener("blur", () => rtdb.setTyping(conversationId, user.uid, false));
  drawer.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

  unsubUnread = rtdb.listenUnread(user.uid, conversationId, (n) => { dot.style.display = n > 0 && !drawer.classList.contains("is-open") ? "block" : "none"; });
}

/* ------------------------------------------------------------------ Boot */
let booted = false;
onAuth(async (user) => {
  if (!user) {
    booted = false;
    mount.replaceChildren();
    redirectToAuth();
    return;
  }
  if (booted) return;
  booted = true;
  const statusBox = h("div", { id: "request-status" });
  mount.replaceChildren(statusBox, h("h2", { class: "section__heading text-center" }, "Tell me about your project"), await renderForm(user));
  await renderStatus(user);
});
