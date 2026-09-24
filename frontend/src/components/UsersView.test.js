import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import UsersView from './UsersView.vue'
import { api } from '../api'
import { makeUsers } from '../test/users'

vi.mock('../api', async (importOriginal) => ({
  ...(await importOriginal()),
  api: { get: vi.fn(), post: vi.fn() },
}))

function deferred() {
  let resolve
  const promise = new Promise((r) => {
    resolve = r
  })
  return { promise, resolve }
}

beforeEach(() => vi.resetAllMocks())

describe('UsersView', () => {
  it('loads /users through the configured API client', async () => {
    api.get.mockResolvedValue({ data: makeUsers(25) })
    const w = mount(UsersView)
    await flushPromises()
    expect(api.get).toHaveBeenCalledWith('/users')
    expect(w.findAll('tbody tr')).toHaveLength(10)
    expect(w.find('.dt-range').text()).toBe('1–10 de 25 usuários')
  })

  it('shows the loading state until /users answers', async () => {
    const pending = deferred()
    api.get.mockReturnValue(pending.promise)
    const w = mount(UsersView)
    await w.vm.$nextTick()
    expect(w.find('[role="status"]').text()).toBe('Carregando usuários…')
    expect(w.text()).not.toContain('Nenhum usuário cadastrado.')

    pending.resolve({ data: makeUsers(3) })
    await flushPromises()
    expect(w.find('[role="status"]').exists()).toBe(false)
    expect(w.findAll('tbody tr')).toHaveLength(3)
  })

  it('shows a friendly error when /users fails and retries', async () => {
    api.get.mockRejectedValueOnce(new Error('Network Error\n    at stack trace'))
    const w = mount(UsersView)
    await flushPromises()
    const alert = w.find('[role="alert"]')
    expect(alert.text()).toContain('Não foi possível carregar os usuários.')
    expect(w.text()).not.toContain('Network Error')

    api.get.mockResolvedValueOnce({ data: makeUsers(2) })
    await alert.find('button').trigger('click')
    await flushPromises()
    expect(api.get).toHaveBeenCalledTimes(2)
    expect(w.findAll('tbody tr')).toHaveLength(2)
  })

  it('shows the empty state when /users returns []', async () => {
    api.get.mockResolvedValue({ data: [] })
    const w = mount(UsersView)
    await flushPromises()
    expect(w.text()).toContain('Nenhum usuário cadastrado.')
  })

  it('still creates a user and reloads the list', async () => {
    api.get.mockResolvedValueOnce({ data: makeUsers(2) })
    api.post.mockResolvedValue({ data: { id: 3, name: 'Novo' } })
    const w = mount(UsersView)
    await flushPromises()

    api.get.mockResolvedValueOnce({
      data: [...makeUsers(2), { id: 3, name: 'Novo', created_at: '2026-01-01T00:00:00Z' }],
    })
    await w.find('form input').setValue('Novo')
    await w.find('form').trigger('submit')
    await flushPromises()

    expect(api.post).toHaveBeenCalledWith('/users', { name: 'Novo' })
    expect(w.findAll('tbody tr')[0].text()).toContain('Novo')
  })
})
