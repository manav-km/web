/**
 * admin.js — admin panel UI.
 * SECURITY MODEL: this file is convenience only. The page shell is static and contains no
 * data; the UI is only built after the backend confirms admin (verified Firebase claim), and
 * EVERY data call below is independently authorized by FastAPI (require_admin). Anyone else
 * is sent to the homepage and receives 403s from the API regardless of what they do here.
 */
import { onAuth, currentUser } from "../core/auth.js";
import { api, h, fmtDate, fmtAudit, label } from "../core/api.js";
import * as rtdb from "../core/rtdb.js";

const root = document.getElementById("admin-root");
const PAGE = 15;

const TABS = ["Overview", "Clients", "Projects", "Repositories", "Achievements", "Uploads", "Blog", "Audit Log", "Security View"];
let drawer = null;

onAuth(async (user) => {
  if (!user) {
    return void location.replace("/frontend/pages/auth.html?redirect=" + encodeURIComponent("/portfolio/admin"));
  }

  const isOwner = user.email && user.email.toLowerCase() === "manavkmlko@gmail.com";
  let isAdmin = isOwner;

  try {
    const me = await api("/auth/bootstrap", { method: "POST", auth: true });
    if (me?.is_admin) {
      isAdmin = true;
    }
  } catch (err) {
    console.warn("Admin bootstrap check:", err);
  }

  if (!isAdmin) {
    return void location.replace("/");
  }

  build();
});

function build() {
  const panel = h("div", { id: "tab-panel", role: "tabpanel" });
  const tabs = h("div", { class: "admin__tabs", role: "tablist" }, TABS.map((t, i) =>
    h("button", { class: "admin__tab", role: "tab", "aria-selected": String(i === 0), "data-cursor-hover": "", onclick: (e) => {
      tabs.querySelectorAll(".admin__tab").forEach((b) => b.setAttribute("aria-selected", String(b === e.currentTarget)));
      show(t, panel);
    } }, t)));
  root.replaceChildren(h("h1", { class: "sr-only" }, "Admin panel"), tabs, panel);
  show("Overview", panel);
}

async function show(tab, panel) {
  panel.replaceChildren(h("p", { class: "state", role: "status" }, "Loading…"));
  try { await ({ Overview: overview, Clients: clients, Projects: projects, Repositories: repositories, Achievements: achievements, Uploads: uploads, Blog: blog, "Audit Log": auditLog, "Security View": securityView }[tab])(panel); }
  catch (e) { panel.replaceChildren(h("p", { class: "state state--error", role: "alert" }, e.message)); }
}

/* ------------------------------------------------------------------ helpers */
const badge = (v) => h("span", { class: `badge badge--${v}` }, label(v));
const trunc = (s, n = 90) => (s && s.length > n ? s.slice(0, n) + "…" : s || "—");
const link = (u) => (u ? h("a", { href: u, target: "_blank", rel: "noopener noreferrer" }, "Open") : "—");

/** Real <table>. Sr. No. is 1, 2, 3… — never zero-padded. */
function table(cols, rows, start = 0) {
  return h("div", { class: "table-wrap" }, h("table", { class: "data" },
    h("thead", {}, h("tr", {}, cols.map((c) => h("th", { class: c.num ? "num" : "" }, c.h)))),
    h("tbody", {}, rows.length ? rows.map((r, i) => h("tr", {}, cols.map((c) => h("td", { class: c.num ? "num" : "" }, c.f(r, start + i + 1)))))
      : h("tr", {}, h("td", { colspan: cols.length }, "No records.")))));
}

/** Client-side search + filter + pagination over an already-fetched list. */
function listView(panel, { items, cols, searchKeys, filters = [], toolbar = [] }) {
  let q = "", page = 0; const fv = {};
  const out = h("div", {}); const bar = h("div", { class: "admin__bar" });
  const search = h("input", { type: "search", placeholder: "Search…", "aria-label": "Search", oninput: (e) => { q = e.target.value.toLowerCase(); page = 0; draw(); } });
  bar.append(search);
  filters.forEach((f) => bar.append(h("select", { "aria-label": f.label, onchange: (e) => { fv[f.key] = e.target.value; page = 0; draw(); } },
    h("option", { value: "" }, `All ${f.label}`), f.options.map((o) => h("option", { value: o }, label(o))))));
  toolbar.forEach((t) => bar.append(t));
  function draw() {
    const rows = items.filter((r) => (!q || searchKeys.some((k) => String(r[k] ?? "").toLowerCase().includes(q))) && filters.every((f) => !fv[f.key] || r[f.key] === fv[f.key]));
    const pages = Math.max(1, Math.ceil(rows.length / PAGE));
    page = Math.min(page, pages - 1);
    out.replaceChildren(table(cols, rows.slice(page * PAGE, page * PAGE + PAGE), page * PAGE),
      h("div", { class: "pager" }, h("span", {}, `${rows.length} records · page ${page + 1}/${pages}`),
        h("button", { class: "btn btn--ghost btn--sm", disabled: page === 0, onclick: () => { page--; draw(); } }, "Prev"),
        h("button", { class: "btn btn--ghost btn--sm", disabled: page >= pages - 1, onclick: () => { page++; draw(); } }, "Next")));
  }
  draw(); panel.replaceChildren(bar, out);
}

