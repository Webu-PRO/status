// ── Configuration ─────────────────────────────────────────────────────────────
const OWNER  = 'Webu-PRO';
const REPO   = 'status';
const BRANCH = 'master';
const RAW    = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}`;
const API    = `https://api.github.com/repos/${OWNER}/${REPO}`;
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

// Upptime only records days that had downtime in dailyMinutesDown.
// Days on-or-after this date with no entry are UP (0 min down), not "no data".
// Days strictly before this date are pre-monitoring — shown as grey "no data".
const MONITORING_SINCE = '2026-10-08';

// ── Site / group definition ───────────────────────────────────────────────────
// maintenance:true → site intentionally returns 503; shown as "Karbantartás" badge.
// Slugs must match .upptimerc.yml exactly.
// Groups with 1 site render as a plain top-level row (no panel, no expand/collapse).
// Groups with ≥2 sites render as a collapsible inner panel.
const GROUPS = [
  { id: 'webu', name: 'Webu', sites: [
    { slug: 'webu-fooldal',  name: 'Webu főoldal',  maintenance: true },
    { slug: 'webu-api',      name: 'API' },
    { slug: 'webu-admin',    name: 'Admin' },
    { slug: 'webu-cmr',      name: 'CMR' },
    { slug: 'webu-seo',      name: 'SEO eszköz' },
  ]},
  { id: 'kollar', name: 'Kollár Ortopédia', sites: [
    { slug: 'kollar-fooldal',    name: 'Főoldal' },
    { slug: 'kollar-rezervacia', name: 'Foglalási rendszer' },
    { slug: 'kollar-admin',      name: 'Admin' },
  ]},
  { id: 'koronakert', name: 'Koronakert', sites: [
    { slug: 'koronakert-webshop', name: 'Webshop' },
    { slug: 'koronakert-admin',   name: 'Admin' },
    { slug: 'koronakert-search',  name: 'Keresés' },
    { slug: 'koronakert-img',     name: 'Képek' },
  ]},
  { id: 'lifted', name: 'Lifted', sites: [
    { slug: 'lifted-webshop', name: 'Webshop' },
    { slug: 'lifted-admin',   name: 'Admin' },
    { slug: 'lifted-img',     name: 'Képek' },
  ]},
  { id: 'tg', name: 'Teherguminet', sites: [
    { slug: 'teherguminet-webshop', name: 'Webshop' },
    { slug: 'teherguminet-admin',   name: 'Admin' },
  ]},
  { id: 'cp', name: 'Compastor', sites: [
    { slug: 'compastor-webshop', name: 'Webshop' },
    { slug: 'compastor-admin',   name: 'Admin' },
  ]},
  { id: 'mh', name: 'Marva Home', sites: [
    { slug: 'marvahome-webshop', name: 'Webshop' },
    { slug: 'marvahome-admin',   name: 'Admin' },
  ]},
  { id: 'mx',  name: 'Modulix',          sites: [{ slug: 'modulix',              name: 'Modulix' }] },
  { id: 'aj',  name: 'Ajtófelújító',     sites: [{ slug: 'ajtofelujito',         name: 'Ajtófelújító.hu' }] },
  { id: 'rc',  name: 'Recodee',          sites: [{ slug: 'recodee',              name: 'Recodee' }] },
  { id: 'vl',  name: 'Volaria',          sites: [{ slug: 'volaria',              name: 'Volaria' }] },
  { id: 'mu',  name: 'Munchi',           sites: [{ slug: 'munchi-webshop',        name: 'Munchi' }] },
  { id: 'tv',  name: 'Te vagy a Puzzle', sites: [{ slug: 'tevagyapuzzle-webshop', name: 'Te vagy a Puzzle' }] },
  { id: 'pt',  name: 'Portas',           sites: [{ slug: 'portas-webshop',        name: 'Portas' }] },
  { id: 'teszt', name: 'Teszt környezetek', sites: [
    { slug: 'teszt-trusbau',     name: 'Trusbau' },
    { slug: 'teszt-mite',        name: 'Mite' },
    { slug: 'teszt-lebenyse',    name: 'Lebenyse' },
    { slug: 'teszt-gotto-admin', name: 'Gotto Admin' },
  ]},
];

