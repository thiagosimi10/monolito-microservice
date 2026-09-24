import { computed, onScopeDispose, ref, unref, watch } from 'vue'

// Client-side table state for the users list. GET /users returns every user
// (both the monolith and user-service), so search, sort and pagination run in
// the browser over that array.

export const PAGE_SIZES = [10, 25, 50]
export const DEFAULT_PAGE_SIZE = 10
export const SEARCH_DEBOUNCE_MS = 250

// With no column chosen the list shows the newest users first.
export const DEFAULT_SORT = { key: 'id', dir: 'desc' }

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true })

function normalize(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

// Case- and accent-insensitive match on the name; a numeric query also
// matches the exact ID ("185" finds user 185, not 18, 1850...).
export function filterUsers(users, query) {
  const q = normalize(query)
  if (!q) return users
  const id = /^#?\d+$/.test(q) ? Number(q.replace('#', '')) : null
  return users.filter((u) => u.id === id || normalize(u.name).includes(q))
}

const comparators = {
  id: (a, b) => a.id - b.id,
  name: (a, b) => collator.compare(a.name, b.name) || a.id - b.id,
  created_at: (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || a.id - b.id,
}

export function sortUsers(users, { key, dir }) {
  const compare = comparators[key]
  const sign = dir === 'desc' ? -1 : 1
  return [...users].sort((a, b) => sign * compare(a, b))
}

// Page numbers with gaps, e.g. [1, 2, 3, 4, 5, '…', 15] or [1, '…', 7, 8, 9, '…', 15].
export function pageWindow(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  if (current <= 4) return [1, 2, 3, 4, 5, '…', total]
  if (current >= total - 3) return [1, '…', total - 4, total - 3, total - 2, total - 1, total]
  return [1, '…', current - 1, current, current + 1, '…', total]
}

export function useUserTable(source) {
  const searchInput = ref('')
  const search = ref('')
  const sort = ref(null) // null = DEFAULT_SORT; otherwise { key, dir }
  const page = ref(1)
  const pageSize = ref(DEFAULT_PAGE_SIZE)
  const selected = ref(new Set())

  let debounce
  watch(searchInput, (value) => {
    clearTimeout(debounce)
    debounce = setTimeout(() => {
      search.value = value
    }, SEARCH_DEBOUNCE_MS)
  })
  onScopeDispose(() => clearTimeout(debounce))

  const users = computed(() => unref(source) ?? [])
  const activeSort = computed(() => sort.value ?? DEFAULT_SORT)
  const filtered = computed(() => filterUsers(users.value, search.value))
  const sorted = computed(() => sortUsers(filtered.value, activeSort.value))
  const total = computed(() => sorted.value.length)
  const pageCount = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
  const rangeStart = computed(() => (total.value === 0 ? 0 : (page.value - 1) * pageSize.value + 1))
  const rangeEnd = computed(() => Math.min(page.value * pageSize.value, total.value))
  const rows = computed(() => sorted.value.slice(rangeStart.value - 1, rangeEnd.value))
  const pages = computed(() => pageWindow(page.value, pageCount.value))

  // A new search, sort or page size starts again from the first page.
  watch([search, sort, pageSize], () => {
    page.value = 1
  })

  // Keep the page valid when the list shrinks (e.g. after a reload).
  watch(pageCount, (count) => {
    if (page.value > count) page.value = count
  })

  // Drop selected IDs that no longer exist after the list is reloaded.
  watch(users, (list) => {
    if (selected.value.size === 0) return
    const ids = new Set(list.map((u) => u.id))
    const kept = [...selected.value].filter((id) => ids.has(id))
    if (kept.length !== selected.value.size) selected.value = new Set(kept)
  })

  // Click cycle per column: ascending -> descending -> default order.
  function toggleSort(key) {
    const current = sort.value
    if (!current || current.key !== key) sort.value = { key, dir: 'asc' }
    else if (current.dir === 'asc') sort.value = { key, dir: 'desc' }
    else sort.value = null
  }

  function sortDirection(key) {
    return activeSort.value.key === key ? activeSort.value.dir : null
  }

  function goTo(n) {
    page.value = Math.min(Math.max(1, n), pageCount.value)
  }

  // Selection is a set of IDs, so it survives paging, sorting and searching.
  const pageIds = computed(() => rows.value.map((u) => u.id))
  const selectedOnPage = computed(() => pageIds.value.filter((id) => selected.value.has(id)).length)
  const allOnPageSelected = computed(
    () => pageIds.value.length > 0 && selectedOnPage.value === pageIds.value.length,
  )
  const someOnPageSelected = computed(() => selectedOnPage.value > 0 && !allOnPageSelected.value)
  const selectedCount = computed(() => selected.value.size)

  function isSelected(id) {
    return selected.value.has(id)
  }

  function toggleRow(id) {
    const next = new Set(selected.value)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    selected.value = next
  }

  function togglePage() {
    const next = new Set(selected.value)
    const select = !allOnPageSelected.value
    for (const id of pageIds.value) {
      if (select) next.add(id)
      else next.delete(id)
    }
    selected.value = next
  }

  function clearSelection() {
    selected.value = new Set()
  }

  return {
    searchInput,
    search,
    sort,
    page,
    pageSize,
    selected,
    rows,
    total,
    pageCount,
    rangeStart,
    rangeEnd,
    pages,
    toggleSort,
    sortDirection,
    goTo,
    selectedCount,
    allOnPageSelected,
    someOnPageSelected,
    isSelected,
    toggleRow,
    togglePage,
    clearSelection,
  }
}
