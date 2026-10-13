/**
 * collection.js — one renderer for every public list page (projects, repositories,
 * achievements, uploads, blog). The page's <main data-kind="..."> picks the config.
 * Content comes from the API (published only) — adding content never needs a code edit.
 */
import { api, h, fmtDate, fmtDateDay, label } from "../core/api.js";

const KINDS = {
  projects: {
    endpoint: "/projects", filters: ["all", "websites", "pc_apps", "mobile_apps", "robotics"],
    filterLabels: { all: "ALL", websites: "WEBSITES", pc_apps: "PC APPS", mobile_apps: "MOBILE APPS", robotics: "ROBOTICS" },
    tile: (p) => h("article", { class: "card tile", "data-reveal": "" },
      p.logo_url ? h("img", { class: "tile__logo", src: p.logo_url, alt: `${p.name} logo`, loading: "lazy" }) : null,
      h("p", { class: "card__eyebrow" }, label(p.category)),
      h("h3", { class: "card__title" }, p.name),
      h("p", { class: "card__desc" }, p.description),
      h("div", { class: "tile__links" },
        p.github_url ? h("a", { href: p.github_url, target: "_blank", rel: "noopener noreferrer" }, "GitHub Repo") : null,
        p.website_url ? h("a", { href: p.website_url, target: "_blank", rel: "noopener noreferrer" }, "Website") : null)),
  },
  repositories: {
    endpoint: "/repositories", filters: null,
    tile: (r) => h("article", { class: "card tile", "data-reveal": "" },
      h("p", { class: "card__eyebrow" }, r.source),
      h("h3", { class: "card__title" }, r.repo_name),
      h("p", { class: "card__desc" }, r.description || "No description provided."),
      h("p", { class: "langs" }, r.languages?.length ? r.languages.map((l) => `${l.name} ${l.percent}%`).join(" · ") : "Languages unavailable"),
      h("p", { class: "tile__meta" }, `Published On: ${fmtDate(r.published_on)}`),
      h("p", { class: "tile__meta" }, `Updated: ${fmtDate(r.github_updated_at)} · Stars: ${r.stars} · Forks: ${r.forks}`),
      h("div", { class: "tile__links" }, h("a", { href: r.github_url, target: "_blank", rel: "noopener noreferrer" }, "VIEW REPOSITORY"))),
  },
  achievements: {
    endpoint: "/achievements", filters: ["all", "development", "hackathon", "robotics", "gaming", "education"],
    tile: (a) => h("article", { class: "card tile", "data-reveal": "" },
      a.image_url ? h("img", { class: "tile__media", src: a.image_url, alt: `${a.title} — certificate or award`, loading: "lazy" }) : null,
      h("p", { class: "card__eyebrow" }, label(a.category)),
      h("h3", { class: "card__title" }, a.title),
      a.place ? h("p", { class: "card__desc" }, `Place: ${a.place}`) : null,
      a.experience ? h("p", { class: "card__desc" }, a.experience) : null,
      h("p", { class: "tile__meta" }, a.event_date ? new Date(a.event_date).getFullYear() : "")),
  },
  uploads: {
    endpoint: "/uploads", filters: ["all", "project_demo", "tutorial", "experiment", "showcase", "other"],
    tile: (u) => h("article", { class: "card tile", "data-reveal": "" },
      h("a", { href: u.external_link, target: "_blank", rel: "noopener noreferrer", "aria-label": `Open ${u.title} in a new tab` },
        u.thumbnail_url ? h("img", { class: "tile__media", src: u.thumbnail_url, alt: `${u.title} thumbnail`, loading: "lazy" })
                        : h("div", { class: "tile__media" })),
      h("p", { class: "card__eyebrow" }, label(u.category)),
      h("h3", { class: "card__title" }, u.title),
      u.description ? h("p", { class: "card__desc" }, u.description) : null,
      h("p", { class: "tile__meta" }, fmtDateDay(u.uploaded_on))),
  },
  blog: {
    endpoint: "/blog", filters: ["all", "development", "ai", "robotics", "projects", "tutorials", "other"],
    tile: (b) => h("a", { class: "card tile", href: `/blog/${encodeURIComponent(b.slug)}`, "data-reveal": "" },
      h("p", { class: "card__eyebrow" }, label(b.category)),
      h("h3", { class: "card__title" }, b.title),
      b.excerpt ? h("p", { class: "card__desc" }, b.excerpt) : null,
      h("p", { class: "tile__meta" }, `Published ${fmtDate(b.published_at)}`)),
  },
};

const main = document.querySelector("[data-kind]");
const cfg = KINDS[main.dataset.kind];
const filtersEl = document.getElementById("filters");
const grid = document.getElementById("grid");
let active = "all";

function setState(text, error = false) {
  grid.replaceChildren(h("p", { class: `state${error ? " state--error" : ""}`, role: error ? "alert" : "status" }, text));
}

async function load() {
  setState("Loading…");
  try {
    const q = active !== "all" ? `?category=${encodeURIComponent(active)}` : "";
    const items = await api(cfg.endpoint + q);
    if (!items.length) return setState("Nothing here yet — check back soon.");
    grid.replaceChildren(...items.map(cfg.tile));
    document.dispatchEvent(new Event("content:rendered"));
    // reveal-on-scroll for dynamically added tiles
    grid.querySelectorAll("[data-reveal]").forEach((el) => requestAnimationFrame(() => el.classList.add("is-visible")));
  } catch (e) { setState(e.message, true); }
}

if (cfg.filters) {
  cfg.filters.forEach((f) => {
    const b = h("button", { class: "filter", type: "button", "aria-pressed": String(f === active), "data-cursor-hover": "",
      onclick: () => { active = f; filtersEl.querySelectorAll(".filter").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); load(); } },
      cfg.filterLabels?.[f] || label(f).toUpperCase());
    filtersEl.append(b);
  });
}
load();