// ── HTML escape ────────────────────────────────────────────────────────────────
// Must be called on every string from the network before inserting into innerHTML.
function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Demo mode ─────────────────────────────────────────────────────────────────
// ?demo=<scenario> activates a local fixture (localhost only).
//   ?demo=1 or ?demo=outage → single Volaria outage  → amber "Részleges kiesés"
//   ?demo=maint             → webu.hu maintenance only → green "Minden rendszer működik"
// Restricting to localhost prevents visitors from rendering fake outages on status.webu.hu.
const _DEMO_SCENARIO = typeof location !== 'undefined'
  && ['localhost', '127.0.0.1'].includes(location.hostname)
  ? new URLSearchParams(location.search).get('demo') // null | '1' | 'outage' | 'maint'
  : null;
const DEMO = _DEMO_SCENARIO != null;

function _demoSummary(scenario) {
  // Build a fake summary that exercises the bar coloring, downtime stubs, and overall state.
  // MONITORING_SINCE is 2026-10-08 — we pretend we've been running for 60 days so bars fill.
  const base = (slug, extra = {}) => ({
    name: slug, url: '#', icon: '', slug,
    status: 'up', uptime: '99.95%', uptimeYear: '99.95%',
    time: 500, dailyMinutesDown: {}, ...extra,
  });
  // Site with a few downtime days (koronakert-admin bars)
  const dmd = { '2026-09-15': 8, '2026-09-22': 75, '2026-09-30': 180 };
  const sites = [
    base('webu-fooldal',  { uptimeYear: '100%',  dailyMinutesDown: {} }),
    base('webu-api',       { uptimeYear: '100%',  dailyMinutesDown: {} }),
    base('webu-admin',     { uptimeYear: '99.98%',dailyMinutesDown: { '2026-09-10': 3 } }),
    base('webu-cmr',       { uptimeYear: '100%',  dailyMinutesDown: {} }),
    base('webu-seo',       { uptimeYear: '100%',  dailyMinutesDown: {} }),
    base('kollar-fooldal', { uptimeYear: '100%',  dailyMinutesDown: {} }),
    base('kollar-rezervacia'),
    base('kollar-admin',   { uptimeYear: '100%',  dailyMinutesDown: {} }),
    base('koronakert-webshop'),
    base('koronakert-admin',   { uptimeYear: '99.90%', dailyMinutesDown: dmd }),
    base('koronakert-search',  { uptimeYear: '100%', dailyMinutesDown: {} }),
    base('koronakert-img',     { uptimeYear: '100%', dailyMinutesDown: {} }),
    base('lifted-webshop', { uptimeYear: '100%', dailyMinutesDown: {} }),
    base('lifted-admin',   { uptimeYear: '99.80%', dailyMinutesDown: { '2026-09-28': 60 } }),
    base('lifted-img',     { uptimeYear: '100%', dailyMinutesDown: {} }),
    base('teherguminet-webshop'),
    base('teherguminet-admin', { uptimeYear: '100%', dailyMinutesDown: {} }),
    base('compastor-webshop'),
    base('compastor-admin', { uptimeYear: '100%', dailyMinutesDown: {} }),
    base('marvahome-webshop'),
    base('marvahome-admin', { uptimeYear: '100%', dailyMinutesDown: {} }),
    base('modulix',           { uptimeYear: '99.99%', dailyMinutesDown: { '2026-09-05': 1 } }),
    base('ajtofelujito',      { uptimeYear: '100%', dailyMinutesDown: {} }),
    base('recodee',           { uptimeYear: '100%', dailyMinutesDown: {} }),
    base('volaria',           { uptimeYear: '99.97%', dailyMinutesDown: { '2026-09-18': 15 } }),
    base('munchi-webshop',    { uptimeYear: '100%', dailyMinutesDown: {} }),
    base('tevagyapuzzle-webshop'),
    base('portas-webshop'),
    base('teszt-trusbau'),
    base('teszt-mite'),
    base('teszt-lebenyse'),
    base('teszt-gotto-admin'),
  ];

  // Scenario: 'outage' | '1' → Volaria down (single partial outage → amber headline)
  // Scenario: 'maint'        → all up; webu.hu maintenance comes from cfg.maintenance, not status
  if (!scenario || scenario === '1' || scenario === 'outage') {
    const v = sites.find(s => s.slug === 'volaria');
    if (v) v.status = 'down';
  }
  // 'maint' scenario: every status stays 'up'; webu-fooldal maintenance is rendered via
  // cfg.maintenance === true in GROUPS, independent of the summary status field.
  return sites;
}
function _demoIncidents(scenario) {
  if (scenario === 'maint') return []; // maintenance-only: no open incidents
  // Outage scenario: single Volaria incident
  return [{
    number: 42,
    title: 'Volaria – az oldal nem érhető el',
    url: 'https://github.com/Webu-PRO/status/issues/42',
    labels: ['status', 'volaria'],
  }];
}

