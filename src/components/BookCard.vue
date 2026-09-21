<script setup lang="ts">
import { computed } from 'vue'
import type { Book, BookStatus } from '@/api/books'

const props = defineProps<{ book: Book }>()

const STATUS_LABELS: Record<BookStatus, string> = {
  want: '読みたい',
  reading: '読書中',
  done: '読了',
}

const STATUS_CLASSES: Record<BookStatus, string> = {
  want: 'bg-stone-100 text-stone-700',
  reading: 'bg-sky-100 text-sky-800',
  done: 'bg-emerald-100 text-emerald-800',
}

const progress = computed(() => {
  const { pages, current_page: current } = props.book
  if (!pages || current === null) return null
  return { current, pages, percent: Math.min(100, Math.round((current / pages) * 100)) }
})
</script>

<template>
  <article class="flex gap-3 rounded-lg border border-stone-200 bg-white p-3">
    <img
      v-if="book.cover"
      :src="book.cover"
      :alt="`${book.title}の表紙`"
      class="h-24 w-16 shrink-0 rounded object-cover"
      loading="lazy"
    />
    <div
      v-else
      class="flex h-24 w-16 shrink-0 items-center justify-center rounded bg-stone-100 text-xs text-stone-400"
      aria-hidden="true"
    >
      No image
    </div>

    <div class="min-w-0 flex-1">
      <h2 class="truncate font-semibold" :title="book.title">{{ book.title }}</h2>
      <p v-if="book.authors.length" class="truncate text-sm text-stone-600">
        {{ book.authors.join('、') }}
      </p>

      <div class="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <span class="rounded-full px-2 py-0.5" :class="STATUS_CLASSES[book.status]">
          {{ STATUS_LABELS[book.status] }}
        </span>
        <span v-if="book.genre" class="text-stone-500">{{ book.genre }}</span>
        <span
          v-if="book.rating > 0"
          class="text-amber-600"
          :aria-label="`評価 ${book.rating}`"
        >
          {{ '★'.repeat(book.rating) }}{{ '☆'.repeat(5 - book.rating) }}
        </span>
      </div>

      <div v-if="book.status === 'reading' && progress" class="mt-2">
        <div class="h-1.5 overflow-hidden rounded-full bg-stone-100">
          <div class="h-full bg-sky-500" :style="{ width: `${progress.percent}%` }" />
        </div>
        <p class="mt-1 text-xs text-stone-500">
          {{ progress.current }} / {{ progress.pages }} ページ（{{ progress.percent }}%）
        </p>
      </div>
    </div>
  </article>
</template>
