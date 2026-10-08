// ── Configuration ────────────────────────────────────────────────────────────
const OWNER  = 'Webu-PRO';
const REPO   = 'status';
const BRANCH = 'master';
const RAW    = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}`;
const API    = `https://api.github.com/repos/${OWNER}/${REPO}`;
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

// ── Site / group definition ───────────────────────────────────────────────────
// maintenance:true → page is intentionally 503; shown as "Karbantartás" badge.
// Slugs must match .upptimerc.yml exactly.
const GROUPS = [
  { id: 'webu', name: 'Webu', sites: [
    { slug: 'webu-fooldal',  name: 'Webu főoldal',  maintenance: true },
    { slug: 'webu-api',      name: 'Webu API' },
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
    { slug: 'koronakert-admin',  name: 'Admin' },
    { slug: 'koronakert-medusa', name: 'Medusa' },
    { slug: 'koronakert-search', name: 'Keresés' },
    { slug: 'koronakert-img',    name: 'Képek' },
  ]},
  { id: 'lifted', name: 'Lifted', sites: [
    { slug: 'lifted-admin', name: 'Admin' },
    { slug: 'lifted-img',   name: 'Képek' },
  ]},
  { id: 'tg',  name: 'Teherguminet',     sites: [{ slug: 'teherguminet-admin', name: 'Admin' }] },
  { id: 'cp',  name: 'Compastor',        sites: [{ slug: 'compastor-admin',    name: 'Admin' }] },
  { id: 'mh',  name: 'Marva Home',       sites: [{ slug: 'marvahome-admin',    name: 'Admin' }] },
  { id: 'mx',  name: 'Modulix',          sites: [{ slug: 'modulix',            name: 'Modulix' }] },
  { id: 'aj',  name: 'Ajtófelújító',     sites: [{ slug: 'ajtofelujito',       name: 'Ajtófelújító.hu' }] },
  { id: 'rc',  name: 'Recodee',          sites: [{ slug: 'recodee',            name: 'Recodee' }] },
  { id: 'vl',  name: 'Volaria',          sites: [{ slug: 'volaria',            name: 'Volaria' }] },
  { id: 'teszt', name: 'Teszt környezetek', sites: [
    { slug: 'teszt-trusbau',     name: 'Trusbau' },
    { slug: 'teszt-mite',        name: 'Mite' },
    { slug: 'teszt-lebenyse',    name: 'Lebenyse' },
    { slug: 'teszt-gotto-admin', name: 'Gotto Admin' },
  ]},
];

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
  catch { /* private-window or quota — silently ignore */ }
}

// ── Data fetchers ─────────────────────────────────────────────────────────────

// Fetches history/summary.json — array of {slug, status, uptimeYear, …}.
async function fetchSummary() {
  const cached = cacheGet('summary');
  if (cached) return cached;
  const res = await fetch(`${RAW}/history/summary.json`);
  if (!res.ok) throw new Error(`summary.json ${res.status}`);
  const data = await res.json();
  cacheSet('summary', data);
  return data;
}

// Fetches and parses history/<slug>.yml → computes dailyMinutesDown map.
// Returns a Map: ISO-date → downtime minutes.
async function fetchDailyDown(slug) {
  const ckey = `hist:${slug}`;
  const cached = cacheGet(ckey);
  if (cached) return cached;
  try {
    const res = await fetch(`${RAW}/history/${slug}.yml`);
    if (!res.ok) return {};
    const text = await res.text();
    const dmd = parseHistoryYaml(text);
    cacheSet(ckey, dmd);
    return dmd;
  } catch { return {}; }
}

// Fetches open GitHub issues labelled "status".
// Returns array of {number, title, url}.
// Cached 2 min in sessionStorage to stay under 60 req/h/IP (unauthenticated).
async function fetchIncidents() {
  const cached = cacheGet('incidents');
  if (cached) return cached;
  try {
    const res = await fetch(
      `${API}/issues?labels=status&state=open&per_page=20`,
      { headers: { Accept: 'application/vnd.github+json' } }
    );
    if (!res.ok) return [];
    const issues = await res.json();
    const data = issues.map(i => ({ number: i.number, title: i.title, url: i.html_url }));
    cacheSet('incidents', data);
    return data;
  } catch { return []; }
}

