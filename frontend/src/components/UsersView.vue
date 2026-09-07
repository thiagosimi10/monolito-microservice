<script setup>
import { onMounted, ref } from 'vue'
import { api, extractError } from '../api'

const users = ref([])
const name = ref('')
const error = ref('')
const loading = ref(false)

async function load() {
  users.value = (await api.get('/users')).data
}

async function submit() {
  error.value = ''
  loading.value = true
  try {
    await api.post('/users', { name: name.value })
    name.value = ''
    await load()
  } catch (err) {
    error.value = extractError(err, 'Erro ao cadastrar usuário')
  } finally {
    loading.value = false
  }
}

function formatDate(value) {
  return new Date(value).toLocaleString('pt-BR')
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

  <table>
    <thead>
      <tr>
        <th>ID</th>
        <th>Nome</th>
        <th>Data Cadastro</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="user in users" :key="user.id">
        <td>{{ user.id }}</td>
        <td>{{ user.name }}</td>
        <td>{{ formatDate(user.created_at) }}</td>
      </tr>
      <tr v-if="users.length === 0">
        <td colspan="3">Nenhum usuário cadastrado.</td>
      </tr>
    </tbody>
  </table>
</template>
