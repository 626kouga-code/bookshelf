<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { Book } from '@/api/books'
import { progressOf, STATUS_CLASSES, STATUS_LABELS } from '@/utils/book'

const props = defineProps<{ book: Book }>()

const progress = computed(() => progressOf(props.book))
</script>

<template>
  <article
    class="relative flex gap-3 rounded-lg border border-stone-200 bg-white p-3 hover:border-stone-400 focus-within:border-stone-400"
  >
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
      <h2 class="truncate font-semibold" :title="book.title">
        <!-- カード全体をクリック領域にする（after:absolute） -->
        <RouterLink :to="`/books/${book.id}`" class="after:absolute after:inset-0">{{ book.title }}</RouterLink>
      </h2>
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
