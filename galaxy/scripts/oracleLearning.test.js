import assert from 'node:assert/strict'
import { test } from 'node:test'
import { deriveOracleLearnings } from './oracleLearning.mjs'

test('deriveOracleLearnings turns audit events into action learnings', () => {
  const learnings = deriveOracleLearnings([
    {
      at: '2026-05-05T10:12:35.847Z',
      outcome: 'allowed',
      actor: 'Mike',
      actionId: 'dispatch-wiro-ci',
      detail: 'Wiro CI dispatch queued for Mekjunkong/Wiro4x4.',
    },
    {
      at: '2026-05-05T10:12:33.277Z',
      outcome: 'session-created',
      actor: 'Mike',
      actionId: 'oracle-session',
      detail: 'Mike-only signed session cookie issued.',
    },
  ])

  assert.equal(learnings.length, 2)
  assert.equal(learnings[0].title, 'Learning: Wiro CI dispatch works')
  assert.equal(learnings[0].date, '2026-05-05')
  assert.match(learnings[0].summary, /queued for Mekjunkong\/Wiro4x4/)
  assert.equal(learnings[1].title, 'Learning: session gate unlocks execution')
})

test('deriveOracleLearnings skips duplicate learning cards', () => {
  const learnings = deriveOracleLearnings([
    {
      at: '2026-05-05T10:12:35.847Z',
      outcome: 'allowed',
      actor: 'Mike',
      actionId: 'dispatch-wiro-ci',
      detail: 'Wiro CI dispatch queued for Mekjunkong/Wiro4x4.',
    },
  ], [
    {
      title: 'Learning: Wiro CI dispatch works',
      date: '2026-05-04',
      summary: 'Existing memory note.',
    },
  ])

  assert.equal(learnings.length, 0)
})
