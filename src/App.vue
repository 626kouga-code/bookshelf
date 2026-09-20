<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <div class="min-h-screen bg-stone-50 text-stone-900">
    <header class="border-b border-stone-200 bg-white px-4 py-3">
      <h1 class="text-lg font-bold">読書管理アプリ</h1>
    </header>
    <main class="mx-auto max-w-4xl p-4">
      <RouterView />
    </main>
  </div>
</template>
