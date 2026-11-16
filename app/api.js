// make.fun's public API, read-only: GET https://make.fun/api/... only.
// The API answers any origin (CORS). Every answer is cached and revalidated
// with its ETag, so a view you revisit costs one small request, and a repeat
// inside the same minute costs a 304 with no body at all. Answers are also
// kept in localStorage, so a reload revalidates instead of refetching.
//
//   getBoard()               the live bounty board (one request, all open)
//   getBounty(slug)          one bounty: summary, rules, live rewards
//   getLeaderboard(slug, phase, view)   that bounty's leaderboard, all rows
//   getProfile(handle)       an account's public profile and its entries
//   siteUrl(path)            an API-provided relative URL on make.fun
//   stats                    { requests, revalidated, served } for the footer

const API = 'https://make.fun/api';
const SITE = 'https://make.fun';
const STORE_KEY = 'mf-cache-v1';
const MAX_STORED = 40;

export const stats = { requests: 0, revalidated: 0, served: 0 };

// path -> { etag, body, savedAt }
const memory = new Map();

function loadStored() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const entries = JSON.parse(raw);
    if (!Array.isArray(entries)) return;
    for (const [path, entry] of entries) {
      if (entry && typeof entry.body !== 'undefined') memory.set(path, entry);
    }
  } catch {
    // Storage unavailable or corrupt: the in-memory cache still works.
  }
}

function persist() {
  try {
    const entries = [...memory.entries()].slice(-MAX_STORED);
    localStorage.setItem(STORE_KEY, JSON.stringify(entries));
  } catch {
    // Quota or private mode: caching in memory is enough.
  }
}

loadStored();

/** One cached GET: revalidate with the stored ETag, serve a 304 from cache. */
export async function get(path) {
  const hit = memory.get(path);
  const headers = {};
  if (hit && hit.etag) headers['If-None-Match'] = hit.etag;
  stats.requests += 1;
  const res = await fetch(API + path, { headers });
  if (res.status === 304 && hit) {
    stats.revalidated += 1;
    return hit.body;
  }
  if (!res.ok) throw new Error(`make.fun answered ${res.status} for ${path}`);
  const body = await res.json();
  stats.served += 1;
  memory.set(path, { etag: res.headers.get('etag'), body, savedAt: Date.now() });
  persist();
  return body;
}

/** The board: every open bounty in one request (limit 100, all of them). */
export const getBoard = (status = 'open') =>
  get(`/competitions?status=${status}&activity=times&limit=100`);

/** One bounty, by slug: summary, description, rules, live rewards, entries. */
export const getBounty = (slug) => get(`/competitions/${encodeURIComponent(slug)}`);

/** A bounty's leaderboard: every ranked row in one request, client-paged. */
export const getLeaderboard = (slug, phase = 'dev', view = 'overall') =>
  get(
    `/competitions/${encodeURIComponent(slug)}/leaderboard?phase=${phase}&view=${view}&rows=all`,
  );

/** An account's public profile: record, bio, wallet, and its entries. */
export const getProfile = (handle) => get(`/profiles/${encodeURIComponent(handle)}`);

/** An API-provided relative URL (avatar, bounty page) on make.fun itself. */
export const siteUrl = (path) => (path ? SITE + path : SITE);

/** The full URL of an API-provided image (avatar, share card). */
export const apiImage = (path) => siteUrl(path);
