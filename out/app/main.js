// A make.fun frontend: the live board, a bounty page, its leaderboard and an
// account's profile, on hash routes:
//
//   #/                              the board
//   #/bounty/<slug>                 one bounty
//   #/bounty/<slug>/leaderboard     that bounty's leaderboard
//   #/profile/<handle>              an account's public profile
//
// The views load on demand (import()): the first load is only this file,
// the API cache and the formatters, so the board opens fast. window.__shotReady
// is false while a view loads and true once its data is on screen, so a
// screenshot script knows when to capture. A 30-second ticker refreshes the
// time-left labels in place, with no refetch and no rebuild of the page.

import { getBoard, getBounty, getLeaderboard, getProfile, stats } from './api.js';
import { timeLeft } from './format.js';

const app = document.getElementById('app');
const footStats = document.getElementById('foot-stats');
const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search');
const searchList = document.getElementById('search-list');

let viewsPromise = null;

/** The view functions, loaded once, on first render. */
function views() {
  if (!viewsPromise) viewsPromise = import('./views.js');
  return viewsPromise;
}

const boardUi = { filter: 'open', sort: 'pot', showClosed: false };
const lbUi = { phase: 'dev', view: 'overall', page: 1 };
let boardCache = null;
let closedCache = null;

/** The footer's live request count: requests, 304 revalidations, fresh bodies. */
function showStats() {
  if (!footStats) return;
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  footStats.textContent =
    `${plural(stats.requests, 'API request')} · ${stats.revalidated} revalidated (304) · ${stats.served} fresh`;
}

/** Refresh every time-left label in place, without refetching or rebuilding. */
function tick() {
  for (const el of document.querySelectorAll('[data-deadline]')) {
    el.textContent = timeLeft(el.getAttribute('data-deadline'));
  }
}

setInterval(tick, 30000);

/** The hash route, split into parts: [] board, [bounty, slug], [profile, handle]. */
function parseRoute() {
  const parts = (location.hash || '#/')
    .replace(/^#\/?/, '')
    .split('/')
    .filter(Boolean)
    .map((p) => decodeURIComponent(p));
  if (parts[0] === 'bounty' && parts[1] && parts[2] === 'leaderboard') {
    return { name: 'leaderboard', slug: parts[1] };
  }
  if (parts[0] === 'bounty' && parts[1]) return { name: 'bounty', slug: parts[1] };
  if (parts[0] === 'profile' && parts[1]) return { name: 'profile', handle: parts[1] };
  return { name: 'board' };
}

/** Fill the search box's suggestions with the board's bounty slugs. */
function fillSearchList() {
  if (!searchList || !boardCache) return;
  searchList.innerHTML = boardCache.items
    .map((b) => `<option value="${b.slug}">${b.title.replace(/"/g, '')}</option>`)
    .join('');
}

/** One board fetch, cached: open bounties, plus closed ones when asked for. */
async function boardData() {
  if (!boardCache) {
    boardCache = await getBoard('open');
    fillSearchList();
  }
  if (boardUi.showClosed && !closedCache) closedCache = await getBoard('closed');
  const items = boardCache.items.slice();
  if (boardUi.showClosed && closedCache) items.push(...closedCache.items);
  return { items };
}

async function renderBoard(v) {
  const data = await boardData();
  document.title = 'make.fun — live bounties';
  app.innerHTML = v.board(data, boardUi);
}

async function renderBounty(v, slug) {
  const b = await getBounty(slug);
  document.title = `${b.title} | make.fun bounties`;
  app.innerHTML = v.bounty(b);
}

async function renderLeaderboard(v, slug) {
  const data = await getLeaderboard(slug, lbUi.phase, lbUi.view);
  document.title = `Leaderboard · ${data.competition?.title || slug} | make.fun bounties`;
  app.innerHTML = v.leaderboard(slug, data, lbUi);
}

async function renderProfile(v, handle) {
  const p = await getProfile(handle);
  document.title = `${p.display_name || p.handle} (@${p.handle}) | make.fun bounties`;
  app.innerHTML = v.profile(p);
}

/** Render the current route; on a failed fetch, show the error view. */
async function render() {
  window.__shotReady = false;
  const route = parseRoute();
  app.innerHTML = '<p class="loading" aria-live="polite">Loading…</p>';
  try {
    const v = await views();
    if (route.name === 'bounty') await renderBounty(v, route.slug);
    else if (route.name === 'leaderboard') await renderLeaderboard(v, route.slug);
    else if (route.name === 'profile') await renderProfile(v, route.handle);
    else await renderBoard(v);
  } catch (err) {
    const v = await views().catch(() => null);
    document.title = 'Something went wrong | make.fun bounties';
    app.innerHTML = v
      ? v.errorView(err.message || String(err))
      : `<h1>Something went wrong</h1><p>${err.message || err}</p>`;
  }
  showStats();
  window.scrollTo(0, 0);
  window.__shotReady = true;
}

/** Board controls: filter, sort and the closed toggle re-render from cache. */
app.addEventListener('change', (event) => {
  const target = event.target;
  if (target.matches('[data-board="filter"]')) {
    boardUi.filter = target.value;
    render();
  }
  if (target.matches('[data-board="sort"]')) {
    boardUi.sort = target.value;
    render();
  }
  if (target.matches('[data-board="closed"]')) {
    boardUi.showClosed = target.checked;
    render();
  }
  if (target.matches('[data-lb="phase"]')) {
    lbUi.phase = target.value;
    lbUi.page = 1;
    render();
  }
  if (target.matches('[data-lb="view"]')) {
    lbUi.view = target.value;
    lbUi.page = 1;
    render();
  }
});

/** Leaderboard pager and the error view's retry button. */
app.addEventListener('click', (event) => {
  const pageButton = event.target.closest('[data-page]');
  if (pageButton && !pageButton.disabled) {
    lbUi.page = Math.max(1, Number(pageButton.getAttribute('data-page')));
    render();
    return;
  }
  if (event.target.closest('[data-action="retry"]')) render();
});

/** Search: a bounty slug goes to its page, anything else to that profile. */
searchForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const query = searchInput.value.trim().replace(/^@/, '');
  if (!query) return;
  const slug = boardCache?.items.find((b) => b.slug === query)?.slug;
  location.hash = slug ? `#/bounty/${slug}` : `#/profile/${encodeURIComponent(query)}`;
});

window.addEventListener('hashchange', render);
render();