// ── Session cache helpers ─────────────────────────────────────────────────────
function cacheGet(key) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null;
    return data;
  } catch { return null; }
}
function cacheSet(key, data) {
  try { sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })); }
  catch { /* private-window or quota exceeded — silently skip */ }
}

// ── Data fetchers ─────────────────────────────────────────────────────────────

// Fetches history/summary.json — array of
//   { slug, status, uptimeYear, dailyMinutesDown, … }
// dailyMinutesDown is a map of ISO-date → downtime minutes (Upptime-generated).
// Returns [] when the file is missing or empty (newly provisioned repo).
async function fetchSummary() {
  if (DEMO) return _demoSummary(_DEMO_SCENARIO);
  const cached = cacheGet('summary');
  if (cached) return cached;
  const res = await fetch(`${RAW}/history/summary.json`);
  if (!res.ok) return [];
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  cacheSet('summary', data);
  return data;
}

// Fetches open GitHub issues labelled "status".
// Returns array of { number, title, url, labels }. Upptime labels each incident
// with "status" and the site slug, so labels map an incident to its component.
// Cached 2 min — 60 unauthenticated req/h/IP; page visits stay well under that.
async function fetchIncidents() {
  if (DEMO) return _demoIncidents(_DEMO_SCENARIO);
  const cached = cacheGet('incidents');
  if (cached) return cached;
  try {
    const res = await fetch(
      `${API}/issues?labels=status&state=open&per_page=20`,
      { headers: { Accept: 'application/vnd.github+json' } }
    );
    if (!res.ok) return [];
    const issues = await res.json();
    if (!Array.isArray(issues)) return [];
    const data = issues.map(i => ({
      number: i.number,
      title:  String(i.title  || ''),
      url:    String(i.html_url || ''),
      labels: (i.labels || []).map(l => String(typeof l === 'string' ? l : l?.name || '')),
    }));
    cacheSet('incidents', data);
    return data;
  } catch { return []; }
}

// ── Date helpers ──────────────────────────────────────────────────────────────
function last90() {
  const days = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}
const DAYS90    = last90();
const NARROW    = window.matchMedia('(max-width: 480px)').matches;
const BAR_DAYS  = NARROW ? DAYS90.slice(-30) : DAYS90;

function fmtMin(m) {
  if (!m) return 'Nincs kiesés';
  const h = Math.floor(m / 60), mn = m % 60;
  if (h && mn) return `${h}ó ${mn}p kiesés`;
  if (h) return `${h}ó kiesés`;
  return `${mn}p kiesés`;
}
function fmtDateHU(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' });
}
function fmtPct(v) {
  const r = v.toFixed(2);
  return (r === '100.00' ? '100' : r) + '% uptime';
}
function fmtUptime(d) {
  return fmtPct(parseFloat(d?.uptimeYear || d?.uptime || '100'));
}

// ── Icon SVG helpers ──────────────────────────────────────────────────────────
// size: pixel size (16, 24, etc.)
function iconCheck(size) {
  const s = size || 16, sw = s <= 16 ? 1.8 : s <= 20 ? 2 : 2.5;
  const r = s / 2;
  return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" fill="none" aria-hidden="true">
    <circle cx="${r}" cy="${r}" r="${r}" fill="#2563EB"/>
    <path d="M${s*.25} ${s*.52}l${s*.22} ${s*.22}l${s*.35} -${s*.35}"
          stroke="white" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}
