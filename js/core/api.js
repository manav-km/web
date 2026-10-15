/**
 * api.js — the only place the frontend talks to the backend, plus safe DOM helpers.
 * All dynamic text is inserted with textContent (never innerHTML) to rule out XSS.
 */
import { API_BASE } from "./config.js";
import { getIdToken } from "./auth.js";

export async function api(path, { method = "GET", body, auth = false } = {}) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = await getIdToken();
    if (!token) throw new ApiError(401, "Please sign in first.");
    headers.Authorization = `Bearer ${token}`;
  }
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  }
  if (res.status === 204) return null;
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON error body */ }
  if (!res.ok) {
    const msg = res.status === 429 ? "Too many requests — please wait a bit and try again."
      : res.status === 403 ? "You're not authorized to do that."
      : typeof data?.detail === "string" ? data.detail : "Something went wrong. Please try again.";
    throw new ApiError(res.status, msg);
  }
  return data;
}

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

/** Create an element; children/strings are appended as text nodes only. */
export function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "href" || k === "src") node.setAttribute(k, safeUrl(v));
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

/** Only http(s) URLs (and same-site paths) are allowed — blocks javascript: URLs. */
export function safeUrl(url) {
  try {
    const u = new URL(url, window.location.origin);
    return ["http:", "https:"].includes(u.protocol) ? u.href : "#";
  } catch { return "#"; }
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const p2 = (n) => String(n).padStart(2, "0");

/** DD/MM/YYYY */
export function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`;
}
/** DD/MM/YYYY | Day  (Uploads, §14) */
export function fmtDateDay(iso) {
  if (!iso) return "—";
  return `${fmtDate(iso)} | ${DAYS[new Date(iso).getDay()]}`;
}
/** DD / MM / YYYY - HH : MM : SS  (Audit log, §37) */
export function fmtAudit(iso) {
  const d = new Date(iso);
  return `${p2(d.getDate())} / ${p2(d.getMonth() + 1)} / ${d.getFullYear()} - ${p2(d.getHours())} : ${p2(d.getMinutes())} : ${p2(d.getSeconds())}`;
}
export const label = (s) => String(s || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
