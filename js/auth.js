// MPL Pursuits — Shared Auth Module
// Used by public gated pages. Reads the published Google Sheet CSV and checks
// the visitor's access key. Returns their tier for content gating.

const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSNgn2FuUriJ8wlwF3N30u7-mbGWdXwFKXXKmZqgvViGBJJqw-5yzeT6i-cQm4SZbFu2M7aVJ0Ymvwb/pub?output=csv';

// Sheet columns, in order: key | name | email | tier | enrolled_date | status
const KEY_COL = 0;
const TIER_COL = 3;
const STATUS_COL = 5;

export const TIER_RANK = { free: 0, plus: 1, performance: 2, elite: 3 };

const STORAGE_KEY = 'mpl_member_key';
const STORAGE_TIER = 'mpl_member_tier';

function parseCsv(text) {
  return text
    .split('\n')
    .slice(1)
    .filter(row => row.trim().length > 0)
    .map(row => row.split(',').map(cell => cell.replace(/^"|"$/g, '').trim()));
}

/**
 * Checks the visitor's access key (URL ?key= or localStorage) against the sheet.
 *
 * Returns:
 *   { valid: true, tier: 'plus', rank: 1 }  — active member
 *   { valid: false }                         — key found but cancelled/invalid
 *   null                                      — no key (visitor)
 */
export async function checkAccess() {
  const params = new URLSearchParams(window.location.search);
  const key = params.get('key') || localStorage.getItem(STORAGE_KEY);
  if (!key) return null;

  try {
    const res = await fetch(SHEET_CSV_URL);
    const text = await res.text();
    const rows = parseCsv(text);
    const match = rows.find(cols => cols[KEY_COL] === key);

    if (match) {
      const status = (match[STATUS_COL] || '').toLowerCase();
      if (status !== 'active') {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(STORAGE_TIER);
        return { valid: false };
      }
      const tier = (match[TIER_COL] || 'free').toLowerCase();
      const rank = TIER_RANK[tier] ?? 0;
      localStorage.setItem(STORAGE_KEY, key);
      localStorage.setItem(STORAGE_TIER, tier);
      return { valid: true, tier, rank };
    }
  } catch (e) {
    // Network or sheet error — fail open to avoid locking out valid members
  }
  return { valid: false };
}

export function logout() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(STORAGE_TIER);
  window.location.href = '/';
}