function iconX(size) {
  const s = size || 16, p = s * .28, sw = s <= 16 ? 1.8 : s <= 20 ? 2 : 2.5;
  const r = s / 2;
  return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" fill="none" aria-hidden="true">
    <circle cx="${r}" cy="${r}" r="${r}" fill="#EF4444"/>
    <path d="M${p} ${p}l${s-2*p} ${s-2*p}M${s-p} ${p}l${-(s-2*p)} ${s-2*p}"
          stroke="white" stroke-width="${sw}" stroke-linecap="round"/>
  </svg>`;
}
function iconWarn(size) {
  const s = size || 16, sw = s <= 16 ? 1.8 : s <= 20 ? 2 : 2.5;
  const r = s / 2;
  return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" fill="none" aria-hidden="true">
    <circle cx="${r}" cy="${r}" r="${r}" fill="#F59E0B"/>
    <path d="M${r} ${s*.28}v${s*.32}M${r} ${s*.7}v${s*.1}"
          stroke="white" stroke-width="${sw}" stroke-linecap="round"/>
  </svg>`;
}
function statusIcon(state, size) {
  if (state === 'down' || state === 'degraded') return iconX(size);
  if (state === 'maintenance') return iconWarn(size);
  return iconCheck(size);
}

// ── Bar stub (coloured bottom portion for downtime days) ──────────────────────
function renderBarStub(m) {
  if (!m) return '';
  const color = m < 5 ? '#facc15' : m < 60 ? '#f97316' : '#ef4444';
  const BAR_H = 34; // must match CSS .bars height
  const h = Math.max(6, Math.round(BAR_H * Math.min(m / 240, 1)));
  return `<div class="bar-stub" style="height:${h}px;background:${color}"></div>`;
}

// ── Uptime bars ────────────────────────────────────────────────────────────────
// Upptime's dailyMinutesDown only lists days with downtime.
// A missing entry on/after MONITORING_SINCE means 0 min down (the site was up).
// Days before MONITORING_SINCE have no data at all → grey.
function renderBars(dmd) {
  // Demo mode uses the full 90-day window as the "since" date so all bars are coloured.
  const sinceDate = DEMO ? DAYS90[0] : MONITORING_SINCE;
  let h = '<div class="bars" role="img" aria-label="Rendelkezésre állás naptár">';
  for (const day of BAR_DAYS) {
    let m = null;
    if (day >= sinceDate) {
      // Monitoring was running: missing = up (0 min down), present = downtime
      m = (dmd || {})[day] ?? 0;
    }
    // m === null → before monitoring started, no data
    // m === 0   → on/after start, 0 minutes down → up (blue)
    // m >  0   → downtime → blue + coloured stub
    const isNodata = m === null;
    const cls = isNodata ? 'bar-nodata' : 'bar-up';
    const tipText = isNodata ? 'nincs adat' : m === 0 ? 'Nincs kiesés' : fmtMin(m);
    const tip = esc(`${fmtDateHU(day)}: ${tipText}`);
    const stub = (!isNodata && m > 0) ? renderBarStub(m) : '';
    h += `<div class="bar ${cls}" data-tip="${tip}" tabindex="0">${stub}</div>`;
  }
  h += `</div>`;
  h += `<div class="axis">`;
  h += `<span>${NARROW ? '&lsaquo; 30 NAPJA' : '&lsaquo; 90 NAPJA'}</span>`;
  h += `<span>MA</span>`;
  h += `</div>`;
  return h;
}

// ── Build data map keyed by slug ──────────────────────────────────────────────
// summary.json is regenerated less often than incidents open, so an open
// incident labelled with a component's slug overrides that component to down.
function buildMap(summary, incidents) {
  const map = {};
  for (const s of summary) {
    if (s && typeof s.slug === 'string') map[s.slug] = s;
  }
  const slugs = new Set(GROUPS.flatMap(g => g.sites.map(s => s.slug)));
  for (const i of incidents) {
    for (const label of i.labels || []) {
      if (slugs.has(label)) map[label] = { ...(map[label] || {}), status: 'down' };
    }
  }
  return map;
}

// ── Resolve visible state ─────────────────────────────────────────────────────
// Returns: 'up' | 'down' | 'degraded' | 'maintenance' | 'nodata'
function resolveState(d, cfg) {
  if (!d) return 'nodata';
  if (cfg.maintenance && d.status === 'up') return 'maintenance';
  return d.status || 'nodata';
}