function openDrawer(title, ...body) {
  drawer?.remove();
  const close = () => { drawer?.remove(); drawer = null; };
  drawer = h("aside", { class: "drawer drawer--wide is-open", "aria-label": title },
    h("div", { class: "drawer__head" }, h("strong", {}, title), h("button", { class: "link-btn", onclick: close }, "Close")),
    h("div", { class: "drawer__body" }, ...body));
  drawer.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  document.body.append(drawer);
  return close;
}
const dl = (pairs) => h("dl", {}, pairs.flatMap(([k, v]) => [h("dt", {}, k), h("dd", {}, v ?? "—")]));

/* ------------------------------------------------------------------ Overview */
async function overview(panel) {
  const o = await api("/admin/overview", { auth: true });
  const stat = (n, l, warn) => h("div", { class: `stat${warn && n ? " stat--attention" : ""}` }, h("div", { class: "stat__n" }, String(n ?? 0)), h("div", { class: "stat__l" }, l));
  const A = o.needs_attention;
  panel.replaceChildren(
    h("div", { class: "panel" }, h("h3", {}, "Needs attention"), h("div", { class: "stat-grid" },
      stat(A.pending_requests, "Pending requests", 1), stat(A.unread_messages, "Unread messages", 1), stat(A.draft_projects, "Draft projects", 1),
      stat(A.draft_achievements, "Draft achievements", 1), stat(A.draft_uploads, "Draft uploads", 1), stat(A.draft_blog_posts, "Draft posts", 1),
      stat(A.critical_security_events, "Critical security events", 1))),
    h("h3", {}, "People"), h("div", { class: "stat-grid" }, stat(o.people.registered_users, "Registered users"), stat(o.people.clients_who_contacted, "Clients who contacted"), stat(o.people.total_requests, "Total requests")),
    h("h3", {}, "Requests"), h("div", { class: "stat-grid" }, Object.entries(o.requests).map(([k, v]) => stat(v, label(k)))),
    h("h3", {}, "Messaging"), h("div", { class: "stat-grid" }, stat(o.messaging.unread_messages, "Unread"), stat(o.messaging.active_conversations, "Active conversations")),
    h("h3", {}, "Content"), h("div", { class: "stat-grid" },
      stat(o.projects.total, "Projects"), stat(o.projects.published, "Published"), stat(o.projects.drafts, "Drafts"), stat(o.projects.archived, "Archived"),
      stat(o.achievements.total, "Achievements"), stat(o.uploads.total, "Uploads"), stat(o.uploads.published, "Uploads published"), stat(o.blog.published, "Posts published"), stat(o.blog.drafts, "Post drafts")),
    h("h3", {}, "Achievements by category"), h("div", { class: "stat-grid" }, Object.entries(o.achievements.by_category).map(([k, v]) => stat(v, label(k)))),
    h("h3", {}, "Reviews"), h("div", { class: "stat-grid" }, Object.entries(o.reviews).map(([k, v]) => stat(v, label(k)))),
    h("h3", {}, "Recent activity"),
    table([{ h: "Time", f: (r) => fmtAudit(r.occurred_at) }, { h: "Category", f: (r) => label(r.category) }, { h: "Action", f: (r) => label(r.action) }, { h: "Severity", f: (r) => badge(r.severity) }, { h: "Note", f: (r) => trunc(r.note) }], o.recent_activity));
}

/* ------------------------------------------------------------------ Clients */
async function clients(panel) {
  const items = await api("/admin/clients", { auth: true });
  listView(panel, {
    items, searchKeys: ["full_name", "email", "category"],
    filters: [{ key: "status", label: "statuses", options: ["pending", "in_discussion", "in_progress", "completed", "declined"] }, { key: "category", label: "categories", options: ["website", "pc_app", "mobile_app", "ai_automation", "robotics", "other"] }],
    cols: [
      { h: "Sr. No.", f: (r, n) => n }, { h: "Name", f: (r) => r.full_name }, { h: "E-Mail", f: (r) => r.email }, { h: "Phone", f: (r) => r.phone },
      { h: "Country", f: (r) => r.country }, { h: "Profession", f: (r) => r.profession }, { h: "Business", f: (r) => r.business }, { h: "Category", f: (r) => label(r.category) },
      { h: "Request Overview", f: (r) => (r.ai_overview?.summary ? trunc(r.ai_overview.summary, 140) : h("span", { class: "badge badge--pending" }, `AI ${label(r.ai_status)}`)) },
      { h: "Deadline", f: (r) => fmtDate(r.deadline) }, { h: "Payout", f: (r) => r.budget },
      { h: "View", f: (r) => h("button", { class: "btn btn--ghost btn--sm", onclick: () => clientDetail(r.id) }, "View") },
    ],
  });
}

