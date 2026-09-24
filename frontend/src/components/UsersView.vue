<script setup>
import { onMounted, ref } from 'vue'
import { api, extractError } from '../api'
import UserDataTable from './UserDataTable.vue'

const users = ref([])
const name = ref('')
const error = ref('')
const loading = ref(false)
const listLoading = ref(true)
const listError = ref('')

async function load() {
  listError.value = ''
  listLoading.value = true
  try {
    users.value = (await api.get('/users')).data
  } catch {
    listError.value = 'Não foi possível carregar os usuários.'
  } finally {
    listLoading.value = false
  }
}

async function submit() {
  error.value = ''
  loading.value = true
  try {
    await api.post('/users', { name: name.value })
    name.value = ''
  } catch (err) {
    error.value = extractError(err, 'Erro ao cadastrar usuário')
    return
  } finally {
    loading.value = false
  }
  await load()
}

onMounted(load)
</script>

<template>
  <div class="card">
    <h2>Cadastro de usuário</h2>
    <form @submit.prevent="submit">
      <label>
        Nome
        <input v-model="name" required maxlength="255" />
      </label>
      <button type="submit" :disabled="loading">Cadastrar</button>
    </form>
    <p v-if="error" class="error">{{ error }}</p>
  </div>

  <UserDataTable :users="users" :loading="listLoading" :error="listError" @retry="load" />
</template>
