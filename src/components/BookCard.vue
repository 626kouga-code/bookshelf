<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { Book } from '@/api/books'
import { daysSince, progressOf, seriesLabel, STATUS_CLASSES, STATUS_LABELS } from '@/utils/book'

const props = defineProps<{ book: Book }>()

const emit = defineEmits<{
  /** タグ・シリーズをクリックしたとき（本棚で、その条件で絞り込むため） */
  'filter-tag': [tag: string]
  'filter-series': [series: string]
}>()

const progress = computed(() => progressOf(props.book))
/** 「読みたい」の本の積読日数（登録日から）。それ以外の状態では null。 */
const tsundokuDays = computed(() =>
  props.book.status === 'want' ? daysSince(props.book.added_at) : null,
)
const series = computed(() => seriesLabel(props.book))
</script>

<template>
  <article
    class="relative flex gap-3 rounded-lg border border-stone-200 bg-surface p-3 hover:border-stone-400 focus-within:border-stone-400"
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
      <h2 class="flex items-center gap-1 font-semibold" :title="book.title">
        <span v-if="book.favorite" class="shrink-0 text-amber-500" aria-label="お気に入り">★</span>
        <!-- カード全体をクリック領域にする（after:absolute） -->
        <RouterLink :to="`/books/${book.id}`" class="truncate after:absolute after:inset-0">{{ book.title }}</RouterLink>
      </h2>
      <p v-if="book.authors.length" class="truncate text-sm text-stone-600">
        {{ book.authors.join('、') }}
      </p>
      <!-- タグ・シリーズのボタンは、カード全体のリンク（after:absolute）より上に置く -->
      <button
        v-if="series"
        type="button"
        class="relative z-10 max-w-full truncate text-sm text-stone-600 hover:underline"
        :title="`シリーズ「${book.series}」で絞り込む`"
        @click="emit('filter-series', book.series!)"
      >
        {{ series }}
      </button>

      <div class="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <span class="rounded-full px-2 py-0.5" :class="STATUS_CLASSES[book.status]">
          {{ STATUS_LABELS[book.status] }}
        </span>
        <span v-if="tsundokuDays !== null" class="text-stone-500">積読 {{ tsundokuDays }}日</span>
        <span v-if="book.genre" class="text-stone-500">{{ book.genre }}</span>
        <span
          v-if="book.rating > 0"
          class="text-amber-600"
          :aria-label="`評価 ${book.rating}`"
        >
          {{ '★'.repeat(book.rating) }}{{ '☆'.repeat(5 - book.rating) }}
        </span>
      </div>

      <div v-if="book.tags.length" class="mt-2 flex flex-wrap gap-1 text-xs">
        <button
          v-for="tag in book.tags"
          :key="tag"
          type="button"
          class="relative z-10 rounded bg-stone-100 px-1.5 py-0.5 text-stone-600 hover:bg-stone-200"
          :title="`タグ「${tag}」で絞り込む`"
          @click="emit('filter-tag', tag)"
        >
          #{{ tag }}
        </button>
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