/* ------------------------------------------------------------------ Checklist / completion (§17-35) */
const TASK_STATUSES = ["todo", "in_progress", "completed", "blocked", "skipped"];
const TASK_CATEGORIES = ["planning", "design", "frontend", "backend", "database", "authentication", "api", "ai", "automation", "integration", "testing", "security", "deployment", "documentation", "other"];

function checklistPanel(ownerType, ownerId, reopen) {
  const box = h("div", { class: "panel" }, h("p", { class: "state" }, "Loading checklist…"));
  refresh();

  async function refresh() {
    const [completion, tasks] = await Promise.all([
      api(`/admin/${ownerType}/${ownerId}/completion`, { auth: true }),
      api(`/admin/${ownerType}/${ownerId}/tasks`, { auth: true }),
    ]);
    const rows = tasks.map((t) => taskRow(t, refresh));
    const addForm = h("div", { class: "row-gap" },
      h("button", { class: "btn btn--ghost btn--sm", onclick: async () => {
        const title = prompt("Task title:"); if (!title) return;
        await api(`/admin/${ownerType}/${ownerId}/tasks`, { method: "POST", auth: true, body: { title, category: "other", weight: 5, status: "todo" } });
        refresh();
      } }, "+ Add task"),
      h("button", { class: "btn btn--ghost btn--sm", onclick: () => regenerateFlow(ownerType, ownerId, reopen) }, "Regenerate checklist (AI)"),
      ownerType === "request" ? h("button", { class: "btn btn--ghost btn--sm", onclick: () => convertToProject(ownerId, reopen) }, "Convert to Project") : null);

    box.replaceChildren(
      h("h3", {}, `Checklist — ${completion.completion_percent}% complete`),
      h("div", { class: "progress-track" }, (() => {
        const fill = h("div", { class: "progress-fill" });
        fill.style.setProperty("--progress", `${completion.completion_percent}%`);
        return fill;
      })()),
      h("p", { class: "tile__meta" }, `${completion.completed_count}/${completion.task_count} tasks done${completion.blocked_count ? ` · ${completion.blocked_count} blocked` : ""}`),
      tasks.length ? rows : h("p", { class: "state" }, "No tasks yet."),
      addForm);
  }
  return box;
}

function taskRow(t, onChanged) {
  const statusSel = h("select", { "aria-label": `Status for ${t.title}`, onchange: async (e) => {
    const body = { ...t, status: e.target.value };
    if (e.target.value === "blocked" && !body.blocked_reason) body.blocked_reason = prompt("Why is this blocked?") || "Blocked";
    await api(`/admin/tasks/${t.id}`, { method: "PUT", auth: true, body });
    onChanged();
  } }, TASK_STATUSES.map((s) => h("option", { value: s, selected: s === t.status }, label(s))));
  const weightInput = h("input", { type: "number", min: 1, max: 10, step: 0.5, value: t.weight, "aria-label": `Weight for ${t.title}`,
    onchange: async (e) => { await api(`/admin/tasks/${t.id}`, { method: "PUT", auth: true, body: { ...t, weight: Number(e.target.value) } }); onChanged(); } });
  weightInput.style.width = "56px";
  return h("div", { class: "task-row" },
    statusSel,
    h("span", { class: `task-row__title${t.status === "completed" ? " is-done" : ""}` }, t.title, t.is_manual_override ? " ✎" : "", t.status === "blocked" && t.blocked_reason ? ` — ${t.blocked_reason}` : ""),
    h("span", { class: "tile__meta" }, label(t.category)),
    weightInput,
    h("button", { class: "btn btn--ghost btn--sm", onclick: () => {
      const title = prompt("Title:", t.title); if (title === null) return;
      const description = prompt("Description:", t.description || "") || null;
      api(`/admin/tasks/${t.id}`, { method: "PUT", auth: true, body: { ...t, title, description } }).then(onChanged);
    } }, "Edit"),
    h("button", { class: "btn btn--ghost btn--sm", "data-cursor-glow": "red", onclick: async () => {
      if (!confirm(`Delete "${t.title}"?`)) return;
      await api(`/admin/tasks/${t.id}`, { method: "DELETE", auth: true }); onChanged();
    } }, "✕"));
}

