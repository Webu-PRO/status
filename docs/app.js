// ── Configuration ─────────────────────────────────────────────────────────────
const OWNER  = 'Webu-PRO';
const REPO   = 'status';
const BRANCH = 'master';
const RAW    = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}`;
const API    = `https://api.github.com/repos/${OWNER}/${REPO}`;
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

// ── Site / group definition ───────────────────────────────────────────────────
// maintenance:true → site intentionally returns 503; shown as "Karbantartás" badge.
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
// Returns array of { number, title, url }.
// Cached 2 min — 60 unauthenticated req/h/IP; page visits stay well under that.
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
    if (!Array.isArray(issues)) return [];
    const data = issues.map(i => ({
      number: i.number,
      title:  String(i.title  || ''),
      url:    String(i.html_url || ''),
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
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}
const DAYS90    = last90();
const NARROW    = window.matchMedia('(max-width: 480px)').matches;
const BAR_DAYS  = NARROW ? DAYS90.slice(-30) : DAYS90;
const BAR_LABEL = NARROW ? '30 napja' : '90 napja';

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
    <path d="M${p} ${p}l${s-2*p} ${s-2*p}M${s-p} ${p}l${-(s-2*p)} ${s-2*p}"
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
  if (m == null) return 'bar-nodata';
  if (m === 0)   return 'bar-up';
  if (m < 20)    return 'bar-minor';
  if (m < 240)   return 'bar-major';
  return 'bar-down';
}

// ── Uptime bars (rendered synchronously from summary.json dailyMinutesDown) ──
function renderBars(dmd) {
  let h = '<div class="bars" role="img" aria-label="Rendelkezésre állás naptár">';
  for (const day of BAR_DAYS) {
    const m   = (dmd || {})[day] ?? null;
    // esc() guards the tooltip — fmtDateHU uses toLocaleDateString which is safe
    // but the combined string goes into a title attr via innerHTML so we escape.
    const tip = esc(`${fmtDateHU(day)}: ${m != null ? fmtMin(m) : 'nincs adat'}`);
    h += `<div class="bar ${barCls(m)}" title="${tip}"></div>`;
  }
  h += `</div><div class="axis"><span>${esc(BAR_LABEL)}</span><span>Ma</span></div>`;
  return h;
}

// ── Build data map keyed by slug ──────────────────────────────────────────────
function buildMap(summary) {
  const map = {};
  for (const s of summary) {
    if (s && typeof s.slug === 'string') map[s.slug] = s;
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
  const pct   = d
    ? esc(parseFloat(d.uptimeYear || d.uptime || '100').toFixed(2) + '% uptime')
    : '—';
  const badge = state === 'maintenance'
    ? ' <span class="maint-badge">Karbantartás</span>'
    : '';
  return `<div class="site" id="site-${esc(cfg.slug)}">
    <div class="site-hdr">
      ${statusIcon(state)}
      <span class="site-name">${esc(cfg.name)}</span>${badge}
      <span class="site-up">${pct}</span>
    </div>
    ${renderBars(d?.dailyMinutesDown)}
  </div>`;
}

// ── Render a group ────────────────────────────────────────────────────────────
function renderGroup(grp, map) {
  const anyDown = grp.sites.some(s => map[s.slug]?.status === 'down');
  const anyDeg  = grp.sites.some(s => map[s.slug]?.status === 'degraded');
  const grpState = anyDown ? 'down' : anyDeg ? 'degraded' : 'up';

  const vals = grp.sites
    .map(s => map[s.slug])
    .filter(Boolean)
    .map(d => parseFloat(d.uptimeYear || d.uptime || '100'));
  const avg = vals.length
    ? esc(parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)) + '% uptime')
    : '';

  const sitesHtml = grp.sites.map(s => renderSite(s, map)).join('');

  return `<div class="group" role="listitem">
    <button class="grp-hdr" aria-expanded="false" aria-controls="gb-${esc(grp.id)}">
      ${statusIcon(grpState)}
      <span class="grp-name">${esc(grp.name)}</span>
      <span class="grp-count">&middot; ${grp.sites.length} komponens</span>
      <span class="grp-uptime">${avg}</span>
      <svg class="grp-chev" width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <path d="M4 6.5l5 5 5-5" stroke="currentColor"
              stroke-width="1.8" stroke-linecap="round"/>
      </svg>
    </button>
    <div class="grp-body" id="gb-${esc(grp.id)}" hidden>${sitesHtml}</div>
  </div>`;
}