// ── YAML parser for history/<slug>.yml ───────────────────────────────────────
// Format (one check per entry, every ~5 minutes):
//   - startTime: "2024-01-01T00:00:00.000Z"
//     status: up
//     code: 200
//     responseTime: 145
// Each "down" entry ≈ 5 minutes downtime.
// Also handles state-change records with endTime.
function parseHistoryYaml(text) {
  const dmd = {}; // date → minutes
  const lines = text.split('\n');
  let entry = null;

  function flushEntry() {
    if (!entry || entry.status !== 'down') return;
    const start = new Date(entry.startTime || entry.time);
    if (isNaN(start)) return;
    const end = entry.endTime && entry.endTime !== 'null'
      ? new Date(entry.endTime)
      : new Date(start.getTime() + 5 * 60 * 1000); // ~5-min check interval

    // Walk through each calendar day the outage spans
    let cur = new Date(start);
    cur.setUTCHours(0, 0, 0, 0);
    while (cur.getTime() <= end.getTime()) {
      const dayKey   = cur.toISOString().slice(0, 10);
      const dayStart = cur.getTime();
      const dayEnd   = dayStart + 86400000;
      const oStart   = Math.max(start.getTime(), dayStart);
      const oEnd     = Math.min(end.getTime(), dayEnd);
      if (oEnd > oStart) {
        dmd[dayKey] = (dmd[dayKey] || 0) + Math.round((oEnd - oStart) / 60000);
      }
      cur = new Date(dayEnd);
    }
  }

  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith('- ')) {
      flushEntry();
      entry = {};
      const rest = t.slice(2);
      const ci = rest.indexOf(': ');
      if (ci !== -1) {
        entry[rest.slice(0, ci)] = rest.slice(ci + 2).replace(/^['"]|['"]$/g, '');
      }
    } else if (entry && t.includes(': ')) {
      const ci = t.indexOf(': ');
      entry[t.slice(0, ci)] = t.slice(ci + 2).replace(/^['"]|['"]$/g, '');
    }
  }
  flushEntry();
  return dmd;
}

// ── Date helpers ──────────────────────────────────────────────────────────────
function last90() {
  const days = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}
const DAYS90 = last90();
const NARROW = window.matchMedia('(max-width: 480px)').matches;
const BAR_DAYS = NARROW ? DAYS90.slice(-45) : DAYS90;
const BAR_LABEL = NARROW ? '45 napja' : '90 napja';

function fmtMin(m) {
  if (!m) return 'Teljes rendelkezésre állás';
  const h = Math.floor(m / 60), mn = m % 60;
  if (h && mn) return `${h}ó ${mn}p kiesés`;
  if (h) return `${h}ó kiesés`;
  return `${mn}p kiesés`;
}
function fmtDateHU(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' });
}

// ── Icon SVG helpers ──────────────────────────────────────────────────────────
function iconCheck(big) {
  const s = big ? 32 : 20, sw = big ? 2.5 : 2;
  return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" fill="none" aria-hidden="true">
    <circle cx="${s/2}" cy="${s/2}" r="${s/2-1}" fill="#2563EB"/>
    <path d="M${s*.25} ${s*.52}l${s*.22} ${s*.22}l${s*.35} -${s*.35}"
          stroke="white" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}
function iconX(big) {
  const s = big ? 32 : 20, p = big ? 9 : 6, sw = big ? 2.5 : 2;
  return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" fill="none" aria-hidden="true">
    <circle cx="${s/2}" cy="${s/2}" r="${s/2-1}" fill="#EF4444"/>
    <path d="M${p} ${p}l${s-2*p} ${s-2*p}M${s-p} ${p}l${-s+2*p} ${s-2*p}"
          stroke="white" stroke-width="${sw}" stroke-linecap="round"/>
  </svg>`;
}
function iconWarn(big) {
  const s = big ? 32 : 20, sw = big ? 2.5 : 2;
  return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" fill="none" aria-hidden="true">
    <circle cx="${s/2}" cy="${s/2}" r="${s/2-1}" fill="#D97706"/>
    <path d="M${s/2} ${s*.28}v${s*.32}M${s/2} ${s*.7}v${s*.1}"
          stroke="white" stroke-width="${sw}" stroke-linecap="round"/>
  </svg>`;
}
function statusIcon(state, big = false) {
  if (state === 'down' || state === 'degraded') return iconX(big);
  if (state === 'maintenance') return iconWarn(big);
  return iconCheck(big);
}

// ── Bar class by downtime minutes ─────────────────────────────────────────────
function barCls(m) {
  if (m == null)  return 'bar-nodata';
  if (m === 0)    return 'bar-up';
  if (m < 20)     return 'bar-minor';
  if (m < 240)    return 'bar-major';
  return 'bar-down';
}

// ── Build summary data map keyed by slug ──────────────────────────────────────
function buildMap(summary) {
  const map = {};
  for (const s of summary) map[s.slug] = s;
  return map;
}

// ── Resolve visible state ─────────────────────────────────────────────────────
// Returns: 'up' | 'down' | 'degraded' | 'maintenance' | 'nodata'
function resolveState(summaryEntry, cfg) {
  if (!summaryEntry) return 'nodata';
  if (cfg.maintenance && summaryEntry.status === 'up') return 'maintenance';
  return summaryEntry.status || 'nodata';
}

// ── Render bars (skeleton while loading, real bars once dmd is available) ─────
function skeletonBars() {
  let h = `<div class="skel-bars" aria-hidden="true">`;
  for (let i = 0; i < BAR_DAYS.length; i++) h += `<div class="skel-bar"></div>`;
  h += `</div><div class="axis"><span>${BAR_LABEL}</span><span>Ma</span></div>`;
  return h;
}

function realBars(dmd) {
  let h = `<div class="bars" role="img" aria-label="90 napos rendelkezésre állás">`;
  for (const day of BAR_DAYS) {
    const m   = (dmd || {})[day] ?? null;
    const tip = `${fmtDateHU(day)}: ${m != null ? fmtMin(m) : 'nincs adat'}`;
    h += `<div class="bar ${barCls(m)}" title="${tip}"></div>`;
  }
  h += `</div><div class="axis"><span>${BAR_LABEL}</span><span>Ma</span></div>`;
  return h;
}

// ── Render a single site row ───────────────────────────────────────────────────
function renderSite(cfg, map) {
  const d     = map[cfg.slug];
  const state = resolveState(d, cfg);
  const pct   = d ? (parseFloat(d.uptimeYear || d.uptime || '100')).toFixed(2) + '% uptime' : '—';
  const badge = (state === 'maintenance')
    ? ' <span class="maint-badge">Karbantartás</span>' : '';
  return `<div class="site" id="site-${cfg.slug}">
    <div class="site-hdr">
      ${statusIcon(state)}
      <span class="site-name">${cfg.name}</span>${badge}
      <span class="site-up">${pct}</span>
    </div>
    <div class="bars-wrap" data-slug="${cfg.slug}">${skeletonBars()}</div>
  </div>`;
}

// ── Render a group ────────────────────────────────────────────────────────────
function renderGroup(grp, map) {
  const anyDown = grp.sites.some(s => {
    const d = map[s.slug];
    return d && d.status === 'down';
  });
  const anyDeg = grp.sites.some(s => {
    const d = map[s.slug];
    return d && d.status === 'degraded';
  });
  const grpState = anyDown ? 'down' : anyDeg ? 'degraded' : 'up';

  const vals = grp.sites
    .map(s => map[s.slug])
    .filter(Boolean)
    .map(d => parseFloat(d.uptimeYear || d.uptime || '100'));
  const avg = vals.length
    ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) + '% uptime'
    : '';

  const sitesHtml = grp.sites.map(s => renderSite(s, map)).join('');

  return `<div class="group" role="listitem">
    <button class="grp-hdr" aria-expanded="false" aria-controls="gb-${grp.id}"
            data-group-id="${grp.id}">
      ${statusIcon(grpState)}
      <span class="grp-name">${grp.name}</span>
      <span class="grp-count">&middot; ${grp.sites.length} komponens</span>
      <span class="grp-uptime">${avg}</span>
      <svg class="grp-chev" width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <path d="M4 6.5l5 5 5-5" stroke="currentColor"
              stroke-width="1.8" stroke-linecap="round"/>
      </svg>
    </button>
    <div class="grp-body" id="gb-${grp.id}" hidden>${sitesHtml}</div>
  </div>`;
}

// ── Render overall headline ───────────────────────────────────────────────────
function renderOverall(map) {
  const allSites = GROUPS.flatMap(g => g.sites);
  const anyDown   = allSites.some(s => map[s.slug]?.status === 'down');
  const anyDeg    = allSites.some(s => map[s.slug]?.status === 'degraded');
  const anyMaint  = allSites.some(s => s.maintenance && map[s.slug]?.status === 'up');

  let ost, otxt;
  if (anyDown)      { ost = 'down';  otxt = 'Részleges vagy teljes kiesés'; }
  else if (anyDeg)  { ost = 'down';  otxt = 'Részleges kiesés'; }
  else if (anyMaint){ ost = 'maint'; otxt = 'Karbantartás folyamatban'; }
  else              { ost = 'up';    otxt = 'Minden rendszer működik'; }

  const icon = ost === 'down' ? iconX(true)
             : ost === 'maint' ? iconWarn(true)
             : iconCheck(true);

  return `<div class="overall-inner s-${ost}">${icon}<span>${otxt}</span></div>`;
}

// ── Render incident banners ───────────────────────────────────────────────────
function renderBanners(incidents, map) {
  const parts = [];

  // GitHub incidents (open issues)
  if (incidents.length > 0) {
    const issueLinks = incidents
      .map(i => `<a class="banner-issue" href="${i.url}" target="_blank" rel="noopener noreferrer">${i.title}</a>`)
      .join('');
    parts.push(`<div class="banner banner-outage" role="alert" aria-live="assertive">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <path d="M9 1.5L1.5 16.5h15L9 1.5z" stroke="#EF4444" stroke-width="1.5" fill="none"/>
        <path d="M9 8v3.5M9 13.5v.5" stroke="#EF4444" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
      <div class="banner-text"><strong>Aktív kiesés</strong>${issueLinks}</div>
    </div>`);
  }

  // Maintenance badge banner
  const maintSites = GROUPS.flatMap(g => g.sites).filter(
    s => s.maintenance && map[s.slug]?.status === 'up'
  );
  if (maintSites.length > 0 && incidents.length === 0) {
    parts.push(`<div class="banner banner-maint" role="status">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <circle cx="9" cy="9" r="7.5" stroke="#D97706" stroke-width="1.5" fill="none"/>
        <path d="M9 5.5v5M9 12v1" stroke="#D97706" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
      <div class="banner-text">Karbantartás: ${maintSites.map(s => s.name).join(', ')}</div>
    </div>`);
  }

  return parts.join('');
}

// ── Lazy-load daily bars when a group expands ────────────────────────────────
async function loadGroupBars(groupId) {
  const grp = GROUPS.find(g => g.id === groupId);
  if (!grp) return;
  await Promise.all(grp.sites.map(async cfg => {
    const wrap = document.querySelector(`[data-slug="${cfg.slug}"]`);
    if (!wrap || wrap.dataset.barsLoaded) return;
    const dmd = await fetchDailyDown(cfg.slug);
    wrap.innerHTML = realBars(dmd);
    wrap.dataset.barsLoaded = '1';
  }));
}

// ── Wire up collapse / expand ─────────────────────────────────────────────────
function wireGroups() {
  document.querySelectorAll('.grp-hdr').forEach(btn => {
    btn.addEventListener('click', () => {
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      const body = document.getElementById(btn.getAttribute('aria-controls'));
      btn.setAttribute('aria-expanded', String(!expanded));
      if (body) body.hidden = expanded;
      if (!expanded) {
        loadGroupBars(btn.dataset.groupId);
      }
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

// ── Main ──────────────────────────────────────────────────────────────────────
async function init() {
  const app = document.getElementById('app');

  try {
    const [summary, incidents] = await Promise.all([fetchSummary(), fetchIncidents()]);
    const map = buildMap(summary);

    const bannersHtml = renderBanners(incidents, map);
    const groupsHtml  = GROUPS.map(g => renderGroup(g, map)).join('');
    const overallHtml = renderOverall(map);

    // Build page timestamp from summary (use last-known check time)
    const lastChecked = summary[0]?.time
      ? new Date(summary[0].time * 1000).toLocaleString('hu-HU')
      : null;
    const footNote = lastChecked
      ? `Utolsó ellenőrzés: ${lastChecked} &middot; `
      : '';

    app.innerHTML = `
      ${bannersHtml}
      <div class="card">
        <div class="overall" id="overall">${overallHtml}</div>
        <div id="groups" role="list">${groupsHtml}</div>
      </div>
      <p class="foot">
        ${footNote}Ellenőrzés
        <a href="https://github.com/Webu-PRO/status/actions" target="_blank" rel="noopener">GitHub Actions</a>
        által &middot; adatok 5 percenként frissülnek
      </p>`;

    wireGroups();
    wireDropdown();

    // Auto-refresh every 2 min (matches cache TTL)
    setTimeout(() => {
      cacheSet('summary', null);
      cacheSet('incidents', null);
      init();
    }, CACHE_TTL);

  } catch (err) {
    app.innerHTML = `
      <p style="text-align:center;padding:60px 0;color:var(--fg-muted)">
        Nem sikerült betölteni az adatokat.<br>
        <a href="https://github.com/Webu-PRO/status" target="_blank" rel="noopener">
          Státusz megtekintése GitHubon</a>
      </p>`;
    wireDropdown();
    console.error('Status page load error:', err);
  }
}

init();