async function regenerateFlow(ownerType, ownerId, onDone) {
  const closeDrawer = openDrawer("Regenerate checklist", h("p", { class: "state" }, "Asking the AI to review the checklist…"));
  let preview;
  try { preview = await api(`/admin/${ownerType}/${ownerId}/checklist/regenerate-preview`, { method: "POST", auth: true }); }
  catch (e) { drawer.replaceChildren(h("p", { class: "notice notice--error" }, e.message)); return; }

  const selectedAdd = new Set(preview.to_add.map((_, i) => i));
  const selectedObsolete = new Set(preview.to_obsolete.map((t) => t.id));
  const body = h("div", {},
    h("p", {}, preview.summary),
    h("div", { class: "row-gap" },
      h("div", { class: "diff-col" }, h("h4", {}, `Add (${preview.to_add.length})`),
        preview.to_add.length ? preview.to_add.map((item, i) => h("label", { class: "task-row" },
          h("input", { type: "checkbox", checked: true, onchange: (e) => (e.target.checked ? selectedAdd.add(i) : selectedAdd.delete(i)) }),
          h("span", { class: "task-row__title" }, item.title), h("span", { class: "tile__meta" }, label(item.category)))) : h("p", { class: "state" }, "Nothing new.")),
      h("div", { class: "diff-col" }, h("h4", {}, `Mark obsolete / skip (${preview.to_obsolete.length})`),
        preview.to_obsolete.length ? preview.to_obsolete.map((t) => h("label", { class: "task-row" },
          h("input", { type: "checkbox", checked: true, onchange: (e) => (e.target.checked ? selectedObsolete.add(t.id) : selectedObsolete.delete(t.id)) }),
          h("span", { class: "task-row__title" }, t.title))) : h("p", { class: "state" }, "Nothing to remove.")),
      h("div", { class: "diff-col" }, h("h4", {}, `Protected / kept as-is (${preview.to_keep.length})`),
        preview.to_keep.length ? preview.to_keep.map((t) => h("p", { class: "tile__meta" }, t.title)) : h("p", { class: "state" }, "None."))),
    h("button", { class: "btn btn--primary", onclick: async (e) => {
      e.target.disabled = true;
      await api(`/admin/${ownerType}/${ownerId}/checklist/regenerate-apply`, { method: "POST", auth: true, body: {
        add: preview.to_add.filter((_, i) => selectedAdd.has(i)), obsolete_task_ids: [...selectedObsolete],
      } });
      closeDrawer(); onDone();
    } }, "Apply selected changes"));
  drawer.querySelector(".drawer__body").replaceChildren(body);
}

function convertToProject(requestId, onDone) {
  const name = prompt("Project name:"); if (!name) return;
  const category = prompt("Category (websites / pc_apps / mobile_apps / robotics):", "websites");
  if (!["websites", "pc_apps", "mobile_apps", "robotics"].includes(category)) return alert("Category must be one of: websites, pc_apps, mobile_apps, robotics");
  api("/admin/clients/" + requestId + "/convert-to-project", { method: "POST", auth: true, body: { name, category } })
    .then(() => { alert("Project created — find it under the Projects tab."); onDone?.(); })
    .catch((e) => alert(e.message));
}

/* ------------------------------------------------------------------ Clients detail */
async function clientDetail(id) {
  const d = await api(`/admin/clients/${id}`, { auth: true });
  const r = d.request;
  const statusSel = h("select", { "aria-label": "Status" }, ["pending", "in_discussion", "in_progress", "completed", "declined"].map((s) => h("option", { value: s, selected: s === r.status }, label(s))));
  const msgBox = h("div", { class: "panel" }, h("p", { class: "state" }, "Loading conversation…"));
  const close = openDrawer(`${r.full_name} — request`,
    h("div", { class: "panel" }, h("h3", {}, "Client"), dl([["Name", r.full_name], ["Email", r.email], ["Phone", r.phone], ["Country", r.country], ["Profession", r.profession], ["Business", r.business]])),
    h("div", { class: "panel" }, h("h3", {}, "Original submission"), dl([["Looking for", label(r.category)], ["Deadline", fmtDate(r.deadline)], ["Budget / payout", r.budget], ["Description", r.project_description], ["Submitted", fmtAudit(r.created_at)]])),
    h("div", { class: "panel" }, h("h3", {}, `AI overview (${label(r.ai_status)})`),
      r.ai_overview ? dl([["Summary", r.ai_overview.summary], ["Type", r.ai_overview.project_type], ["Key requirements", (r.ai_overview.key_requirements || []).join("; ")], ["Notes", r.ai_overview.important_notes]]) : h("p", {}, "No AI overview yet."),
      h("button", { class: "btn btn--ghost btn--sm", onclick: async (e) => { e.target.disabled = true; await api(`/admin/clients/${id}/retry-ai`, { method: "POST", auth: true }).catch(() => {}); close(); clientDetail(id); } }, "Regenerate")),
    checklistPanel("request", id, () => { close(); clientDetail(id); }),
    h("div", { class: "panel" }, h("h3", {}, "Status"), h("div", { class: "row-gap" }, statusSel,
      h("button", { class: "btn btn--primary btn--sm", onclick: async () => { await api(`/admin/clients/${id}/status`, { method: "PUT", body: { new_status: statusSel.value }, auth: true }); close(); clientDetail(id); } }, "Update")),
      h("ul", {}, d.status_history.map((s) => h("li", {}, `${fmtAudit(s.changed_at)}: ${label(s.old_status || "—")} → ${label(s.new_status)}`)))),
    msgBox,
    h("div", { class: "panel" }, h("h3", {}, "Review"), d.review ? dl([["Overall", "★".repeat(d.review.overall_rating)], ["Professionalism", "★".repeat(d.review.professionalism_rating)], ["Satisfaction", "★".repeat(d.review.satisfaction_rating)], ["Expectations", "★".repeat(d.review.expectations_rating)], ["Understanding", "★".repeat(d.review.usability_rating)], ["Pricing", "★".repeat(d.review.pricing_rating)], ["Sufficiency", "★".repeat(d.review.sufficiency_rating)], ["Note", d.review.note]]) : h("p", {}, "No review yet.")),
    h("div", { class: "panel" }, h("h3", {}, "Audit history"), h("ul", {}, d.audit.map((a) => h("li", {}, `${fmtAudit(a.occurred_at)} — ${label(a.action)} (${a.severity})`)))));
  if (r.rtdb_conversation_id) chatPanel(msgBox, r.rtdb_conversation_id, r.firebase_uid);
  else msgBox.replaceChildren(h("h3", {}, "Conversation"), h("p", {}, "No conversation yet."));
}

