import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import UserDataTable from './UserDataTable.vue'
import { SEARCH_DEBOUNCE_MS } from '../composables/useUserTable'
import { makeUsers } from '../test/users'

function mountTable(props = {}) {
  return mount(UserDataTable, { props: { users: makeUsers(25), ...props } })
}

const ids = (w) => w.findAll('tbody tr').map((tr) => Number(tr.find('.dt-col-id').text()))
const names = (w) => w.findAll('tbody tr').map((tr) => tr.find('.dt-col-name').text())
const range = (w) => w.find('.dt-range').text()
const header = (w, label) => w.findAll('th').find((th) => th.text().startsWith(label))
const headerBox = (w) => w.find('thead input[type="checkbox"]')
const rowBoxes = (w) => w.findAll('tbody input[type="checkbox"]')
const pageButton = (w, label) => w.findAll('.dt-page').find((b) => b.text().includes(label))

async function search(w, text) {
  await w.find('input[type="search"]').setValue(text)
  vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS)
  await w.vm.$nextTick()
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('defaults', () => {
  it('shows page 1 with 10 rows, newest ID first', () => {
    const w = mountTable()
    expect(w.find('select').element.value).toBe('10')
    expect(ids(w)).toEqual([25, 24, 23, 22, 21, 20, 19, 18, 17, 16])
    expect(range(w)).toBe('1–10 de 25 usuários')
    expect(header(w, 'ID').attributes('aria-sort')).toBe('descending')
    expect(w.find('[aria-current="page"]').text()).toBe('1')
  })

  it('offers only the 10, 25 and 50 page sizes', () => {
    const w = mountTable()
    expect(w.findAll('option').map((o) => o.text())).toEqual(['10', '25', '50'])
  })
})

describe('pagination', () => {
  it('splits 25 users into pages of 10, 10 and 5', async () => {
    const w = mountTable()
    expect(w.findAll('tbody tr')).toHaveLength(10)

    await pageButton(w, 'Próxima').trigger('click')
    expect(w.findAll('tbody tr')).toHaveLength(10)
    expect(range(w)).toBe('11–20 de 25 usuários')

    await pageButton(w, '3').trigger('click')
    expect(ids(w)).toEqual([5, 4, 3, 2, 1])
    expect(range(w)).toBe('21–25 de 25 usuários')
  })

  it('disables Anterior on the first page and Próxima on the last', async () => {
    const w = mountTable()
    expect(pageButton(w, 'Anterior').attributes('disabled')).toBeDefined()
    expect(pageButton(w, 'Próxima').attributes('disabled')).toBeUndefined()

    await pageButton(w, '3').trigger('click')
    expect(pageButton(w, 'Anterior').attributes('disabled')).toBeUndefined()
    expect(pageButton(w, 'Próxima').attributes('disabled')).toBeDefined()
  })

  it('shows every user on one page with a page size of 25', async () => {
    const w = mountTable()
    await w.find('select').setValue('25')
    expect(w.findAll('tbody tr')).toHaveLength(25)
    expect(range(w)).toBe('1–25 de 25 usuários')
  })

  it('collapses the page list for many pages', () => {
    const w = mountTable({ users: makeUsers(144) })
    const labels = w.findAll('.dt-pagination > *').map((el) => el.text())
    expect(labels).toEqual(['‹ Anterior', '1', '2', '3', '4', '5', '…', '15', 'Próxima ›'])
  })
})