// ── Render a single site row ───────────────────────────────────────────────────
function renderSite(cfg, map) {
  const d     = map[cfg.slug];
  const state = resolveState(d, cfg);
  const pct   = esc(fmtUptime(d));
  const badge = state === 'maintenance'
    ? ' <span class="maint-badge">Karbantartás</span>' : '';
  return `<div class="site" id="site-${esc(cfg.slug)}">
    <div class="site-hdr">
      <span class="site-icon">${statusIcon(state, 16)}</span>
      <span class="site-name">${esc(cfg.name)}</span>${badge}
      <span class="site-up">${pct}</span>
    </div>
    ${renderBars(d?.dailyMinutesDown)}
  </div>`;
}

// ── Render a group ────────────────────────────────────────────────────────────
// Single-site groups → plain top-level row (no panel).
// Multi-site groups  → collapsible inner panel; state persisted in localStorage.
function renderGroup(grp, map) {
  // ── Single-component: plain row, group name as label ─────────────────────
  if (grp.sites.length === 1) {
    const s     = grp.sites[0];
    const d     = map[s.slug];
    const state = resolveState(d, s);
    const pct   = esc(fmtUptime(d));
    const badge = state === 'maintenance'
      ? ' <span class="maint-badge">Karbantartás</span>' : '';
    return `<div class="site" role="listitem" id="site-${esc(s.slug)}">
      <div class="site-hdr">
        <span class="site-icon">${statusIcon(state, 16)}</span>
        <span class="site-name">${esc(grp.name)}</span>${badge}
        <span class="site-up">${pct}</span>
      </div>
      ${renderBars(d?.dailyMinutesDown)}
    </div>`;
  }

  // ── Multi-component: collapsible panel ───────────────────────────────────
  // Compute group-level status for the header icon (amber/red when any component is down).
  const grpDownSites = grp.sites.filter(s => {
    const st = resolveState(map[s.slug], s);
    return st === 'down' || st === 'degraded';
  });
  const grpHalfDown = grpDownSites.length >= grp.sites.length / 2;
  const grpIconHtml = grpDownSites.length
    ? `<span class="grp-icon">${grpHalfDown ? iconX(16) : iconWarn(16)}</span>`
    : '';

  const vals = grp.sites
    .map(s => map[s.slug])
    .filter(Boolean)
    .map(d => parseFloat(d.uptimeYear || d.uptime || '100'));
  const avgVal = vals.length
    ? vals.reduce((a, b) => a + b, 0) / vals.length
    : 100;
  const avgFmt = esc(fmtPct(avgVal));

  // Read expand state from localStorage (expanded by default)
  let expanded = true;
  try {
    const stored = localStorage.getItem(`grp-${grp.id}`);
    if (stored === 'false') expanded = false;
  } catch { /* private window or blocked — default to expanded */ }

  const sitesHtml = grp.sites.map(s => renderSite(s, map)).join('');

  // Expand icon: dark circle with white chevron
  const chevronIcon = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="8" fill="#111827"/>
    <path d="M5 7l3 3 3-3" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

  return `<div class="group-panel" role="listitem">
    <button class="grp-hdr" aria-expanded="${expanded}" aria-controls="gb-${esc(grp.id)}">
      <div class="grp-chevron">${chevronIcon}</div>
      ${grpIconHtml}<span class="grp-name">${esc(grp.name)}</span>
      <span class="grp-count">&middot; ${grp.sites.length} komponens</span>
      <span class="grp-spacer"></span>
      <span class="grp-uptime">${avgFmt}</span>
    </button>
    <div class="grp-body" id="gb-${esc(grp.id)}"${expanded ? '' : ' hidden'}>
      ${sitesHtml}
    </div>
  </div>`;
}

// ── Render overall headline ───────────────────────────────────────────────────
// "Lifted Admin" for a component inside a multi-site client, plain "Volaria" otherwise.
function labelOf(slug) {
  const g = GROUPS.find(gr => gr.sites.some(s => s.slug === slug));
  const s = g?.sites.find(x => x.slug === slug);
  if (!g || !s) return slug;
  return g.sites.length > 1 && s.name !== g.name ? `${g.name} ${s.name}` : s.name;
}

