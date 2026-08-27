// MPL Pursuits — Shared Auth & Gating
// Single source of truth for checking a visitor's access key against the
// member sheet, rendering the nav account widget, and gating page content
// by tier. Loaded on every page via:
//   <script type="module" src="js/auth.js"></script>
//   <script type="module">import{initPage}from'./js/auth.js';initPage({...});</script>

const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSNgn2FuUriJ8wlwF3N30u7-mbGWdXwFKXXKmZqgvViGBJJqw-5yzeT6i-cQm4SZbFu2M7aVJ0Ymvwb/pub?output=csv';

// Sheet columns, in order: key | name | email | tier | enrolled_date | status
const KEY_COL = 0;
const TIER_COL = 3;
const STATUS_COL = 5;

export const TIER_RANK = { free: 0, performance: 1, elite: 2, annual: 2 };
export const TIER_LABELS = { free: 'Free Member', performance: 'Performance Athlete', elite: 'Elite Athlete', annual: 'Annual Member' };

const STORAGE_KEY = 'mpl_member_key';
const STORAGE_TIER = 'mpl_member_tier';
const STORAGE_NAME = 'mpl_member_name';

const JOIN_FREE_URL = 'https://buy.stripe.com/6oUaEZ1Iu6i28CG4oia3u07';

function parseCsv(text) {
  return text
    .split('\n')
    .slice(1) // drop header row
    .filter(row => row.trim().length > 0)
    .map(row => row.split(',').map(cell => cell.replace(/^"|"$/g, '').trim()));
}

/**
 * Checks the current visitor's access key (from the URL or localStorage)
 * against the member sheet.
 *
 * Returns:
 *   { valid: true, tier: 'performance', rank: 1, name: 'Jane' }  — recognized key
 *   { valid: false }   — key present but not found / cancelled
 *   null                — no key at all (first-time visitor)
 */
export async function checkAccess() {
  const params = new URLSearchParams(window.location.search);
  const urlKey = params.get('key');
  const key = urlKey || localStorage.getItem(STORAGE_KEY);
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
        localStorage.removeItem(STORAGE_NAME);
        return { valid: false };
      }
      const tier = (match[TIER_COL] || 'free').toLowerCase();
      const rank = TIER_RANK[tier] ?? 0;
      const name = (match[1] || '').trim();
      localStorage.setItem(STORAGE_KEY, key);
      localStorage.setItem(STORAGE_TIER, tier);
      if (name) localStorage.setItem(STORAGE_NAME, name);
      return { valid: true, tier, rank, name };
    }
    // Key present but not found in the sheet at all
    if (urlKey) return { valid: false };
  } catch (e) {
    // Network or sheet error — fail open on a previously-verified local
    // session so a member isn't logged out by a flaky connection.
    const cachedTier = localStorage.getItem(STORAGE_TIER);
    if (cachedTier) {
      const rank = TIER_RANK[cachedTier] ?? 0;
      return { valid: true, tier: cachedTier, rank, name: localStorage.getItem(STORAGE_NAME) || '' };
    }
  }
  return { valid: false };
}

export function logout() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(STORAGE_TIER);
  localStorage.removeItem(STORAGE_NAME);
  window.location.href = 'index.html';
}

/**
 * Renders the nav account widget (#navAccount) based on login state.
 */
function renderNavAccount(result) {
  const el = document.getElementById('navAccount');
  if (!el) return;
  const loggedIn = !!(result && result.valid);

  if (loggedIn) {
    const firstName = result.name ? result.name.split(' ')[0] : 'Member';
    const tierLabel = TIER_LABELS[result.tier] || 'Member';
    el.innerHTML =
      '<span class="nav-welcome">Welcome back, <strong>' + firstName + '</strong></span>' +
      '<span class="nav-tier-badge">' + tierLabel + '</span>' +
      '<button class="nav-logout" id="navLogoutBtn" type="button">Log Out</button>';
    document.getElementById('navLogoutBtn').addEventListener('click', logout);
  } else {
    el.innerHTML = '<a href="login.html" class="nav-membership"><i class="ti ti-crown"></i> Log In</a>';
  }
}

/**
 * Applies the "visitor lock" treatment: blurs every <section> on the page
 * (except explicitly-excluded ones like pricing/CTA) and reveals a sticky
 * unlock CTA, for anyone who isn't logged in at all.
 */
function applyVisitorLock() {
  document.body.classList.add('visitor-locked');
  const cta = document.getElementById('visitorLockCta');
  if (cta) cta.style.display = 'flex';
}

/**
 * Applies the "tier lock" treatment for a page/section that requires a
 * paid tier: shows an "upgrade" CTA instead of the "create free account"
 * one. Used on subpages when the visitor IS logged in but below minRank.
 */
function applyTierLock(tierLabel) {
  document.body.classList.add('tier-locked');
  const cta = document.getElementById('tierLockCta');
  if (cta) {
    cta.style.display = 'flex';
    const label = cta.querySelector('.tier-lock-need');
    if (label && tierLabel) label.textContent = tierLabel;
  }
}

/**
 * Gates elements marked data-tier-gate="library" the same way the old
 * members portal did: locked entirely below Performance, half-unlocked
 * (data-half="2" cards stay locked) at Performance, fully open at
 * Elite/Annual.
 */
function applyLibraryGating(rank) {
  document.querySelectorAll('[data-tier-gate="library"]').forEach(function (section) {
    if (rank < 1) {
      const overlay = section.querySelector('.section-lock-overlay');
      if (overlay) overlay.style.display = 'flex';
    } else if (rank === 1) {
      section.querySelectorAll('[data-half="2"]').forEach(function (card) {
        card.classList.add('card-locked');
      });
    }
  });
}

/**
 * Main entry point. Call once per page:
 *
 *   initPage({ gate: 'core' })      — hub/core pages: visible to guests,
 *                                     no lock (full access after just
 *                                     logging in for free — this is the
 *                                     default state, gate:'core' just
 *                                     wires up the nav widget)
 *   initPage({ gate: 'visitor' })   — anonymous visitors get the blurred
 *                                     5%-preview treatment; anyone logged
 *                                     in (any tier) sees the full page
 *   initPage({ gate: 'subpage' })   — anonymous visitors get the visitor
 *                                     lock; Free-tier members get the
 *                                     tier-lock ("upgrade to unlock");
 *                                     Performance/Elite/Annual see the
 *                                     full page
 *   initPage({ gate: 'library' })   — like 'subpage', but also runs the
 *                                     per-resource-card library gating
 */
export async function initPage(opts) {
  opts = opts || {};
  const result = await checkAccess();
  renderNavAccount(result);

  const loggedIn = !!(result && result.valid);
  const rank = loggedIn ? result.rank : -1;

  if (opts.gate === 'visitor') {
    if (!loggedIn) applyVisitorLock();
  } else if (opts.gate === 'subpage' || opts.gate === 'library') {
    if (!loggedIn) {
      applyVisitorLock();
    } else if (rank < 1) {
      applyTierLock('Performance Athlete or higher');
    }
    if (opts.gate === 'library') applyLibraryGating(rank);
  }

  return { result, loggedIn, rank };
}