function chatPanel(box, cid, clientUid) {
  const adminUid = currentUser()?.uid;
  rtdb.initPresence(adminUid);

  const list = h("div", { class: "drawer__body" }, h("p", { class: "state" }, "Loading…"));
  list.style.maxHeight = "320px";
  const onlineDot = h("span", { class: "badge" }, "offline");
  const typingNote = h("p", { class: "typing-note" });
  const ta = h("textarea", { "aria-label": "Reply", maxlength: 4000 });
  const sendErr = h("span", { class: "draft-tag" });

  box.replaceChildren(
    h("h3", {}, "Conversation ", onlineDot),
    list, typingNote,
    h("div", { class: "row-gap" }, ta),
    h("div", { class: "row-gap" },
      h("button", { class: "btn btn--primary btn--sm", onclick: send }, "Send"), sendErr));

  rtdb.listenMessages(cid, (msgs) => {
    if (!msgs.length) return list.replaceChildren(h("p", { class: "state" }, "No messages yet."));
    list.replaceChildren(...msgs.map((m) => h("div", { class: `msg${m.sender_uid === adminUid ? " msg--mine" : ""}` }, m.content, h("span", { class: "msg__time" }, fmtAudit(m.created_at)))));
    list.scrollTop = list.scrollHeight;
  });
  rtdb.listenPresence(clientUid, (online) => {
    onlineDot.textContent = online ? "online" : "offline";
    onlineDot.className = `badge badge--${online ? "published" : "draft"}`;
  });
  rtdb.listenTyping(cid, clientUid, (t) => { typingNote.textContent = t ? "Client is typing…" : ""; });
  rtdb.listenDraft(cid, adminUid, (c) => { if (document.activeElement !== ta) ta.value = c; });
  api(`/messages/${cid}`, { auth: true }).catch(() => {}); // marks the client's messages read server-side

  let saveT = null;
  ta.addEventListener("input", () => {
    rtdb.setTyping(cid, adminUid, true);
    clearTimeout(saveT);
    saveT = setTimeout(() => rtdb.saveDraft(cid, adminUid, ta.value), 500);
  });
  ta.addEventListener("blur", () => rtdb.setTyping(cid, adminUid, false));

  async function send() {
    const text = ta.value.trim(); if (!text) return;
    try { await api(`/messages/${cid}`, { method: "POST", body: { content: text }, auth: true }); ta.value = ""; rtdb.setTyping(cid, adminUid, false); sendErr.textContent = ""; }
    catch (e) { sendErr.textContent = e.message; }
  }
}