// ── Render overall headline ───────────────────────────────────────────────────
function renderOverall(map) {
  const allSites  = GROUPS.flatMap(g => g.sites);
  const hasData   = allSites.some(s => map[s.slug] != null);

  // Newly provisioned repo: no measurements yet
  if (!hasData) {
    return `<div class="overall-inner s-maint">
      ${iconWarn(true)}
      <span>Az első mérések folyamatban…</span>
    </div>`;
  }

  const anyDown  = allSites.some(s => map[s.slug]?.status === 'down');
  const anyDeg   = allSites.some(s => map[s.slug]?.status === 'degraded');
  const anyMaint = allSites.some(s =>
    s.maintenance && map[s.slug]?.status === 'up'
  );

  let ost, otxt;
  if (anyDown)      { ost = 'down';  otxt = 'Részleges vagy teljes kiesés'; }
  else if (anyDeg)  { ost = 'down';  otxt = 'Részleges kiesés'; }
  else if (anyMaint){ ost = 'maint'; otxt = 'Karbantartás folyamatban'; }
  else              { ost = 'up';    otxt = 'Minden rendszer működik'; }

  const icon = ost === 'down'  ? iconX(true)
             : ost === 'maint' ? iconWarn(true)
             : iconCheck(true);

  return `<div class="overall-inner s-${ost}">${icon}<span>${esc(otxt)}</span></div>`;
}

// ── Render incident banners ───────────────────────────────────────────────────
function renderBanners(incidents, map) {
  const parts = [];

  if (incidents.length > 0) {
    // Issue titles and URLs come from network — always esc() before innerHTML
    const issueLinks = incidents
      .map(i =>
        `<a class="banner-issue"
            href="${esc(i.url)}"
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

  const maintSites = GROUPS.flatMap(g => g.sites).filter(
    s => s.maintenance && map[s.slug]?.status === 'up'
  );
  if (maintSites.length > 0 && incidents.length === 0) {
    parts.push(`<div class="banner banner-maint" role="status">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <circle cx="9" cy="9" r="7.5" stroke="#D97706" stroke-width="1.5" fill="none"/>
        <path d="M9 5.5v5M9 12v1" stroke="#D97706" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
      <div class="banner-text">Karbantartás: ${maintSites.map(s => esc(s.name)).join(', ')}</div>
    </div>`);
  }

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
    const overallHtml = renderOverall(map);
    const groupsHtml  = GROUPS.map(g => renderGroup(g, map)).join('');

    const lastTs = summary[0]?.time;
    const footNote = lastTs
      ? `Utolsó ellenőrzés: ${esc(new Date(lastTs * 1000).toLocaleString('hu-HU'))} &middot; `
      : '';

    app.innerHTML = `
      ${bannersHtml}
      <div class="card">
        <div class="overall" id="overall">${overallHtml}</div>
        <div id="groups" role="list">${groupsHtml}</div>
      </div>
      <p class="foot">
        ${footNote}Ellenőrzés
        <a href="https://github.com/Webu-PRO/status/actions"
           target="_blank" rel="noopener">GitHub Actions</a>
        által &middot; adatok 5 percenként frissülnek
      </p>`;

    wireGroups();
    wireDropdown();

    // Auto-refresh every 2 min (matches cache TTL)
    setTimeout(() => {
      try { sessionStorage.removeItem('summary'); sessionStorage.removeItem('incidents'); }
      catch { /* ignore */ }
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
