<script setup>
import { onMounted, ref } from 'vue'
import { api, extractError } from '../api'

const sales = ref([])
const users = ref([])
const form = ref({ user_id: '', item_name: '', quantity: 1 })
const error = ref('')
const loading = ref(false)

async function load() {
  const [salesRes, usersRes] = await Promise.all([
    api.get('/sales'),
    api.get('/users'),
  ])
  sales.value = salesRes.data
  users.value = usersRes.data
}

async function submit() {
  error.value = ''
  loading.value = true
  try {
    await api.post('/sales', {
      user_id: Number(form.value.user_id),
      item_name: form.value.item_name,
      quantity: Number(form.value.quantity),
    })
    form.value = { user_id: '', item_name: '', quantity: 1 }
    await load()
  } catch (err) {
    error.value = extractError(err, 'Erro ao cadastrar venda')
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
    <h2>Cadastro de venda</h2>
    <form @submit.prevent="submit">
      <label>
        Usuário
        <select v-model="form.user_id" required>
          <option value="" disabled>Selecione</option>
          <option v-for="user in users" :key="user.id" :value="user.id">
            {{ user.name }}
          </option>
        </select>
      </label>
      <label>
        Item
        <input v-model="form.item_name" required maxlength="255" />
      </label>
      <label>
        Quantidade
        <input v-model="form.quantity" type="number" min="1" required />
      </label>
      <button type="submit" :disabled="loading">Cadastrar Venda</button>
    </form>
    <p v-if="error" class="error">{{ error }}</p>
  </div>

  <table>
    <thead>
      <tr>
        <th>ID</th>
        <th>Usuário</th>
        <th>Item</th>
        <th>Quantidade</th>
        <th>Data</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="sale in sales" :key="sale.id">
        <td>{{ sale.id }}</td>
        <td>{{ sale.user_name }}</td>
        <td>{{ sale.item_name }}</td>
        <td>{{ sale.quantity }}</td>
        <td>{{ formatDate(sale.created_at) }}</td>
      </tr>
      <tr v-if="sales.length === 0">
        <td colspan="5">Nenhuma venda cadastrada.</td>
      </tr>
    </tbody>
  </table>
</template>
