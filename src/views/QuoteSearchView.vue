<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { searchQuotes, type QuoteSearchResult } from '@/api/books'

const SEARCH_DEBOUNCE_MS = 300

const keyword = ref('')
const results = ref<QuoteSearchResult[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

// 連続して検索したとき、古いリクエストの結果で新しい結果を上書きしない
let latestRequest = 0

async function search() {
  const requestId = ++latestRequest
  loading.value = true
  error.value = null
  try {
    const result = await searchQuotes(keyword.value)
    if (requestId !== latestRequest) return
    results.value = result
  } catch (e) {
    if (requestId !== latestRequest) return
    error.value = e instanceof Error ? e.message : '引用の検索に失敗しました'
  } finally {
    if (requestId === latestRequest) loading.value = false
  }
}

let debounceTimer: ReturnType<typeof setTimeout> | undefined
watch(keyword, () => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(search, SEARCH_DEBOUNCE_MS)
})
onBeforeUnmount(() => clearTimeout(debounceTimer))

onMounted(() => search())
</script>

<template>
  <section class="mx-auto max-w-2xl">
    <h2 class="text-xl font-bold">引用検索</h2>

    <input
      v-model="keyword"
      type="search"
      placeholder="引用をキーワードで検索"
      aria-label="キーワード検索"
      class="mt-4 w-full rounded border border-stone-300 bg-surface px-3 py-2 text-sm"
    />

    <p v-if="error" role="alert" class="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
      {{ error }}
      <button type="button" class="ml-2 underline" @click="search()">再読み込み</button>
    </p>

    <p v-else-if="loading && results.length === 0" class="mt-6 text-stone-500">読み込み中…</p>

    <p v-else-if="results.length === 0" class="mt-6 text-stone-600">
      {{ keyword.trim() === '' ? 'まだ引用がありません。' : '条件に合う引用はありません。' }}
    </p>

    <ul v-else class="mt-4 space-y-2" :class="{ 'opacity-60': loading }">
      <li v-for="quote in results" :key="quote.id" class="rounded border border-stone-200 p-3 text-sm">
        <p class="whitespace-pre-wrap break-words">{{ quote.text }}</p>
        <p class="mt-2 text-xs text-stone-500">
          <RouterLink :to="`/books/${quote.book_id}`" class="underline hover:text-stone-900">{{ quote.book_title }}</RouterLink>
          <span v-if="quote.page">・p.{{ quote.page }}</span>
        </p>
      </li>
    </ul>
  </section>
</template>
