<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'

const NAV_ITEMS = [
  { to: '/', label: '本棚' },
  { to: '/books/new', label: '本を追加' },
  { to: '/quotes', label: '引用検索' },
  { to: '/stats', label: '統計・目標' },
  { to: '/settings', label: '設定' },
]
</script>

<template>
  <div class="min-h-screen bg-stone-50 text-stone-900">
    <header class="flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-stone-200 bg-surface px-4 py-3">
      <h1 class="text-lg font-bold">読書管理アプリ</h1>
      <nav aria-label="メインメニュー" class="flex gap-4 text-sm">
        <RouterLink
          v-for="item in NAV_ITEMS"
          :key="item.to"
          :to="item.to"
          class="py-1 text-stone-500 hover:text-stone-900"
          exact-active-class="font-semibold !text-stone-900"
        >
          {{ item.label }}
        </RouterLink>
      </nav>
    </header>
    <main class="mx-auto max-w-4xl p-4">
      <RouterView />
    </main>
  </div>
</template>
