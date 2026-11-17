// Decides which incident e-mails to send and sends them through Resend.
//
// One site down → one e-mail (as before). Many sites down together → ONE e-mail: a host or network
// outage makes Upptime open an incident per site, a few minutes apart, and a letter per site buries
// the inbox. Rules (planEmails, pure and tested):
//   - 2+ incidents open at once is a mass outage: one e-mail, and every incident joining it later
//     is only labelled (mass-outage), not mailed.
//   - a lone incident is mailed once it has been alone for GRACE_MINUTES, so the first site of a
//     mass outage does not get a letter of its own. A real single outage is mailed that much later.
//   - recoveries: a mass outage gets one summary once all its incidents are closed (or the rest has been
//     back for RECOVERY_WAIT_MINUTES); otherwise 2+ closing together → one summary, a single one → its own.
// Labels on the issue are the memory: email-sent-open, email-sent-closed, mass-outage.
//
// Usage (notify.yml): node scripts/notify-email.mjs   — env: REPO, RESEND_API_KEY, RESEND_FROM, ALERT_EMAIL_TO
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { renderIncidentEmail, renderMassEmail } from './incident-email.mjs'

export const MASS_MIN = 2
export const GRACE_MINUTES = 8
export const RECOVERY_WAIT_MINUTES = 60

const has = (issue, label) => issue.labels.some((l) => l.name === label)

/**
 * @param open   open `status` issues   { number, title, url, body, createdAt, closedAt, labels: [{ name }] }
 * @param closed recently closed `status` issues that were e-mailed as open
 * @returns actions in order: { mail: {subject, html, text} | null, numbers: number[], labels: string[] }
 *          — send `mail` (when set), then add `labels` to every issue in `numbers`.
 */
export function planEmails(open, closed, now = new Date()) {
  const actions = []
  const pending = open.filter((i) => !has(i, 'email-sent-open'))
  const massActive = open.some((i) => has(i, 'mass-outage'))

  if (pending.length) {
    const numbers = pending.map((i) => i.number)
    if (massActive) {
      // the outage is already announced: the newcomers join it silently
      actions.push({ mail: null, numbers, labels: ['email-sent-open', 'mass-outage'] })
    } else if (open.length >= MASS_MIN) {
      actions.push({ mail: renderMassEmail(open), numbers: open.map((i) => i.number), labels: ['email-sent-open', 'mass-outage'] })
    } else {
      const [issue] = pending
      const aloneFor = (now - new Date(issue.createdAt)) / 60000
      if (aloneFor >= GRACE_MINUTES) actions.push({ mail: renderIncidentEmail(issue), numbers, labels: ['email-sent-open'] })
    }
  }

  const recovered = closed.filter((i) => has(i, 'email-sent-open') && !has(i, 'email-sent-closed'))
  // A mass outage gets ONE recovery summary: wait until none of its incidents is open any more — or, when a
  // straggler stays down, until the others have been back for RECOVERY_WAIT_MINUTES (then say how many are left).
  const mass = recovered.filter((i) => has(i, 'mass-outage'))
  if (mass.length) {
    const stillDown = open.filter((i) => has(i, 'mass-outage')).length
    const lastBack = Math.max(...mass.map((i) => new Date(i.closedAt).getTime()))
    if (!stillDown || (now - lastBack) / 60000 >= RECOVERY_WAIT_MINUTES) {
      actions.push({ mail: renderMassEmail(mass, { resolved: true, stillDown }), numbers: mass.map((i) => i.number), labels: ['email-sent-closed'] })
    }
  }
  const single = recovered.filter((i) => !has(i, 'mass-outage'))
  if (single.length >= MASS_MIN) {
    actions.push({ mail: renderMassEmail(single, { resolved: true }), numbers: single.map((i) => i.number), labels: ['email-sent-closed'] })
  } else if (single.length === 1) {
    actions.push({ mail: renderIncidentEmail(single[0]), numbers: [single[0].number], labels: ['email-sent-closed'] })
  }
  return actions
}

const FIELDS = 'number,title,url,body,createdAt,closedAt,labels'
const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8' })

async function main() {
  const { REPO, RESEND_API_KEY, RESEND_FROM, ALERT_EMAIL_TO } = process.env
  const list = (...extra) => JSON.parse(gh('issue', 'list', '--repo', REPO, '--label', 'status', '--json', FIELDS, ...extra))
  const open = list('--state', 'open', '--limit', '100')
  const closed = list('--state', 'closed', '--label', 'email-sent-open', '--limit', '100')

  for (const { mail, numbers, labels } of planEmails(open, closed)) {
    if (mail) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...mail, from: RESEND_FROM || 'Webu Státusz <status@webu.hu>', to: [ALERT_EMAIL_TO] }),
      })
      if (!res.ok) {
        // not labelled, so the next run tries again
        console.log(`::warning::Resend send failed (${res.status}) for #${numbers.join(', #')}`)
        continue
      }
      console.log(`sent: ${mail.subject}`)
    }
    for (const number of numbers) {
      try {
        gh('issue', 'edit', String(number), '--repo', REPO, '--add-label', labels.join(','))
      } catch {
        console.log(`::warning::label ${labels.join(',')} failed for #${number}`)
      }
    }
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main()
