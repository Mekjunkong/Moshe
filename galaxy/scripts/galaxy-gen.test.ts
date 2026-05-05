import { strict as assert } from 'node:assert'
import { describe, test } from 'node:test'
import { CLUSTERS, NEBULAE } from '../src/clusters.ts'
import { assignCluster, generate } from './galaxy-gen.ts'

describe('CLUSTERS', () => {
  test('has exactly 5 clusters', () => {
    assert.equal(CLUSTERS.length, 5)
  })

  test('all clusters have required fields', () => {
    for (const c of CLUSTERS) {
      assert.ok(c.id)
      assert.ok(c.label)
      assert.equal(typeof c.cx, 'number')
      assert.equal(typeof c.cy, 'number')
      assert.equal(typeof c.cz, 'number')
      assert.ok(c.radius > 0)
    }
  })

  test('cluster ids are unique', () => {
    const ids = CLUSTERS.map((c) => c.id)
    assert.equal(new Set(ids).size, CLUSTERS.length)
  })

  test('contains expected ids', () => {
    const ids = new Set(CLUSTERS.map((c) => c.id))
    assert.ok(ids.has('soul'))
    assert.ok(ids.has('memory'))
    assert.ok(ids.has('skills'))
    assert.ok(ids.has('projects'))
    assert.ok(ids.has('runtime'))
  })
})

describe('NEBULAE', () => {
  test('has exactly 5 connections', () => {
    assert.equal(NEBULAE.length, 5)
  })

  test('all nebulae reference valid cluster ids', () => {
    const ids = new Set(CLUSTERS.map((c) => c.id))
    for (const n of NEBULAE) {
      assert.ok(ids.has(n.clusterA))
      assert.ok(ids.has(n.clusterB))
    }
  })

  test('strength is between 0 and 1', () => {
    for (const n of NEBULAE) {
      assert.ok(n.strength > 0)
      assert.ok(n.strength <= 1)
    }
  })
})

describe('assignCluster', () => {
  test('resonance → soul', () => {
    assert.equal(assignCluster('/workspace/Moshe/ψ/memory/resonance/oracle.md'), 'soul')
  })

  test('writing → soul', () => {
    assert.equal(assignCluster('/workspace/Moshe/ψ/writing/draft.md'), 'soul')
  })

  test('lab → soul', () => {
    assert.equal(assignCluster('/workspace/Moshe/ψ/lab/experiment.md'), 'soul')
  })

  test('memory/learnings → memory', () => {
    assert.equal(assignCluster('/workspace/Moshe/ψ/memory/learnings/lesson.md'), 'memory')
  })

  test('memory/retrospectives → memory', () => {
    assert.equal(assignCluster('/workspace/Moshe/ψ/memory/retrospectives/session.md'), 'memory')
  })

  test('active → projects', () => {
    assert.equal(assignCluster('/workspace/Moshe/ψ/active/project.md'), 'projects')
  })

  test('inbox → projects', () => {
    assert.equal(assignCluster('/workspace/Moshe/ψ/inbox/idea.md'), 'projects')
  })

  test('archive → projects', () => {
    assert.equal(assignCluster('/workspace/Moshe/ψ/archive/done.md'), 'projects')
  })

  test('outbox → projects', () => {
    assert.equal(assignCluster('/workspace/Moshe/ψ/outbox/ready.md'), 'projects')
  })

  test('unknown path → soul (default)', () => {
    assert.equal(assignCluster('/some/unrecognized/path/file.md'), 'soul')
  })
})

describe('generate', () => {
  test('returns valid GalaxyData shape', () => {
    const data = generate()
    assert.ok(Array.isArray(data.clusters))
    assert.ok(Array.isArray(data.documents))
    assert.ok(Array.isArray(data.nebulae))
    assert.ok(data.clusters.length > 0)
    assert.ok(data.documents.length > 0)
    assert.ok(data.nebulae.length > 0)
  })
})
