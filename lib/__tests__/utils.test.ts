/// <reference types="bun-types" />
import { describe, test, expect } from 'bun:test'
import { indexById, toggleInSet } from '@/lib/utils'

// ---------------------------------------------------------------------------
// indexById
// ---------------------------------------------------------------------------

describe('indexById', () => {
  test('returns a Map keyed by id', () => {
    // Arrange
    const items = [
      { id: 'a', name: 'Alpha' },
      { id: 'b', name: 'Beta' },
    ]

    // Act
    const map = indexById(items)

    // Assert
    expect(map.get('a')).toEqual({ id: 'a', name: 'Alpha' })
    expect(map.get('b')).toEqual({ id: 'b', name: 'Beta' })
  })

  test('returns a Map with correct size', () => {
    // Arrange
    const items = [{ id: 'x' }, { id: 'y' }, { id: 'z' }]

    // Act
    const map = indexById(items)

    // Assert
    expect(map.size).toBe(3)
  })

  test('returns an empty Map for an empty array', () => {
    // Act
    const map = indexById([])

    // Assert
    expect(map.size).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// toggleInSet
// ---------------------------------------------------------------------------

describe('toggleInSet', () => {
  test('adds an item that is not in the set', () => {
    // Arrange
    const set = new Set(['a', 'b'])

    // Act
    const result = toggleInSet(set, 'c')

    // Assert
    expect(result.has('c')).toBe(true)
    expect(result.size).toBe(3)
  })

  test('removes an item that is already in the set', () => {
    // Arrange
    const set = new Set(['a', 'b', 'c'])

    // Act
    const result = toggleInSet(set, 'b')

    // Assert
    expect(result.has('b')).toBe(false)
    expect(result.size).toBe(2)
  })

  test('does not mutate the original set', () => {
    // Arrange
    const set = new Set(['a'])

    // Act
    toggleInSet(set, 'b')

    // Assert
    expect(set.size).toBe(1)
    expect(set.has('b')).toBe(false)
  })
})
