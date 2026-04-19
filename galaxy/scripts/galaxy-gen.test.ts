import { describe, test, expect } from 'bun:test'
import { CLUSTERS, NEBULAE } from '../src/clusters'

describe('CLUSTERS', () => {
  test('has exactly 5 clusters', () => {
    expect(CLUSTERS).toHaveLength(5)
  })

  test('all clusters have required fields', () => {
    for (const c of CLUSTERS) {
      expect(c.id).toBeTruthy()
      expect(c.label).toBeTruthy()
      expect(typeof c.cx).toBe('number')
      expect(typeof c.cy).toBe('number')
      expect(typeof c.cz).toBe('number')
      expect(c.radius).toBeGreaterThan(0)
    }
  })

  test('cluster ids are unique', () => {
    const ids = CLUSTERS.map(c => c.id)
    expect(new Set(ids).size).toBe(CLUSTERS.length)
  })

  test('contains expected ids', () => {
    const ids = new Set(CLUSTERS.map(c => c.id))
    expect(ids.has('soul')).toBe(true)
    expect(ids.has('memory')).toBe(true)
    expect(ids.has('skills')).toBe(true)
    expect(ids.has('projects')).toBe(true)
    expect(ids.has('runtime')).toBe(true)
  })
})

describe('NEBULAE', () => {
  test('has exactly 5 connections', () => {
    expect(NEBULAE).toHaveLength(5)
  })

  test('all nebulae reference valid cluster ids', () => {
    const ids = new Set(CLUSTERS.map(c => c.id))
    for (const n of NEBULAE) {
      expect(ids.has(n.clusterA)).toBe(true)
      expect(ids.has(n.clusterB)).toBe(true)
    }
  })

  test('strength is between 0 and 1', () => {
    for (const n of NEBULAE) {
      expect(n.strength).toBeGreaterThan(0)
      expect(n.strength).toBeLessThanOrEqual(1)
    }
  })
})