/* ------------------------------------------------------------------ generic editor */
function editor({ title, fields, initial, save, remove, onDone, imageBucket }) {
  const els = {}; const out = h("div", { "aria-live": "polite" });
  const close = openDrawer(title, h("form", { class: "form form--full", novalidate: true, onsubmit: async (e) => {
    e.preventDefault();
    const body = {};
    for (const f of fields) {
      let v = els[f.key].value.trim();
      if (f.type === "datetime-local") v = v ? new Date(v).toISOString() : null;
      else if (f.type === "number") v = Number(v || 0);
      else if (v === "") v = f.required ? "" : null;
      body[f.key] = v;
    }
    const missing = fields.find((f) => f.required && !body[f.key]);
    if (missing) return out.replaceChildren(h("p", { class: "notice notice--error" }, `${missing.label} is required.`));
    try { await save(body); close(); onDone(); } catch (err) { out.replaceChildren(h("p", { class: "notice notice--error", role: "alert" }, err.message)); }
  } },
    fields.map((f) => {
      const val = initial?.[f.key] ?? f.default ?? "";
      const id = `ed-${f.key}`;
      let el;
      if (f.options) el = h("select", { id }, f.options.map((o) => h("option", { value: o, selected: o === val }, label(o))));
      else if (f.type === "textarea") { el = h("textarea", { id }); el.value = val; }
      else if (f.type === "datetime-local") el = h("input", { id, type: "datetime-local", value: val ? new Date(val).toISOString().slice(0, 16) : "" });
      else el = h("input", { id, type: f.type || "text", value: val });
      els[f.key] = el;
      const extra = f.upload ? h("input", { type: "file", accept: "image/png,image/jpeg,image/webp", "aria-label": `Upload ${f.label}`, onchange: async (e) => {
        const file = e.target.files[0]; if (!file) return;
        try {
          const s = await api("/admin/media/upload-url", { method: "POST", auth: true, body: { bucket: f.upload, content_type: file.type, size: file.size } });
          const up = await fetch(s.signed_url, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
          if (!up.ok) throw new Error("Upload failed");
          el.value = s.public_url;
          out.replaceChildren(h("p", { class: "notice notice--ok" }, "Image uploaded."));
        } catch (err) { out.replaceChildren(h("p", { class: "notice notice--error", role: "alert" }, err.message || "Upload failed")); }
      } }) : null;
      const preview = f.upload && val ? h("img", { class: "tile__media", src: val, alt: `${f.label} preview` }) : null;
      return h("div", { class: "field" }, h("label", { for: id }, f.label + (f.required ? " *" : "")), el, extra, preview);
    }),
    out,
    h("div", { class: "row-gap" }, h("button", { class: "btn btn--primary", type: "submit" }, "Save"),
      remove ? h("button", { class: "btn btn--danger", type: "button", "data-cursor-glow": "red", onclick: async () => {
        if (!confirm("Delete this permanently? This can't be undone.")) return;
        try { await remove(); close(); onDone(); } catch (err) { out.replaceChildren(h("p", { class: "notice notice--error" }, err.message)); }
      } }, "Delete") : null)));
}

const STATUS = ["draft", "published", "archived"], STATUS2 = ["draft", "published"];
const newBtn = (text, fn) => h("button", { class: "btn btn--primary btn--sm", onclick: fn }, text);

/* ------------------------------------------------------------------ Projects */
async function projects(panel) {
  const items = await api("/projects/admin", { auth: true });
  const fields = [
    { key: "name", label: "Name", required: true }, { key: "description", label: "Description", type: "textarea", required: true },
    { key: "category", label: "Category", options: ["websites", "pc_apps", "mobile_apps", "robotics"] },
    { key: "logo_url", label: "Logo", upload: "project-logos" }, { key: "github_url", label: "GitHub Repo URL", type: "url" }, { key: "website_url", label: "Website URL", type: "url" },
    { key: "status", label: "Status", options: STATUS }, { key: "sort_order", label: "Sort order", type: "number", default: 0 }, { key: "published_at", label: "Published on", type: "datetime-local" },
  ];
  const again = () => projects(panel);
  listView(panel, {
    items, searchKeys: ["name", "description"], filters: [{ key: "category", label: "categories", options: ["websites", "pc_apps", "mobile_apps", "robotics"] }, { key: "status", label: "states", options: STATUS }],
    toolbar: [newBtn("+ New project", () => editor({ title: "New project", fields, save: (b) => api("/projects/admin", { method: "POST", body: b, auth: true }), onDone: again }))],
    cols: [
      { h: "Sr. No.", f: (r, n) => n }, { h: "Logo", f: (r) => (r.logo_url ? h("img", { class: "logo-sm", src: r.logo_url, alt: "" }) : "—") }, { h: "Name", f: (r) => r.name },
      { h: "Description", f: (r) => trunc(r.description) }, { h: "Category", f: (r) => label(r.category) }, { h: "Published On", f: (r) => fmtDate(r.published_at) },
      { h: "Updated On", f: (r) => fmtDate(r.updated_at) }, { h: "GitHub Repo", f: (r) => link(r.github_url) }, { h: "Website Link", f: (r) => link(r.website_url) },
      { h: "Edit", f: (r) => h("span", {}, badge(r.status), " ",
        h("button", { class: "btn btn--ghost btn--sm", onclick: () => editor({ title: `Edit ${r.name}`, fields, initial: r, save: (b) => api(`/projects/admin/${r.id}`, { method: "PUT", body: b, auth: true }), remove: () => api(`/projects/admin/${r.id}`, { method: "DELETE", auth: true }), onDone: again }) }, "Edit"), " ",
        h("button", { class: "btn btn--ghost btn--sm", onclick: () => openDrawer(`${r.name} — checklist`, checklistPanel("project", r.id, again)) }, "Checklist")) },
    ],
  });
}

/* ------------------------------------------------------------------ Repositories */
async function repositories(panel) {
  const items = await api("/repositories/admin", { auth: true });
  const again = () => repositories(panel);
  const sync = h("button", { class: "btn btn--primary btn--sm", onclick: async (e) => { e.target.disabled = true; e.target.textContent = "Syncing…"; try { await api("/repositories/admin/sync", { method: "POST", auth: true }); } catch { /* shown by reload */ } again(); } }, "Sync from GitHub");
  listView(panel, {
    items, searchKeys: ["repo_name", "description", "source"], toolbar: [sync],
    cols: [
      { h: "Sr. No.", f: (r, n) => n }, { h: "Name", f: (r) => `${r.source}/${r.repo_name}` }, { h: "Description", f: (r) => trunc(r.description) },
      { h: "Languages", f: (r) => (r.languages || []).map((l) => `${l.name} ${l.percent}%`).join(" · ") || "—" }, { h: "Published On", f: (r) => fmtDate(r.published_on) },
      { h: "Stars", num: 1, f: (r) => r.stars }, { h: "Forks", num: 1, f: (r) => r.forks }, { h: "Updated On", f: (r) => fmtDate(r.github_updated_at) }, { h: "GitHub Repo", f: (r) => link(r.github_url) },
      { h: "View", f: (r) => h("button", { class: "btn btn--ghost btn--sm", onclick: () => openDrawer(r.repo_name, dl([["Source", r.source], ["Visible on site", r.is_visible ? "Yes" : "No"], ["Description", r.description], ["Stars", r.stars], ["Forks", r.forks]]),
        h("button", { class: "btn btn--primary btn--sm", onclick: async () => { await api(`/repositories/admin/${r.id}/visibility?is_visible=${!r.is_visible}`, { method: "PATCH", auth: true }); drawer.remove(); again(); } }, r.is_visible ? "Hide from site" : "Show on site")) }, "View") },
    ],
  });
}

/* ------------------------------------------------------------------ Achievements */
async function achievements(panel) {
  const items = await api("/achievements/admin", { auth: true });
  const fields = [
    { key: "title", label: "Title", required: true }, { key: "category", label: "Category", options: ["development", "hackathon", "robotics", "gaming", "education"] },
    { key: "place", label: "Place" }, { key: "experience", label: "Experience", type: "textarea" }, { key: "event_date", label: "Date", type: "date" },
    { key: "image_url", label: "Certificate / medal / trophy image", upload: "achievement-images" }, { key: "status", label: "Status", options: STATUS2 },
  ];
  const again = () => achievements(panel);
  listView(panel, {
    items, searchKeys: ["title", "place", "experience"], filters: [{ key: "category", label: "categories", options: ["development", "hackathon", "robotics", "gaming", "education"] }],
    toolbar: [newBtn("+ New achievement", () => editor({ title: "New achievement", fields, save: (b) => api("/achievements/admin", { method: "POST", body: b, auth: true }), onDone: again }))],
    cols: [
      { h: "Sr. No.", f: (r, n) => n }, { h: "Category", f: (r) => label(r.category) }, { h: "Place", f: (r) => r.place || "—" }, { h: "Experience", f: (r) => trunc(r.experience) },
      { h: "Edit", f: (r) => h("span", {}, badge(r.status), " ", h("button", { class: "btn btn--ghost btn--sm", onclick: () => editor({ title: `Edit ${r.title}`, fields, initial: r, save: (b) => api(`/achievements/admin/${r.id}`, { method: "PUT", body: b, auth: true }), remove: () => api(`/achievements/admin/${r.id}`, { method: "DELETE", auth: true }), onDone: again }) }, "Edit")) },
    ],
  });
}

/* ------------------------------------------------------------------ Uploads */
async function uploads(panel) {
  const items = await api("/uploads/admin", { auth: true });
  const cats = ["project_demo", "tutorial", "experiment", "showcase", "other"];
  const fields = [
    { key: "title", label: "Title", required: true }, { key: "category", label: "Category", options: cats }, { key: "description", label: "Description", type: "textarea" },
    { key: "thumbnail_url", label: "Thumbnail", upload: "upload-thumbnails" }, { key: "external_link", label: "Link", type: "url", required: true }, { key: "status", label: "Status", options: STATUS2 },
  ];
  const again = () => uploads(panel);
  listView(panel, {
    items, searchKeys: ["title", "description"], filters: [{ key: "category", label: "categories", options: cats }, { key: "status", label: "states", options: STATUS2 }],
    toolbar: [newBtn("+ New upload", () => editor({ title: "New upload", fields, save: (b) => api("/uploads/admin", { method: "POST", body: b, auth: true }), onDone: again }))],
    cols: [
      { h: "Sr. No.", f: (r, n) => n }, { h: "Title", f: (r) => r.title }, { h: "Category", f: (r) => label(r.category) }, { h: "Description", f: (r) => trunc(r.description) },
      { h: "Uploaded On", f: (r) => fmtDate(r.uploaded_on) }, { h: "Link", f: (r) => link(r.external_link) },
      { h: "Edit", f: (r) => h("span", {}, badge(r.status), " ", h("button", { class: "btn btn--ghost btn--sm", onclick: () => editor({ title: `Edit ${r.title}`, fields, initial: r, save: (b) => api(`/uploads/admin/${r.id}`, { method: "PUT", body: b, auth: true }), remove: () => api(`/uploads/admin/${r.id}`, { method: "DELETE", auth: true }), onDone: again }) }, "Edit")) },
    ],
  });
}

/* ------------------------------------------------------------------ Blog (no Link column — posts are internal) */
async function blog(panel) {
  const items = await api("/blog/admin/all", { auth: true });
  const cats = ["development", "ai", "robotics", "projects", "tutorials", "other"];
  const fields = [
    { key: "title", label: "Title", required: true }, { key: "slug", label: "Slug (URL)", required: true }, { key: "category", label: "Category", options: cats },
    { key: "excerpt", label: "Description / excerpt", type: "textarea" }, { key: "content", label: "Full article", type: "textarea", required: true },
    { key: "cover_image_url", label: "Cover image (optional)", upload: "blog-images" }, { key: "published_at", label: "Publication date", type: "datetime-local" }, { key: "status", label: "Status", options: STATUS2 },
  ];
  const again = () => blog(panel);
  listView(panel, {
    items, searchKeys: ["title", "excerpt"], filters: [{ key: "category", label: "categories", options: cats }, { key: "status", label: "states", options: STATUS2 }],
    toolbar: [newBtn("+ New post", () => editor({ title: "New post", fields, save: (b) => api("/blog/admin", { method: "POST", body: b, auth: true }), onDone: again }))],
    cols: [
      { h: "Sr. No.", f: (r, n) => n }, { h: "Title", f: (r) => r.title }, { h: "Category", f: (r) => label(r.category) }, { h: "Description", f: (r) => trunc(r.excerpt) },
      { h: "Published On", f: (r) => fmtDate(r.published_at) }, { h: "Updated On", f: (r) => fmtDate(r.updated_at) },
      { h: "Edit", f: (r) => h("span", {}, badge(r.status), " ", h("button", { class: "btn btn--ghost btn--sm", onclick: () => editor({ title: `Edit ${r.title}`, fields, initial: r, save: (b) => api(`/blog/admin/${r.id}`, { method: "PUT", body: b, auth: true }), remove: () => api(`/blog/admin/${r.id}`, { method: "DELETE", auth: true }), onDone: again }) }, "Edit")) },
    ],
  });
}

/* ------------------------------------------------------------------ Audit log */
async function auditLog(panel) {
  const items = await api("/admin/audit?limit=200", { auth: true });
  const again = () => auditLog(panel);
  listView(panel, {
    items, searchKeys: ["action", "performer_name", "performer_uid", "ip_address", "note"],
    filters: [{ key: "severity", label: "severities", options: ["Low", "Alert", "Critical"] }, { key: "category", label: "categories", options: [...new Set(items.map((i) => i.category))] }],
    cols: [
      { h: "Sr. No.", f: (r, n) => n }, { h: "Date - Time", f: (r) => fmtAudit(r.occurred_at) }, { h: "Category", f: (r) => label(r.category) }, { h: "Action Performed", f: (r) => label(r.action) },
      { h: "Name of Performer", f: (r) => r.performer_name || r.performer_uid || "System / anonymous" }, { h: "IP Address", f: (r) => r.ip_address }, { h: "Note", f: (r) => r.note || "—" },
      { h: "Severity", f: (r) => badge(r.severity) },
      { h: "Edit", f: (r) => h("button", { class: "btn btn--ghost btn--sm", onclick: () => editor({ title: "Edit note", fields: [{ key: "note", label: "Note", type: "textarea", required: true }], initial: r,
        save: (b) => api(`/admin/audit/${r.id}/note`, { method: "PUT", body: b, auth: true }), onDone: again }) }, "Edit") },
    ],
  });
}

/* ------------------------------------------------------------------ Security view */
async function securityView(panel) {
  const items = await api("/security/events?limit=200", { auth: true });
  listView(panel, {
    items, searchKeys: ["action", "ip_address", "source", "reason"], filters: [{ key: "severity", label: "severities", options: ["Low", "Alert", "Critical"] }, { key: "action", label: "actions", options: [...new Set(items.map((i) => i.action))] }],
    cols: [
      { h: "Sr. No.", f: (r, n) => n }, { h: "Date - Time", f: (r) => fmtAudit(r.occurred_at) }, { h: "Action", f: (r) => label(r.action) }, { h: "IP Address", f: (r) => r.ip_address },
      { h: "Performer / Source", f: (r) => r.performer_uid || r.source || "Anonymous" }, { h: "Reason", f: (r) => trunc(r.reason, 120) }, { h: "Severity", f: (r) => badge(r.severity) },
      { h: "View", f: (r) => h("button", { class: "btn btn--ghost btn--sm", onclick: () => openDrawer("Security event", dl([["When", fmtAudit(r.occurred_at)], ["Category", label(r.category)], ["Action", label(r.action)], ["IP", r.ip_address], ["Source", r.source], ["Performer", r.performer_uid], ["Reason", r.reason], ["Severity", r.severity], ["Details", JSON.stringify(r.metadata)]])) }, "View") },
    ],
  });
}
