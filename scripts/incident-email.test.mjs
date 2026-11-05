import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatDuration, parseBody, parseService, renderIncidentEmail } from './incident-email.mjs'

// Shape of real issue #99.
const issue = {
  number: 99,
  title: '🛑 Volaria is down',
  url: 'https://github.com/Webu-PRO/status/issues/99',
  body: 'In [`a61bb02`](https://github.com/Webu-PRO/status/commit/a61bb02\n), Volaria (https://volariax.com) was **down**:\n- HTTP code: 503\n- Response time: 541 ms\n',
  createdAt: '2026-11-05T02:51:53Z',
  closedAt: null,
}

test('parseService strips the emoji and keeps accented or multi-word names', () => {
  assert.equal(parseService('🛑 Volaria is down'), 'Volaria')
  assert.equal(parseService('🛑 Kollár főoldal is down'), 'Kollár főoldal')
  assert.equal(parseService('Kézi incidens'), 'Kézi incidens')
})

test('parseBody reads the monitored URL, not the commit link', () => {
  assert.deepEqual(parseBody(issue.body), { siteUrl: 'https://volariax.com', httpCode: '503', responseMs: '541' })
  assert.deepEqual(parseBody(''), { siteUrl: null, httpCode: null, responseMs: null })
})

test('formatDuration', () => {
  assert.equal(formatDuration('2026-11-05T02:51:53Z', '2026-11-05T09:56:04Z'), '7 óra 4 perc')
  assert.equal(formatDuration('2026-11-05T00:00:00Z', '2026-11-05T00:00:20Z'), '1 percnél rövidebb')
  assert.equal(formatDuration('2026-11-03T00:00:00Z', '2026-11-05T01:00:00Z'), '2 nap 1 óra')
})

test('open incident', () => {
  const { subject, html, text } = renderIncidentEmail(issue)
  assert.equal(subject, '🔴 Kiesés: Volaria (HTTP 503 · 541 ms)')
  assert.match(html, /nem elérhető/)
  assert.match(html, /2026\. november 5\. 3:51|2026\. november 5\. 03:51/)
  assert.doesNotMatch(html, />Helyreállt</)
  assert.doesNotMatch(text, /false|null|undefined/)
})

test('resolved incident has no contradictory stop sign and shows the duration', () => {
  const { subject, html } = renderIncidentEmail({ ...issue, closedAt: '2026-11-05T09:56:04Z' })
  assert.equal(subject, '✅ Helyreállt: Volaria (7 óra 4 perc)')
  assert.doesNotMatch(subject + html, /🛑/)
  assert.match(html, /újra elérhető/)
  assert.match(html, /7 óra 4 perc/)
})

test('title, body and url cannot inject markup', () => {
  const { html } = renderIncidentEmail({
    ...issue,
    title: '🛑 <img src=x onerror=1> is down',
    url: 'javascript:alert(1)',
    body: 'x (https://a.hu/"><script>) was **down**',
  })
  assert.doesNotMatch(html, /<img src=x/)
  assert.doesNotMatch(html, /javascript:/)
  assert.doesNotMatch(html, /<script>/)
})
