import assert from 'node:assert/strict'
import { test } from 'node:test'
import { GRACE_MINUTES, planEmails } from './notify-email.mjs'

const NOW = new Date('2026-11-17T10:00:00Z')
const minutesAgo = (m) => new Date(NOW - m * 60000).toISOString()
const issue = (number, name, { age = 30, labels = [], closedAgo = null } = {}) => ({
  number,
  title: `🛑 ${name} is down`,
  url: `https://github.com/Webu-PRO/status/issues/${number}`,
  body: `In x, ${name} (https://${name.toLowerCase()}.hu) was **down**:\n- HTTP code: 0\n- Response time: 0 ms\n`,
  createdAt: minutesAgo(age),
  closedAt: closedAgo === null ? null : minutesAgo(closedAgo),
  labels: labels.map((name) => ({ name })),
})

test('a lone incident waits out the grace period, then gets its own e-mail', () => {
  assert.deepEqual(planEmails([issue(1, 'Volaria', { age: GRACE_MINUTES - 1 })], [], NOW), [])
  const [action, ...rest] = planEmails([issue(1, 'Volaria', { age: GRACE_MINUTES })], [], NOW)
  assert.equal(rest.length, 0)
  assert.match(action.mail.subject, /Kiesés: Volaria/)
  assert.deepEqual(action.numbers, [1])
  assert.deepEqual(action.labels, ['email-sent-open'])
})

test('two or more open incidents → ONE e-mail naming all of them, however young they are', () => {
  const open = [issue(1, 'Webu API', { age: 6 }), issue(2, 'Webu Admin', { age: 1 }), issue(3, 'Lifted', { age: 0 })]
  const actions = planEmails(open, [], NOW)
  assert.equal(actions.length, 1)
  assert.match(actions[0].mail.subject, /Tömeges kiesés: 3 szolgáltatás/)
  for (const name of ['Webu API', 'Webu Admin', 'Lifted']) assert.ok(actions[0].mail.text.includes(`- ${name}`))
  assert.deepEqual(actions[0].numbers, [1, 2, 3])
  assert.deepEqual(actions[0].labels, ['email-sent-open', 'mass-outage'])
})

test('incidents joining an announced mass outage are labelled, not mailed', () => {
  const open = [
    issue(1, 'Webu API', { labels: ['email-sent-open', 'mass-outage'] }),
    issue(2, 'Webu Admin', { labels: ['email-sent-open', 'mass-outage'] }),
    issue(3, 'Lifted', { age: 2 }),
    issue(4, 'Marva', { age: 1 }),
  ]
  assert.deepEqual(planEmails(open, [], NOW), [{ mail: null, numbers: [3, 4], labels: ['email-sent-open', 'mass-outage'] }])
})

test('a second, unrelated incident next to an already mailed single one is announced', () => {
  const open = [issue(1, 'Volaria', { age: 300, labels: ['email-sent-open'] }), issue(2, 'Lifted', { age: 1 })]
  const actions = planEmails(open, [], NOW)
  assert.equal(actions.length, 1)
  assert.match(actions[0].mail.subject, /Tömeges kiesés: 2 szolgáltatás/)
})

test('nothing pending → nothing sent', () => {
  const open = [issue(1, 'A', { labels: ['email-sent-open', 'mass-outage'] }), issue(2, 'B', { labels: ['email-sent-open', 'mass-outage'] })]
  assert.deepEqual(planEmails(open, [], NOW), [])
})

test('many recoveries → one summary; issues never mailed as open or already mailed as closed are skipped', () => {
  const closed = [
    issue(1, 'Webu API', { age: 180, closedAgo: 5, labels: ['email-sent-open', 'mass-outage'] }),
    issue(2, 'Lifted', { age: 170, closedAgo: 4, labels: ['email-sent-open'] }),
    issue(3, 'Régi', { age: 9000, closedAgo: 8000, labels: ['email-sent-open', 'email-sent-closed'] }),
    issue(4, 'Sosem küldött', { age: 100, closedAgo: 50 }),
  ]
  const actions = planEmails([], closed, NOW)
  assert.equal(actions.length, 1)
  assert.match(actions[0].mail.subject, /Helyreállt: 2 szolgáltatás \(2 óra 56 perc\)/)
  assert.deepEqual(actions[0].numbers, [1, 2])
  assert.deepEqual(actions[0].labels, ['email-sent-closed'])
})

test('a single recovery keeps its own e-mail', () => {
  const [action] = planEmails([], [issue(1, 'Volaria', { age: 60, closedAgo: 1, labels: ['email-sent-open'] })], NOW)
  assert.match(action.mail.subject, /Helyreállt: Volaria/)
})

test('partial recovery says how many are still down', () => {
  const open = [issue(9, 'Marva', { labels: ['email-sent-open', 'mass-outage'] })]
  const closed = [1, 2].map((n) => issue(n, `S${n}`, { age: 60, closedAgo: 1, labels: ['email-sent-open', 'mass-outage'] }))
  const [action] = planEmails(open, closed, NOW)
  assert.match(action.mail.text, /1 még nem elérhető/)
})

test('service names are escaped in the HTML', () => {
  const open = [issue(1, '<b>x</b>'), issue(2, 'B')]
  const [action] = planEmails(open, [], NOW)
  assert.ok(!action.mail.html.includes('<b>x</b>'))
})