describe('sorting', () => {
  it('cycles a column: ascending, descending, back to the default', async () => {
    const w = mountTable({ users: makeUsers(5) })
    const sortName = () => header(w, 'Nome').find('button').trigger('click')

    await sortName()
    expect(names(w)).toEqual(['Ana', 'Bruno', 'João', 'Maria', 'Thiago'])
    expect(header(w, 'Nome').attributes('aria-sort')).toBe('ascending')
    expect(header(w, 'ID').attributes('aria-sort')).toBe('none')

    await sortName()
    expect(names(w)).toEqual(['Thiago', 'Maria', 'João', 'Bruno', 'Ana'])
    expect(header(w, 'Nome').attributes('aria-sort')).toBe('descending')

    await sortName()
    expect(ids(w)).toEqual([5, 4, 3, 2, 1])
    expect(header(w, 'Nome').attributes('aria-sort')).toBe('none')
  })

  it('sorts by ID ascending and descending', async () => {
    const w = mountTable()
    const sortId = () => header(w, 'ID').find('button').trigger('click')

    await sortId()
    expect(ids(w)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    await sortId()
    expect(ids(w)).toEqual([25, 24, 23, 22, 21, 20, 19, 18, 17, 16])
    expect(header(w, 'ID').attributes('aria-sort')).toBe('descending')
  })

  it('sorts by creation date', async () => {
    const w = mountTable({ users: makeUsers(5) })
    await header(w, 'Criado em').find('button').trigger('click')
    const dates = w.findAll('tbody time').map((t) => t.attributes('datetime'))
    expect(dates).toEqual([...dates].sort())
    expect(ids(w)).not.toEqual([1, 2, 3, 4, 5])
  })

  it('sorts the whole list, not just the current page', async () => {
    const w = mountTable()
    await header(w, 'ID').find('button').trigger('click')
    expect(ids(w)[0]).toBe(1)
  })

  it('shows the sort state with an icon', async () => {
    const w = mountTable()
    const icon = (label) => header(w, label).find('.dt-sort-icon').text()
    expect([icon('ID'), icon('Nome')]).toEqual(['↓', '↕'])
    await header(w, 'Nome').find('button').trigger('click')
    expect([icon('ID'), icon('Nome')]).toEqual(['↕', '↑'])
  })
})

describe('search', () => {
  it('filters by name, case-insensitively, after the debounce', async () => {
    const w = mountTable()
    await w.find('input[type="search"]').setValue('thiago')
    expect(w.findAll('tbody tr')).toHaveLength(10) // not applied yet

    vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS)
    await w.vm.$nextTick()
    expect(names(w)).toEqual(['Thiago Souza', 'Thiago'])
    expect(range(w)).toBe('1–2 de 2 usuários')
  })

  it('filters by ID', async () => {
    const w = mountTable()
    await search(w, '17')
    expect(ids(w)).toEqual([17])
    expect(range(w)).toBe('1–1 de 1 usuário')
  })

  it('shows a no-results state for a search with no match', async () => {
    const w = mountTable()
    await search(w, 'xyz-nao-existe')
    expect(w.text()).toContain('Nenhum usuário encontrado.')
    expect(w.text()).toContain('xyz-nao-existe')
    expect(w.text()).not.toContain('Nenhum usuário cadastrado.')
    expect(w.find('.dt-pagination').exists()).toBe(false)
    expect(w.findAll('th')).toHaveLength(4) // header still intact
  })

  it('goes back to page 1 when searching from a later page', async () => {
    const w = mountTable()
    await pageButton(w, '3').trigger('click')
    expect(w.find('[aria-current="page"]').text()).toBe('3')

    await search(w, 'a')
    expect(w.find('[aria-current="page"]').text()).toBe('1')
    expect(range(w).startsWith('1–')).toBe(true)
  })
})

