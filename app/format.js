// Small helpers for showing API values: escaping, money, dates, time left.

/** Text made safe to put inside HTML. */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** A dollar amount ('250.00', 500 or null) as '$250' or '$0.50'. */
export function money(value) {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
  });
}

/** A whole number with thousands separators ('1,234'), or '—'. */
export function num(value) {
  if (value === null || value === undefined) return '—';
  return Number(value).toLocaleString('en-US');
}

/** A deadline as a date in UTC. */
export function date(iso) {
  if (!iso) return '—';
  return `${new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })} UTC`;
}

/** The time until a deadline: '12d 4h left', '3h 20m left', '35m left', 'ended'. */
export function timeLeft(iso) {
  if (!iso) return '—';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'ended';
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

/** A past timestamp as 'just now', '5m ago', '3h ago', '2d ago'. */
export function ago(iso) {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60000) return 'just now';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date(iso);
}

/** A judge win rate in micro units (950587) as '95.06%'. */
export function pct(micro) {
  if (micro === null || micro === undefined) return '—';
  return `${(Number(micro) / 10000).toFixed(2)}%`;
}

/** Whether a bounty still takes entries: its deadline, not its status alone. */
export function takesEntries(bounty) {
  if (!bounty || !bounty.deadline) return false;
  return new Date(bounty.deadline).getTime() > Date.now();
}
