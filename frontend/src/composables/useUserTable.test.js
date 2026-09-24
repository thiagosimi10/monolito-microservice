import { describe, expect, it } from 'vitest'
import { filterUsers, pageWindow, sortUsers } from './useUserTable'
import { makeUsers } from '../test/users'

describe('filterUsers', () => {
  const users = makeUsers()

  it('matches names case- and accent-insensitively', () => {
    expect(filterUsers(users, 'THIAGO').map((u) => u.name)).toEqual(['Thiago', 'Thiago Souza'])
    expect(filterUsers(users, 'joao').map((u) => u.name)).toEqual(['João'])
  })

  it('matches a numeric query against the exact ID', () => {
    expect(filterUsers(users, '2').map((u) => u.id)).toEqual([2])
    expect(filterUsers(users, '#12').map((u) => u.id)).toEqual([12])
  })

  it('returns every user for a blank query', () => {
    expect(filterUsers(users, '   ')).toHaveLength(25)
  })
})

describe('sortUsers', () => {
  const users = makeUsers()

  it('sorts by created_at, then by ID', () => {
    const dates = sortUsers(users, { key: 'created_at', dir: 'asc' }).map((u) => u.created_at)
    expect(dates).toEqual([...dates].sort())
  })

  it('does not mutate its input', () => {
    sortUsers(users, { key: 'id', dir: 'desc' })
    expect(users[0].id).toBe(1)
  })
})

describe('pageWindow', () => {
  it('lists every page when there are few', () => {
    expect(pageWindow(1, 3)).toEqual([1, 2, 3])
  })

  it('collapses distant pages', () => {
    expect(pageWindow(1, 15)).toEqual([1, 2, 3, 4, 5, '…', 15])
    expect(pageWindow(8, 15)).toEqual([1, '…', 7, 8, 9, '…', 15])
    expect(pageWindow(15, 15)).toEqual([1, '…', 11, 12, 13, 14, 15])
  })
})
