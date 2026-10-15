/**
 * collection.js — one renderer for every public list page (projects, repositories,
 * achievements, uploads, blog). The page's <main data-kind="..."> picks the config.
 * Content comes from the API (published only) — adding content never needs a code edit.
 */
import { api, h, fmtDate, fmtDateDay, label } from "../core/api.js";

const LANG_COLORS = {
  JavaScript: "#f1e05a",
  TypeScript: "#3178c6",
  Python: "#3572A5",
  HTML: "#e34c26",
  CSS: "#563d7c",
  Vue: "#41b883",
  React: "#61dafb",
  Shell: "#89e051",
  C: "#555555",
  "C++": "#f34b7d",
  Java: "#b07219",
  Dart: "#00B4AB",
  Go: "#00ADD8",
  Rust: "#dea584",
};

function normalizeRepo(r) {
  return {
    name: r.name || r.repo_name,
    url: r.html_url || r.github_url,
    desc: r.description || "Open-source repository on GitHub.",
    lang: r.language || (r.languages?.[0]?.name) || "Code",
    stars: r.stargazers_count ?? r.stars ?? 0,
    forks: r.forks_count ?? r.forks ?? 0,
    updated: r.updated_at || r.github_updated_at,
    source: r.source || "manav-km",
  };
}

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
    tile: (raw) => {
      const r = normalizeRepo(raw);
      const dotColor = LANG_COLORS[r.lang] || "var(--accent-blue)";
      return h("article", { class: "card tile repo-card", "data-reveal": "" },
        h("div", { class: "repo-card__header" },
          h("div", { class: "repo-card__title-row" },
            h("svg", { class: "repo-card__book-icon", viewBox: "0 0 16 16", width: "16", height: "16", "aria-hidden": "true" },
              h("path", { fill: "currentColor", d: "M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1h-8a1 1 0 00-1 1v6.708A2.486 2.486 0 014.5 9h8V1.5z" })
            ),
            h("h3", { class: "repo-card__name" },
              h("a", { href: r.url, target: "_blank", rel: "noopener noreferrer", "data-cursor-hover": "" }, r.name)
            )
          ),
          h("span", { class: "repo-card__badge" }, "Public")
        ),
        h("p", { class: "repo-card__desc" }, r.desc),
        h("div", { class: "repo-card__footer" },
          h("div", { class: "repo-card__meta" },
            h("span", { class: "repo-card__lang" },
              h("span", { class: "repo-card__lang-dot", style: `background-color: ${dotColor};` }),
              r.lang
            ),
            h("span", { class: "repo-card__stat", title: `${r.stars} Stars` },
              h("svg", { viewBox: "0 0 16 16", width: "14", height: "14", fill: "currentColor", "aria-hidden": "true" },
                h("path", { d: "M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25z" })
              ),
              String(r.stars)
            ),
            h("span", { class: "repo-card__stat", title: `${r.forks} Forks` },
              h("svg", { viewBox: "0 0 16 16", width: "14", height: "14", fill: "currentColor", "aria-hidden": "true" },
                h("path", { d: "M5 3.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm0 2.122a2.25 2.25 0 10-1.5 0v.878A2.25 2.25 0 005.75 8.5h4.5A2.25 2.25 0 0012.5 6.25v-.878a2.25 2.25 0 10-1.5 0v.878a.75.75 0 01-.75.75h-4.5A.75.75 0 015 6.25v-.878zm3.75 7.378a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm0 2.122a2.25 2.25 0 10-1.5 0v-2.122a.75.75 0 01.75-.75h.75a.75.75 0 01.75.75v2.122z" })
              ),
              String(r.forks)
            )
          ),
          h("a", { class: "repo-card__view-link", href: r.url, target: "_blank", rel: "noopener noreferrer", "data-cursor-hover": "" },
            "View Code \u2192"
          )
        )
      );
    },
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
    let items = [];
    if (main.dataset.kind === "repositories") {
      try {
        const ghRes = await fetch("https://api.github.com/users/manav-km/repos?per_page=100&sort=updated");
        if (ghRes.ok) {
          const ghRepos = await ghRes.json();
          // Filter out forks and any trd-dnmx repos
          items = ghRepos.filter((r) => !r.fork && !r.name.toLowerCase().includes("trd-dnmx") && !r.owner?.login?.toLowerCase().includes("trd-dnmx"));
        }
      } catch (err) {
        console.warn("Direct GitHub API failed, using backend fallback:", err);
      }
      if (!items.length) {
        items = (await api(cfg.endpoint)).filter((r) => r.source !== "trd-dnmx" && !r.repo_name?.toLowerCase().includes("trd-dnmx"));
      }
    } else {
      const q = active !== "all" ? `?category=${encodeURIComponent(active)}` : "";
      items = await api(cfg.endpoint + q);
    }

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