function renderOverall(map) {
  const allSites = GROUPS.flatMap(g => g.sites);
  const hasData  = allSites.some(s => map[s.slug] != null);

  if (!hasData) {
    return `<div class="overall-inner">
      <div class="overall-halo halo-warn">${iconWarn(24)}</div>
      <span>Az első mérések folyamatban…</span>
    </div>`;
  }

  // A planned maintenance page never changes the headline; it only shows on its own row.
  // One or a few components down is a partial outage named in a subline, not a page-wide alarm.
  const affected = allSites.filter(s => ['down', 'degraded'].includes(map[s.slug]?.status));
  const halfDown = affected.length >= allSites.length / 2;

  let haloClass, icon, otxt;
  if (halfDown)              { haloClass = 'halo-down'; icon = iconX(24);    otxt = 'Jelentős kiesés'; }
  else if (affected.length)  { haloClass = 'halo-warn'; icon = iconWarn(24); otxt = 'Részleges kiesés'; }
  else                       { haloClass = 'halo-up';   icon = iconCheck(24); otxt = 'Minden rendszer működik'; }

  const names = affected.map(s => labelOf(s.slug));
  const sub = affected.length && !halfDown
    ? `<div class="overall-sub">${affected.length} komponens érintett: ${names.map(esc).join(', ')}</div>`
    : '';

  return `<div class="overall-inner">
    <div class="overall-halo ${esc(haloClass)}">${icon}</div>
    <span>${esc(otxt)}</span>
  </div>${sub}`;
}

// ── Render incident banners ───────────────────────────────────────────────────
function renderBanners(incidents, map) {
  const parts = [];

  if (incidents.length > 0) {
    // Issue titles and URLs come from network — always esc() before innerHTML
    const issueLinks = incidents
      .map(i =>
        `<a class="banner-issue"
            href="${esc(/^https:\/\//.test(i.url) ? i.url : '#')}"
            target="_blank" rel="noopener noreferrer">${esc(i.title)}</a>`
      )
      .join('');
    parts.push(`<div class="banner banner-outage" role="alert" aria-live="assertive">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <path d="M9 1.5L1.5 16.5h15L9 1.5z" stroke="#EF4444" stroke-width="1.5" fill="none"/>
        <path d="M9 8v3.5M9 13.5v.5" stroke="#EF4444" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
      <div class="banner-text"><strong>Aktív kiesés</strong>${issueLinks}</div>
    </div>`);
  }

  // Maintenance gets no page-wide banner; the badge on its own row is enough.
  return parts.join('');
}

// ── Wire up collapse / expand ─────────────────────────────────────────────────
function wireGroups() {
  document.querySelectorAll('.grp-hdr').forEach(btn => {
    btn.addEventListener('click', () => {
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      const body = document.getElementById(btn.getAttribute('aria-controls'));
      btn.setAttribute('aria-expanded', String(!expanded));
      if (body) body.hidden = expanded;
      // Persist state in localStorage (try/catch for private windows)
      const id = (btn.getAttribute('aria-controls') || '').replace('gb-', '');
      try { if (id) localStorage.setItem(`grp-${id}`, String(!expanded)); } catch {}
    });
  });
}

// ── Wire up notification dropdown ────────────────────────────────────────────
function wireDropdown() {
  const ddbtn  = document.getElementById('ddbtn');
  const ddmenu = document.getElementById('ddmenu');
  if (!ddbtn || !ddmenu) return;

  ddbtn.addEventListener('click', e => {
    e.stopPropagation();
    const open = !ddmenu.hidden;
    ddmenu.hidden = open;
    ddbtn.setAttribute('aria-expanded', String(!open));
  });
  document.addEventListener('click', () => {
    ddmenu.hidden = true;
    ddbtn.setAttribute('aria-expanded', 'false');
  });
  ddmenu.addEventListener('click', e => e.stopPropagation());
}

