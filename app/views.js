// The four surfaces, each a function from API data to HTML:
//   board(data, ui)          the live bounty board
//   bounty(b)                one bounty's page: summary, rules, live rewards
//   leaderboard(slug, data, ui)   that bounty's leaderboard, paginated
//   profile(p)               an account's public profile and its entries
// Plus md(), a small markdown renderer for bounty descriptions and rules,
// and the notFound / errorView pages. Every link is a hash route, so each
// surface has its own URL and is reachable by a link.

import { apiImage, siteUrl } from './api.js';
import { ago, date, esc, money, num, pct, takesEntries, timeLeft } from './format.js';

/** The reward as it stands now: the prize plus any entry fees paid into it. */
export const pot = (b) => money(b.potUsd ?? b.rewardAmount);

/** The entry fee, when the bounty charges one; 'Free entry' otherwise. */
export const fee = (b) => (b.entryFeeUsd ? `${money(b.entryFeeUsd)} fee` : 'Free entry');

/** Open / closed pill: a bounty takes entries by its deadline, not its status. */
export function statusPill(b) {
  if (b.status === 'resolved') return '<span class="pill resolved">Resolved</span>';
  if (takesEntries(b)) return '<span class="pill open">Open · takes entries</span>';
  return '<span class="pill closed">Closed · entries ended</span>';
}

/** An avatar <img>: crossorigin set before src, as the API's images require. */
export function avatarImg(url, name, size = 32) {
  if (!url) return `<span class="avatar-missing" aria-hidden="true">${esc((name || '?')[0])}</span>`;
  return `<img class="avatar" crossorigin="anonymous" src="${esc(apiImage(url))}" alt="" width="${size}" height="${size}" loading="lazy">`;
}

