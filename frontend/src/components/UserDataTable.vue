<script setup>
import { computed, toRef } from 'vue'
import { PAGE_SIZES, useUserTable } from '../composables/useUserTable'

const props = defineProps({
  users: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
})

defineEmits(['retry'])

const table = useUserTable(toRef(props, 'users'))
const {
  searchInput,
  search,
  page,
  pageSize,
  rows,
  total,
  pageCount,
  rangeStart,
  rangeEnd,
  pages,
  selectedCount,
  allOnPageSelected,
  someOnPageSelected,
} = table

const columns = [
  { key: 'id', label: 'ID' },
  { key: 'name', label: 'Nome' },
  { key: 'created_at', label: 'Criado em' },
]
const colspan = columns.length + 1

const hasUsers = computed(() => props.users.length > 0)

// Only one body state is shown at a time; a failed reload keeps the rows
// already loaded and shows the error above the table instead.
const state = computed(() => {
  if (!hasUsers.value && props.loading) return 'loading'
  if (!hasUsers.value && props.error) return 'error'
  if (!hasUsers.value) return 'empty'
  if (total.value === 0) return 'no-results'
  return 'rows'
})

const ariaSort = { asc: 'ascending', desc: 'descending' }
const sortIcon = { asc: '↑', desc: '↓' }

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`
}

function formatDate(value) {
  return new Date(value).toLocaleString('pt-BR')
}
</script>

<template>
  <section class="card dt" aria-labelledby="users-title">
    <div class="dt-header">
      <h2 id="users-title">Usuários</h2>
      <p v-if="selectedCount > 0" class="dt-selection" aria-live="polite">
        {{ plural(selectedCount, 'usuário selecionado', 'usuários selecionados') }}
        <button type="button" class="dt-link" @click="table.clearSelection">Limpar seleção</button>
      </p>
    </div>

    <div class="dt-toolbar">
      <label class="dt-search">
        <span class="visually-hidden">Buscar usuário por nome ou ID</span>
        <input
          v-model="searchInput"
          type="search"
          placeholder="Buscar usuário..."
          autocomplete="off"
          :disabled="!hasUsers"
        />
      </label>
      <label class="dt-page-size">
        Mostrar
        <select v-model.number="pageSize" :disabled="!hasUsers">
          <option v-for="size in PAGE_SIZES" :key="size" :value="size">{{ size }}</option>
        </select>
        por página
      </label>
    </div>

    <p v-if="error && hasUsers" class="dt-alert" role="alert">
      {{ error }}
      <button type="button" class="dt-link" @click="$emit('retry')">Tentar novamente</button>
    </p>

    <div class="dt-scroll">
      <table :aria-busy="loading" aria-labelledby="users-title">
        <thead>
          <tr>
            <th class="dt-check" scope="col">
              <input
                type="checkbox"
                aria-label="Selecionar todos os usuários desta página"
                :checked="allOnPageSelected"
                :indeterminate="someOnPageSelected"
                :disabled="state !== 'rows'"
                @change="table.togglePage"
              />
            </th>
            <th
              v-for="col in columns"
              :key="col.key"
              scope="col"
              :class="`dt-col-${col.key}`"
              :aria-sort="ariaSort[table.sortDirection(col.key)] ?? 'none'"
            >
              <button
                type="button"
                class="dt-sort"
                :disabled="state !== 'rows'"
                @click="table.toggleSort(col.key)"
              >
                {{ col.label }}
                <span class="dt-sort-icon" aria-hidden="true">
                  {{ sortIcon[table.sortDirection(col.key)] ?? '↕' }}
                </span>
              </button>
            </th>
          </tr>
        </thead>

        <tbody v-if="state === 'loading'">
          <tr v-for="n in pageSize" :key="n" class="dt-skeleton" aria-hidden="true">
            <td v-for="c in colspan" :key="c"><span /></td>
          </tr>
        </tbody>

        <tbody v-else-if="state === 'rows'">
          <tr
            v-for="user in rows"
            :key="user.id"
            :class="{ 'dt-selected': table.isSelected(user.id) }"
          >
            <td class="dt-check">
              <input
                type="checkbox"
                :aria-label="`Selecionar usuário ${user.name} (ID ${user.id})`"
                :checked="table.isSelected(user.id)"
                @change="table.toggleRow(user.id)"
              />
            </td>
            <td class="dt-col-id">{{ user.id }}</td>
            <td class="dt-col-name">{{ user.name }}</td>
            <td class="dt-col-created_at">
              <time :datetime="user.created_at">{{ formatDate(user.created_at) }}</time>
            </td>
          </tr>
        </tbody>

        <tbody v-else>
          <tr>
            <td :colspan="colspan" class="dt-message">
              <div v-if="state === 'error'" role="alert">
                <p>{{ error }}</p>
                <button type="button" class="dt-button" @click="$emit('retry')">
                  Tentar novamente
                </button>
              </div>
              <p v-else-if="state === 'empty'">Nenhum usuário cadastrado.</p>
              <template v-else>
                <p>Nenhum usuário encontrado.</p>
                <p class="dt-muted">Nenhum resultado para a busca “{{ search }}”.</p>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p v-if="state === 'loading'" class="dt-muted" role="status">Carregando usuários…</p>

    <div v-if="state === 'rows'" class="dt-footer">
      <p class="dt-range" aria-live="polite">
        {{ rangeStart }}–{{ rangeEnd }} de {{ plural(total, 'usuário', 'usuários') }}
      </p>
      <nav class="dt-pagination" aria-label="Paginação da lista de usuários">
        <button
          type="button"
          class="dt-page"
          :disabled="page === 1"
          @click="table.goTo(page - 1)"
        >
          <span aria-hidden="true">‹</span> Anterior
        </button>
        <template v-for="(p, i) in pages" :key="`${p}-${i}`">
          <span v-if="p === '…'" class="dt-gap" aria-hidden="true">…</span>
          <button
            v-else
            type="button"
            class="dt-page"
            :class="{ active: p === page }"
            :aria-current="p === page ? 'page' : undefined"
            :aria-label="`Página ${p}`"
            @click="table.goTo(p)"
          >
            {{ p }}
          </button>
        </template>
        <button
          type="button"
          class="dt-page"
          :disabled="page === pageCount"
          @click="table.goTo(page + 1)"
        >
          Próxima <span aria-hidden="true">›</span>
        </button>
      </nav>
    </div>
  </section>
</template>

<style scoped>
.dt {
  padding: 0;
  overflow: hidden;
}

.dt-header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem 1rem;
  padding: 1rem 1rem 0;
}

.dt-header h2 {
  margin: 0;
}

.dt-selection {
  margin: 0;
  font-size: 0.85rem;
  color: #1e40af;
}

.dt-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 1rem;
}

.dt-search {
  flex: 1 1 220px;
  max-width: 320px;
}

.dt-search input {
  width: 100%;
  min-width: 0;
}

.dt-page-size {
  flex-direction: row;
  align-items: center;
  gap: 0.4rem;
  color: #4b5563;
}

.dt-page-size select {
  min-width: 0;
}

.dt-alert {
  margin: 0 1rem 1rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid #fecaca;
  border-radius: 4px;
  background: #fef2f2;
  color: #b91c1c;
  font-size: 0.9rem;
}

.dt-scroll {
  overflow-x: auto;
  border-top: 1px solid #e5e7eb;
}

.dt table {
  min-width: 480px;
}

.dt th,
.dt td {
  border: none;
  border-bottom: 1px solid #e5e7eb;
  padding: 0.55rem 0.75rem;
  white-space: nowrap;
}

.dt th {
  font-weight: 600;
  color: #374151;
}

.dt tbody tr:last-child td {
  border-bottom: none;
}

.dt tbody tr:hover td {
  background: #f9fafb;
}

.dt tbody tr.dt-selected td {
  background: #eff6ff;
}

.dt .dt-check {
  width: 2.75rem;
  text-align: center;
}

.dt input[type='checkbox'] {
  min-width: 0;
  width: 1rem;
  height: 1rem;
  margin: 0;
  vertical-align: middle;
  cursor: pointer;
}

.dt input[type='checkbox']:disabled {
  cursor: default;
}

.dt .dt-col-id {
  width: 6rem;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.dt .dt-col-name {
  white-space: normal;
  min-width: 12rem;
}

.dt .dt-col-created_at {
  width: 13rem;
  font-variant-numeric: tabular-nums;
}

.dt-sort {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  color: inherit;
  cursor: pointer;
}

.dt-sort:disabled {
  cursor: default;
}

.dt-col-id .dt-sort {
  flex-direction: row-reverse;
}

.dt-sort-icon {
  color: #9ca3af;
  font-size: 0.8rem;
}

th[aria-sort='ascending'] .dt-sort-icon,
th[aria-sort='descending'] .dt-sort-icon {
  color: #1f2937;
}

.dt-message {
  padding: 2rem 1rem;
  text-align: center;
  white-space: normal;
  color: #4b5563;
}

.dt-message p {
  margin: 0 0 0.25rem;
}

.dt-message [role='alert'] p {
  color: #b91c1c;
  margin-bottom: 0.75rem;
}

.dt-muted {
  color: #6b7280;
  font-size: 0.85rem;
}

p.dt-muted[role='status'] {
  margin: 0;
  padding: 0.75rem 1rem;
}

.dt-skeleton span {
  display: block;
  height: 0.8rem;
  border-radius: 3px;
  background: #e5e7eb;
  animation: dt-pulse 1.2s ease-in-out infinite;
}

@keyframes dt-pulse {
  50% {
    opacity: 0.5;
  }
}

@media (prefers-reduced-motion: reduce) {
  .dt-skeleton span {
    animation: none;
  }
}

.dt-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;
}

.dt-range {
  margin: 0;
  font-size: 0.85rem;
  color: #4b5563;
  font-variant-numeric: tabular-nums;
}

.dt-pagination {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem;
  margin: 0;
}

.dt-page,
.dt-button {
  min-width: 2rem;
  padding: 0.3rem 0.6rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background: #fff;
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;
}

.dt-page:hover:not(:disabled),
.dt-button:hover {
  background: #f3f4f6;
}

.dt-page.active {
  background: #1f2937;
  border-color: #1f2937;
  color: #fff;
}

.dt-page:disabled {
  color: #9ca3af;
  cursor: default;
}

.dt-gap {
  padding: 0 0.25rem;
  color: #6b7280;
}

.dt-link {
  margin-left: 0.5rem;
  padding: 0;
  border: none;
  background: none;
  font: inherit;
  color: #2563eb;
  text-decoration: underline;
  cursor: pointer;
}

.dt button:focus-visible,
.dt input:focus-visible,
.dt select:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 560px) {
  .dt-search {
    max-width: none;
  }

  .dt-footer {
    flex-direction: column;
    align-items: stretch;
  }

  .dt-pagination {
    justify-content: center;
  }
}
</style>
