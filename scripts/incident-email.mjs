// Incident e-mail for the status page, styled like the webu.hu contact e-mails
// (navy header, Instrument Sans → Helvetica, table layout + inline styles).
//
// Usage: gh issue view <n> --json number,title,url,body,createdAt,closedAt \
//          | node scripts/incident-email.mjs
// Prints the Resend fields as JSON: { subject, html, text }

import { pathToFileURL } from 'node:url'

const STATUS_PAGE = 'https://status.webu.hu'
const LOGO = 'https://webu.hu/assets/email-logo.png'
const FONT = "'Instrument Sans',Helvetica,Arial,sans-serif"
const MONO = "'JetBrains Mono',Menlo,Consolas,monospace"

const STATES = {
  down: { accent: '#DC2626', onNavy: '#FCA5A5', tint: '#FEF2F2', border: '#FECACA', dot: '🔴', label: 'Aktív kiesés', headline: 'nem elérhető' },
  up: { accent: '#16A34A', onNavy: '#86EFAC', tint: '#F0FDF4', border: '#BBF7D0', dot: '✅', label: 'Helyreállt', headline: 'újra elérhető' },
}

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

const safeHref = (url) => (/^https?:\/\//i.test(url ?? '') ? url : null)

// "🛑 Volaria is down" -> "Volaria"
export const parseService = (title) =>
  String(title).replace(/^[\p{Extended_Pictographic}\uFE0F\s]+/u, '').replace(/\s+is down$/i, '').trim()

// Upptime body: "..., Volaria (https://x) was **down**:\n- HTTP code: 503\n- Response time: 541 ms"
export function parseBody(body) {
  const text = String(body ?? '')
  return {
    siteUrl: text.match(/\((https?:\/\/[^\s)]+)\)\s+(?:was|has)\b/)?.[1] ?? null,
    httpCode: text.match(/HTTP code:\s*(\d+)/i)?.[1] ?? null,
    responseMs: text.match(/Response time:\s*(\d+)\s*ms/i)?.[1] ?? null,
  }
}