/** Inline markdown: `code`, **bold**, *italic*, [text](url). Input is escaped. */
function inline(text) {
  const codes = [];
  text = text.replace(/`([^`]+)`/g, (_, c) => {
    codes.push(c);
    return '\u0001' + (codes.length - 1) + '\u0001';
  });
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
    const url = href.startsWith('/') ? siteUrl(href) : href;
    if (!/^https:\/\//.test(url)) return label;
    return `<a href="${url}" target="_blank" rel="noopener">${label}</a>`;
  });
  return text.replace(/\u0001(\d+)\u0001/g, (_, i) => `<code>${codes[+i]}</code>`);
}

/** Block markdown: ## / ### headings, - and 1. lists, --- rules, paragraphs. */
export function md(text) {
  const lines = String(text ?? '').split('\n');
  let html = '';
  let list = null;
  const closeList = () => {
    if (list) {
      html += `</${list}>`;
      list = null;
    }
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      closeList();
      continue;
    }
    const heading = line.match(/^(#{2,3})\s+(.*)$/);
    if (heading) {
      closeList();
      html +=
        heading[1].length === 2
          ? `<h2>${inline(esc(heading[2]))}</h2>`
          : `<h3>${inline(esc(heading[2]))}</h3>`;
      continue;
    }
    const ul = line.match(/^[-*]\s+(.*)$/);
    if (ul) {
      if (list !== 'ul') {
        closeList();
        html += '<ul>';
        list = 'ul';
      }
      html += `<li>${inline(esc(ul[1]))}</li>`;
      continue;
    }
    const ol = line.match(/^\d+[.)]\s+(.*)$/);
    if (ol) {
      if (list !== 'ol') {
        closeList();
        html += '<ol>';
        list = 'ol';
      }
      html += `<li>${inline(esc(ol[1]))}</li>`;
      continue;
    }
    if (/^---+$/.test(line.trim())) {
      closeList();
      html += '<hr>';
      continue;
    }
    closeList();
    html += `<p>${inline(esc(line.trim()))}</p>`;
  }
  closeList();
  return html;
}

/** Sort + filter the board rows by the UI state (no refetch: the data is cached). */
export function boardRows(items, ui) {
  let rows = items.slice();
  if (ui.filter === 'open') rows = rows.filter((b) => takesEntries(b));
  if (ui.filter === 'closing') {
    rows = rows.filter((b) => {
      const ms = new Date(b.deadline).getTime() - Date.now();
      return ms > 0 && ms < 86400000;
    });
  }
  if (ui.sort === 'pot') rows.sort((a, b) => Number(b.potUsd ?? b.rewardAmount) - Number(a.potUsd ?? a.rewardAmount));
  if (ui.sort === 'deadline') rows.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
  if (ui.sort === 'entries') rows.sort((a, b) => b.submissionCount - a.submissionCount);
  return rows;
}

/** The board: every live bounty with its pot, fee, time left and entries. */
export function board(data, ui) {
  const items = data.items || [];
  const rows = boardRows(items, ui);
  const totalPot = items.reduce((sum, b) => sum + Number(b.potUsd ?? b.rewardAmount ?? 0), 0);
  const shown =
    ui.filter === 'all'
      ? `${num(rows.length)} listed`
      : `${num(rows.length)} taking entries of ${num(items.length)} listed`;
  const cards = rows
    .map(
      (b) => `
      <article class="card">
        <h2><a href="#/bounty/${encodeURIComponent(b.slug)}">${esc(b.title)}</a></h2>
        <p class="summary">${esc(b.summary || '')}</p>
        <dl class="facts">
          <div><dt>Live pot</dt><dd class="pot">${pot(b)}</dd></div>
          <div><dt>Entry fee</dt><dd>${fee(b)}</dd></div>
          <div><dt>Time left</dt><dd><span data-deadline="${esc(b.deadline)}">${timeLeft(b.deadline)}</span></dd></div>
          <div><dt>Entries</dt><dd>${num(b.submissionCount)}</dd></div>
        </dl>
        <p class="card-links">
          <a href="#/bounty/${encodeURIComponent(b.slug)}">Details</a> ·
          <a href="#/bounty/${encodeURIComponent(b.slug)}/leaderboard">Leaderboard</a> ·
          <a href="${esc(siteUrl(b.url))}">make.fun ↗</a>
        </p>
        <p class="meta">${esc(b.category || '')} · ${statusPill(b)}</p>
      </article>`,
    )
    .join('');
  return `
    <h1>Live bounties</h1>
    <p class="lede">${shown} · ${money(totalPot)} in live pots · updated from make.fun's public API</p>
    <form class="controls" id="board-controls">
      <label>Show
        <select name="filter" data-board="filter">
          <option value="open"${ui.filter === 'open' ? ' selected' : ''}>Open now</option>
          <option value="closing"${ui.filter === 'closing' ? ' selected' : ''}>Closing in 24h</option>
          <option value="all"${ui.filter === 'all' ? ' selected' : ''}>All open</option>
        </select>
      </label>
      <label>Sort by
        <select name="sort" data-board="sort">
          <option value="pot"${ui.sort === 'pot' ? ' selected' : ''}>Biggest pot</option>
          <option value="deadline"${ui.sort === 'deadline' ? ' selected' : ''}>Soonest deadline</option>
          <option value="entries"${ui.sort === 'entries' ? ' selected' : ''}>Most entries</option>
        </select>
      </label>
      <label class="check"><input type="checkbox" data-board="closed"${ui.showClosed ? ' checked' : ''}> Include closed</label>
    </form>
    <div class="cards">${cards || '<p>No bounties match this filter.</p>'}</div>`;
}

/** One bounty's page: summary, description, live rewards, dates, entries, rules. */
export function bounty(b) {
  const rewards = (b.rewardsNow || [])
    .map(
      (r) => `
      <tr>
        <td>${r.place}</td>
        <td class="r">${money(r.baseUsd)}</td>
        <td class="r">${money(r.feeShareUsd)}</td>
        <td class="r"><strong>${money(r.amountUsd)}</strong></td>
      </tr>`,
    )
    .join('');
  const recent = (b.submissions || [])
    .slice(-6)
    .reverse()
    .map(
      (s) => `
      <li>
        <a href="#/profile/${encodeURIComponent(s.hunter)}">@${esc(s.hunter)}</a>
        <span>${esc(s.title || 'Untitled entry')}</span>
        <span class="meta">${ago(s.createdAt)} · ${esc(s.status || '')}</span>
      </li>`,
    )
    .join('');
  return `
    <p class="crumb"><a href="#/">← All bounties</a></p>
    <h1>${esc(b.title)}</h1>
    <p>${statusPill(b)}</p>
    <p class="lede">${esc(b.summary || '')}</p>
    <dl class="facts big">
      <div><dt>Live pot</dt><dd class="pot">${pot(b)}</dd></div>
      <div><dt>Reward</dt><dd>${money(b.rewardAmount)}</dd></div>
      <div><dt>Entry fee</dt><dd>${fee(b)}${b.entryFeePayers ? ` · ${num(b.entryFeePayers)} paid` : ''}</dd></div>
      <div><dt>Entries</dt><dd>${num(b.submissionCount)}</dd></div>
      <div><dt>Opened</dt><dd>${date(b.publishedAt || b.opensAt)}</dd></div>
      <div><dt>Deadline</dt><dd>${date(b.deadline)} (<span data-deadline="${esc(b.deadline)}">${timeLeft(b.deadline)}</span>)</dd></div>
    </dl>
    <p class="actions">
      <a class="button" href="#/bounty/${encodeURIComponent(b.slug)}/leaderboard">View leaderboard</a>
      <a class="button ghost" href="${esc(siteUrl(b.url))}">Open on make.fun ↗</a>
    </p>
    <h2>Rewards</h2>
    <p>Each place's prize, live: the base reward plus its share of the entry fees paid so far.</p>
    <div class="table-wrap"><table>
      <thead><tr><th>Place</th><th class="r">Base</th><th class="r">Fee share</th><th class="r">Total now</th></tr></thead>
      <tbody>${rewards}</tbody>
    </table></div>
    <h2>About this bounty</h2>
    <div class="md">${md(b.description)}</div>
    ${recent ? `<h2>Latest entries</h2><ul class="entries">${recent}</ul>` : ''}
    ${b.rules ? `<details class="rules"><summary>Full rules</summary><div class="md">${md(b.rules)}</div></details>` : ''}
    ${b.skills ? `<p class="meta">Skills: ${b.skills.map((s) => esc(s)).join(' · ')}</p>` : ''}`;
}

/** A bounty's leaderboard, 25 rows a page, with phase and view selectors. */
export function leaderboard(slug, data, ui) {
  const entries = data.entries || [];
  const perPage = 25;
  const pages = Math.max(1, Math.ceil(entries.length / perPage));
  const page = Math.min(ui.page || 1, pages);
  const slice = entries.slice((page - 1) * perPage, page * perPage);
  const rows = slice
    .map((e) => {
      const v = e.values || {};
      const rate = v.judge !== undefined && v.judge !== null ? pct(v.judge) : esc(e.status || '—');
      const interval =
        v.judge_low !== undefined && v.judge_low !== null
          ? `${pct(v.judge_low)} – ${pct(v.judge_high)}`
          : '—';
      return `
      <tr>
        <td>${e.rank ?? '—'}</td>
        <td>
          <span class="entrant">${avatarImg(e.image, e.handle)} <a href="#/profile/${encodeURIComponent(e.handle)}">@${esc(e.handle)}</a></span>
        </td>
        <td>${esc(e.title || '')}</td>
        <td class="r"><strong>${rate}</strong></td>
        <td class="r">${interval}</td>
        <td class="r">${v.valid !== undefined ? v.valid : '—'}</td>
        <td class="r">${v.bytes !== undefined ? num(v.bytes) : '—'}</td>
      </tr>`;
    })
    .join('');
  const pager =
    pages > 1
      ? `<nav class="pager" aria-label="Leaderboard pages">
          <button data-page="${page - 1}"${page <= 1 ? ' disabled' : ''}>← Prev</button>
          <span>Page ${page} of ${pages}</span>
          <button data-page="${page + 1}"${page >= pages ? ' disabled' : ''}>Next →</button>
        </nav>`
      : '';
  return `
    <p class="crumb"><a href="#/bounty/${encodeURIComponent(slug)}">← ${esc(data.competition?.title || slug)}</a></p>
    <h1>Leaderboard</h1>
    <p class="lede">${esc(data.title || 'Results')} · ${num(entries.length)} ranked entries · ${esc(data.phase?.title || '')} phase</p>
    <form class="controls" id="lb-controls">
      <label>Phase
        <select name="phase" data-lb="phase">
          <option value="dev"${ui.phase === 'dev' ? ' selected' : ''}>Development</option>
          <option value="final"${ui.phase === 'final' ? ' selected' : ''}>Final</option>
        </select>
      </label>
      <label>View
        <select name="view" data-lb="view">
          <option value="overall"${ui.view === 'overall' ? ' selected' : ''}>Overall</option>
          <option value="performance"${ui.view === 'performance' ? ' selected' : ''}>Performance</option>
        </select>
      </label>
    </form>
    <div class="table-wrap"><table>
      <thead><tr><th>Rank</th><th>Entrant</th><th>Entry</th><th class="r">Win rate</th><th class="r">90% interval</th><th class="r">Valid</th><th class="r">Size</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="7">No entries ranked yet.</td></tr>'}</tbody>
    </table></div>
    ${pager}
    <p class="meta">Rates are provisional: each entry is judged pairwise against the house frontends, and the final heat runs after the deadline. Ties break by dossier size, then by earlier submission.</p>`;
}

/** An account's public profile: record, bio, wallet, and its entries. */
export function profile(p) {
  const r = p.record || {};
  const links = [];
  if (p.github_login) links.push(`<a href="https://github.com/${encodeURIComponent(p.github_login)}">GitHub ↗</a>`);
  if (p.x) links.push(`<a href="https://x.com/${encodeURIComponent(p.x)}">X ↗</a>`);
  if (p.discord) links.push(`<span>Discord: ${esc(p.discord)}</span>`);
  if (p.wallet?.explorer_url) links.push(`<a href="${esc(p.wallet.explorer_url)}">Wallet ↗</a>`);
  links.push(`<a href="${esc(siteUrl(p.profile_url || `/u/${p.handle}`))}">make.fun profile ↗</a>`);
  const solutions = (p.solutions || [])
    .map((s) => {
      const c = s.competition || {};
      return `
      <tr>
        <td><a href="#/bounty/${encodeURIComponent(c.slug)}">${esc(s.title || '')}</a></td>
        <td><a href="#/bounty/${encodeURIComponent(c.slug)}">${esc(c.title || c.slug || '')}</a></td>
        <td class="r">${s.placement ?? '—'}</td>
        <td class="r">${s.prize_usd ? money(s.prize_usd) : '—'}</td>
        <td class="r">${s.score ? esc(s.score.display) : '—'}</td>
        <td>${ago(s.entered_at)}</td>
      </tr>`;
    })
    .join('');
  return `
    <div class="profile-head">
      ${avatarImg(p.image || p.avatar, p.display_name || p.handle, 72)}
      <div>
        <h1>${esc(p.display_name || p.handle)}</h1>
        <p class="handle">@${esc(p.handle)} · joined ${ago(p.joined_at)}</p>
        ${p.bio ? `<p>${esc(p.bio)}</p>` : ''}
        <p class="meta">${links.join(' · ')}</p>
      </div>
    </div>
    <dl class="facts big">
      <div><dt>Entered</dt><dd>${num(r.competitions_entered)}</dd></div>
      <div><dt>Placed</dt><dd>${num(r.competitions_placed)}</dd></div>
      <div><dt>Won</dt><dd>${num(r.competitions_won)}</dd></div>
      <div><dt>Podiums</dt><dd>${num(r.podium_finishes)}</dd></div>
      <div><dt>Best place</dt><dd>${r.best_placement ?? '—'}</dd></div>
      <div><dt>Prize total</dt><dd class="pot">${money(r.prize_usd)}</dd></div>
    </dl>
    <h2>Entries</h2>
    ${solutions ? `
    <div class="table-wrap"><table>
      <thead><tr><th>Entry</th><th>Bounty</th><th class="r">Place</th><th class="r">Prize</th><th class="r">Score</th><th>Entered</th></tr></thead>
      <tbody>${solutions}</tbody>
    </table></div>` : '<p>No entries yet.</p>'}`;
}

/** A missing bounty, leaderboard or profile. */
export function notFound(what) {
  return `<h1>Not found</h1><p>There is no ${esc(what)} at this address.</p><p><a href="#/">← Back to the board</a></p>`;
}

/** A failed API request, with a retry that revalidates instead of refetching. */
export function errorView(message) {
  return `<h1>Something went wrong</h1><p>${esc(message)}</p><p><button class="button" data-action="retry">Try again</button> <a href="#/">← Back to the board</a></p>`;
}