describe('selection', () => {
  it('selects and unselects one row', async () => {
    const w = mountTable()
    await rowBoxes(w)[0].setValue(true)
    expect(w.find('.dt-selection').text()).toContain('1 usuário selecionado')
    expect(w.findAll('tbody tr')[0].classes()).toContain('dt-selected')

    await rowBoxes(w)[0].setValue(false)
    expect(w.find('.dt-selection').exists()).toBe(false)
  })

  it('selects several rows and marks the header indeterminate', async () => {
    const w = mountTable()
    await rowBoxes(w)[0].setValue(true)
    await rowBoxes(w)[2].setValue(true)
    expect(w.find('.dt-selection').text()).toContain('2 usuários selecionados')
    expect(headerBox(w).element.indeterminate).toBe(true)
    expect(headerBox(w).element.checked).toBe(false)
  })

  it('selects and unselects every row on the page from the header', async () => {
    const w = mountTable()
    await headerBox(w).setValue(true)
    expect(rowBoxes(w).every((b) => b.element.checked)).toBe(true)
    expect(headerBox(w).element.checked).toBe(true)
    expect(headerBox(w).element.indeterminate).toBe(false)
    expect(w.find('.dt-selection').text()).toContain('10 usuários selecionados')

    await headerBox(w).setValue(false)
    expect(rowBoxes(w).some((b) => b.element.checked)).toBe(false)
    expect(headerBox(w).element.indeterminate).toBe(false)
  })

  it('completes a partial page selection from the indeterminate header', async () => {
    const w = mountTable()
    await rowBoxes(w)[1].setValue(true)
    await headerBox(w).trigger('change')
    expect(rowBoxes(w).every((b) => b.element.checked)).toBe(true)
  })

  it('keeps the selection across pages', async () => {
    const w = mountTable()
    await rowBoxes(w)[0].setValue(true) // ID 25
    await rowBoxes(w)[2].setValue(true) // ID 23

    await pageButton(w, 'Próxima').trigger('click')
    expect(headerBox(w).element.checked).toBe(false)
    expect(headerBox(w).element.indeterminate).toBe(false)
    await rowBoxes(w)[0].setValue(true) // ID 15
    expect(w.find('.dt-selection').text()).toContain('3 usuários selecionados')

    await pageButton(w, 'Anterior').trigger('click')
    expect(rowBoxes(w).map((b) => b.element.checked).slice(0, 3)).toEqual([true, false, true])
  })

  it('selecting the page does not touch other pages', async () => {
    const w = mountTable()
    await headerBox(w).setValue(true)
    await pageButton(w, 'Próxima').trigger('click')
    await rowBoxes(w)[0].setValue(true)
    await headerBox(w).setValue(true)
    await headerBox(w).setValue(false)
    expect(w.find('.dt-selection').text()).toContain('10 usuários selecionados')
  })

  it('clears the whole selection', async () => {
    const w = mountTable()
    await headerBox(w).setValue(true)
    await w.find('.dt-selection button').trigger('click')
    expect(w.find('.dt-selection').exists()).toBe(false)
    expect(rowBoxes(w).some((b) => b.element.checked)).toBe(false)
  })

  it('drops selected users that disappear after a reload', async () => {
    const w = mountTable()
    await rowBoxes(w)[0].setValue(true) // ID 25
    await rowBoxes(w)[1].setValue(true) // ID 24
    await w.setProps({ users: makeUsers(24) })
    expect(w.find('.dt-selection').text()).toContain('1 usuário selecionado')
  })

  it('labels every checkbox', () => {
    const w = mountTable()
    expect(headerBox(w).attributes('aria-label')).toBe('Selecionar todos os usuários desta página')
    expect(rowBoxes(w)[0].attributes('aria-label')).toBe('Selecionar usuário Yara (ID 25)')
  })
})

describe('states', () => {
  it('shows skeleton rows while the first load is running', () => {
    const w = mountTable({ users: [], loading: true })
    expect(w.find('[role="status"]').text()).toBe('Carregando usuários…')
    expect(w.findAll('tbody tr.dt-skeleton')).toHaveLength(10)
    expect(w.find('table').attributes('aria-busy')).toBe('true')
    expect(w.text()).not.toContain('Nenhum usuário cadastrado.')
  })

  it('keeps the rows while reloading', () => {
    const w = mountTable({ loading: true })
    expect(w.findAll('tbody tr')).toHaveLength(10)
    expect(w.find('.dt-skeleton').exists()).toBe(false)
  })

  it('shows an error with a retry button', async () => {
    const w = mountTable({ users: [], error: 'Não foi possível carregar os usuários.' })
    expect(w.find('[role="alert"]').text()).toContain('Não foi possível carregar os usuários.')
    await w.find('[role="alert"] button').trigger('click')
    expect(w.emitted('retry')).toHaveLength(1)
  })

  it('shows an empty state when there are no users', () => {
    const w = mountTable({ users: [] })
    expect(w.text()).toContain('Nenhum usuário cadastrado.')
    expect(w.text()).not.toContain('Nenhum usuário encontrado.')
    expect(w.find('input[type="search"]').attributes('disabled')).toBeDefined()
    expect(w.find('.dt-pagination').exists()).toBe(false)
  })
})