export const formatTime = (iso) =>
  new Intl.DateTimeFormat('hu-HU', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Budapest' }).format(new Date(iso))

export function formatDuration(fromIso, toIso) {
  const minutes = Math.round((new Date(toIso) - new Date(fromIso)) / 60000)
  if (minutes < 1) return '1 percnél rövidebb'
  const parts = [
    [Math.floor(minutes / 1440), 'nap'],
    [Math.floor(minutes / 60) % 24, 'óra'],
    [minutes % 60, 'perc'],
  ]
  return parts.filter(([n]) => n > 0).map(([n, unit]) => `${n} ${unit}`).join(' ')
}

const errorText = ({ httpCode, responseMs }) => {
  if (!httpCode) return null
  if (httpCode === '0') return 'Nincs válasz'
  return responseMs ? `HTTP ${httpCode} · ${responseMs} ms` : `HTTP ${httpCode}`
}

function detailRows(rows) {
  return rows.map(({ label, html, strong }, i) => `<tr>
    <td style="padding:11px 0;${i ? 'border-top:1px solid #E6EBF3;' : ''}font-family:${MONO};font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:#6B778C;width:130px;vertical-align:top">${esc(label)}</td>
    <td style="padding:11px 0;${i ? 'border-top:1px solid #E6EBF3;' : ''}font-family:${FONT};font-size:15px;line-height:1.45;color:#0B0F16;vertical-align:top${strong ? ';font-weight:700' : ''}">${html}</td>
  </tr>`).join('')
}

export function renderIncidentEmail(issue) {
  const service = parseService(issue.title)
  const details = parseBody(issue.body)
  const resolved = Boolean(issue.closedAt)
  const state = STATES[resolved ? 'up' : 'down']
  const duration = resolved ? formatDuration(issue.createdAt, issue.closedAt) : null
  const error = errorText(details)
  const incidentUrl = safeHref(issue.url) ?? STATUS_PAGE
  const eyebrow = `Webu Státusz · #${issue.number}`

  const lead = resolved
    ? `A kiesés ${duration} után megszűnt, a(z) ${service} újra rendben válaszol.`
    : `A monitorozás kiesést észlelt: a(z) ${service} nem válaszol megfelelően. Helyreálláskor újabb értesítést küldünk.`

  const subject = resolved
    ? `${state.dot} Helyreállt: ${service} (${duration})`
    : `${state.dot} Kiesés: ${service}${error ? ` (${error})` : ''}`

  const rows = [
    { label: 'Állapot', html: `<span style="color:${state.accent};font-weight:700">${state.label}</span>` },
    details.siteUrl && {
      label: 'Cím',
      html: `<a href="${esc(details.siteUrl)}" style="color:#1D6EF5;text-decoration:none">${esc(details.siteUrl.replace(/^https?:\/\//, ''))}</a>`,
    },
    { label: 'Észlelve', html: esc(formatTime(issue.createdAt)) },
    resolved && { label: 'Helyreállt', html: esc(formatTime(issue.closedAt)) },
    resolved && { label: 'Időtartam', html: esc(duration), strong: true },
    error && { label: resolved ? 'Észlelt hiba' : 'Hiba', html: esc(error) },
  ].filter(Boolean)

  const html = `<!doctype html>
<html lang="hu" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${esc(subject)}</title>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
<style>
  @media (max-width:620px){ .px{padding-left:22px!important;padding-right:22px!important} .h1{font-size:28px!important} }
</style>
</head>
<body style="margin:0;padding:0;background:#EEF2F8;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(lead)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#EEF2F8">
<tr><td align="center" style="padding:32px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid #DCE3EE">
<tr><td style="height:4px;line-height:4px;font-size:4px;background:${state.accent}">&nbsp;</td></tr>
<tr><td style="background:#0F1626">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td class="px" style="padding:28px 40px 0">
      <a href="${STATUS_PAGE}"><img src="${LOGO}" width="106" height="40" alt="WEBU" style="display:block;border:0;width:106px;height:auto"></a>
    </td></tr>
    <tr><td class="px" style="padding:28px 40px 34px;font-family:${FONT}">
      <div style="font-family:${MONO};font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#7FB0FF">${esc(eyebrow)}</div>
      <h1 class="h1" style="margin:12px 0 0;font-size:34px;line-height:1.12;letter-spacing:-.02em;font-weight:700;color:#FFFFFF">${esc(service)}<br><span style="color:${state.onNavy}">${state.headline}</span></h1>
    </td></tr>
  </table>
</td></tr>
<tr><td class="px" style="padding:30px 40px 0;font-family:${FONT};font-size:16px;line-height:1.6;color:#2D3748">${esc(lead)}</td></tr>
<tr><td class="px" style="padding:20px 40px 0">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${state.tint};border:1px solid ${state.border};border-radius:12px">
    <tr><td style="padding:9px 22px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${detailRows(rows)}</table>
    </td></tr>
  </table>
</td></tr>
<tr><td class="px" style="padding:26px 40px 34px;font-family:${FONT}">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td style="border-radius:10px;background:#1D6EF5"><a href="${STATUS_PAGE}" style="display:inline-block;padding:13px 22px;font-family:${FONT};font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:10px">Státuszoldal megnyitása &rarr;</a></td>
  </tr></table>
  <p style="margin:16px 0 0;font-size:14px;line-height:1.6"><a href="${esc(incidentUrl)}" style="color:#1D6EF5;text-decoration:none;font-weight:600">Incidens megnyitása a GitHubon</a></p>
</td></tr>
<tr><td class="px" style="padding:22px 40px;background:#0F1626;font-family:${FONT};color:#9AA6BC;font-size:13px;line-height:1.7">
  Automatikus értesítés a Webu monitorozásából · <a href="${STATUS_PAGE}" style="color:#EAEEF6;text-decoration:none">status.webu.hu</a>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`

  const text = [
    lead,
    '',
    `Állapot: ${state.label}`,
    details.siteUrl && `Cím: ${details.siteUrl}`,
    `Észlelve: ${formatTime(issue.createdAt)}`,
    resolved && `Helyreállt: ${formatTime(issue.closedAt)}`,
    resolved && `Időtartam: ${duration}`,
    error && `${resolved ? 'Észlelt hiba' : 'Hiba'}: ${error}`,
    '',
    `Státuszoldal: ${STATUS_PAGE}`,
    `Incidens: ${incidentUrl}`,
  ].filter((line) => line !== false && line !== null).join('\n')

  return { subject, html, text }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  let input = ''
  for await (const chunk of process.stdin) input += chunk
  process.stdout.write(JSON.stringify(renderIncidentEmail(JSON.parse(input))))
}
