import { api, h, fmtDate, label } from "../core/api.js";

const slug = decodeURIComponent(location.pathname.split("/").filter(Boolean).pop() || "");
const root = document.getElementById("post");

try {
  const p = await api(`/blog/${encodeURIComponent(slug)}`);
  document.title = `${p.title} — Manav-KM`;
  root.replaceChildren(
    h("p", { class: "card__eyebrow" }, `${label(p.category)} · ${fmtDate(p.published_at)}`),
    h("h1", { class: "page-hero__title post-title" }, p.title),
    p.cover_image_url ? h("img", { class: "tile__media", src: p.cover_image_url, alt: "" }) : null,
    // Content is rendered as plain paragraphs (textContent) — never as HTML — so a post can't inject script.
    ...p.content.split(/\n{2,}/).map((para) => h("p", {}, para)),
    h("a", { class: "link-btn", href: "/frontend/pages/blog.html" }, "← Back to all posts"));
} catch (e) {
  root.replaceChildren(h("p", { class: "state state--error", role: "alert" }, e.status === 404 ? "This post doesn't exist (or isn't published)." : e.message));
}