// ── Custom tooltip ────────────────────────────────────────────────────────────
let _tooltip = null;
function getTooltip() {
  if (_tooltip) return _tooltip;
  _tooltip = document.createElement('div');
  _tooltip.className = 'tooltip';
  document.body.appendChild(_tooltip);
  return _tooltip;
}
function positionTooltip(e) {
  const tip = getTooltip();
  const r = tip.getBoundingClientRect();
  let x = e.clientX - r.width / 2;
  let y = e.clientY - r.height - 10 + window.scrollY;
  x = Math.max(8, Math.min(x, window.innerWidth - r.width - 8));
  if (y < window.scrollY + 4) y = e.clientY + 18 + window.scrollY;
  tip.style.left = x + 'px';
  tip.style.top  = y + 'px';
}
function wireTooltips(container) {
  container.querySelectorAll('.bar[data-tip]').forEach(bar => {
    bar.addEventListener('mouseenter', e => {
      const tip = getTooltip();
      // data-tip is set via esc() — safe to read as text
      tip.textContent = bar.getAttribute('data-tip') || '';
      tip.style.display = 'block';
      positionTooltip(e);
    });
    bar.addEventListener('mousemove', positionTooltip);
    bar.addEventListener('mouseleave', () => { getTooltip().style.display = 'none'; });
    // Keyboard / focus support
    bar.addEventListener('focusin', e => {
      const tip = getTooltip();
      tip.textContent = bar.getAttribute('data-tip') || '';
      tip.style.display = 'block';
      const rect = bar.getBoundingClientRect();
      tip.style.left = (rect.left + rect.width / 2 - tip.getBoundingClientRect().width / 2) + 'px';
      tip.style.top  = (rect.top - tip.getBoundingClientRect().height - 8 + window.scrollY) + 'px';
    });
    bar.addEventListener('focusout', () => { getTooltip().style.display = 'none'; });
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function init() {
  const app = document.getElementById('app');

  // Keep the groups the visitor opened/closed across the periodic re-render.
  const expandedGroups = new Set(
    [...document.querySelectorAll('.grp-hdr[aria-expanded="true"]')]
      .map(b => b.getAttribute('aria-controls'))
  );
  const collapsedGroups = new Set(
    [...document.querySelectorAll('.grp-hdr[aria-expanded="false"]')]
      .map(b => b.getAttribute('aria-controls'))
  );

  try {
    const [summary, incidents] = await Promise.all([fetchSummary(), fetchIncidents()]);
    const map = buildMap(summary, incidents);

    const bannersHtml = renderBanners(incidents, map);
    const overallHtml = renderOverall(map);
    const groupsHtml  = GROUPS.map(g => renderGroup(g, map)).join('');

    // summary.json's `time` is a response time in ms, not a timestamp — show when refreshed.
    const footNote = `Frissítve: ${esc(new Date().toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' }))} &middot; `;

    app.innerHTML = `
      ${bannersHtml}
      <div class="card">
        <div class="overall" id="overall">${overallHtml}</div>
        <div class="card-content" id="groups" role="list">${groupsHtml}</div>
      </div>
      <p class="foot">
        ${footNote}Ellenőrzés
        <a href="https://github.com/Webu-PRO/status/actions"
           target="_blank" rel="noopener">GitHub Actions</a>
        által &middot; adatok 5 percenként frissülnek
      </p>`;

    wireGroups();
    wireTooltips(app);

    // Restore previously opened/closed groups (after re-renders)
    for (const id of expandedGroups) {
      const btn  = document.querySelector(`.grp-hdr[aria-controls="${id}"]`);
      const body = document.getElementById(id);
      if (btn && body) { btn.setAttribute('aria-expanded', 'true'); body.hidden = false; }
    }
    for (const id of collapsedGroups) {
      const btn  = document.querySelector(`.grp-hdr[aria-controls="${id}"]`);
      const body = document.getElementById(id);
      if (btn && body) { btn.setAttribute('aria-expanded', 'false'); body.hidden = true; }
    }

  } catch (err) {
    app.innerHTML = `
      <p style="text-align:center;padding:60px 0;color:#6b7280">
        Nem sikerült betölteni az adatokat.<br>
        <a href="https://github.com/Webu-PRO/status" target="_blank" rel="noopener">
          Státusz megtekintése GitHubon</a>
      </p>`;
    console.error('Status page load error:', err);
  }

  // Auto-refresh every 2 min (matches cache TTL), also retrying after a failed load.
  setTimeout(() => {
    try { sessionStorage.removeItem('summary'); sessionStorage.removeItem('incidents'); }
    catch { /* ignore */ }
    init();
  }, CACHE_TTL);
}

wireDropdown();
init();
