<script setup>
import { ref } from 'vue'
import UsersView from './components/UsersView.vue'
import SalesView from './components/SalesView.vue'

const tab = ref('users')
</script>

<template>
  <div class="container">
    <h1>Monólito Lab</h1>
    <nav>
      <button :class="{ active: tab === 'users' }" @click="tab = 'users'">Usuários</button>
      <button :class="{ active: tab === 'sales' }" @click="tab = 'sales'">Vendas</button>
    </nav>

    <UsersView v-if="tab === 'users'" />
    <SalesView v-else />
  </div>
</template>
