<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { storeToRefs } from 'pinia'
import BookCard from '@/components/BookCard.vue'
import { useBooksStore } from '@/stores/books'
import type { BookSort, SortOrder } from '@/api/books'

const SEARCH_DEBOUNCE_MS = 300

const TABS = [
  { value: '', label: 'すべて' },
  { value: 'want', label: '読みたい' },
  { value: 'reading', label: '読書中' },
  { value: 'done', label: '読了' },
] as const

const SORTS: { value: `${BookSort}:${SortOrder}`; label: string }[] = [
  { value: 'added_at:desc', label: '追加日が新しい順' },
  { value: 'added_at:asc', label: '追加日が古い順' },
  { value: 'title:asc', label: 'タイトル順' },
  { value: 'rating:desc', label: '評価が高い順' },
  { value: 'finished_at:desc', label: '読了日が新しい順' },
  { value: 'series:asc', label: 'シリーズ順' },
]

/** 評価の絞り込み（'' はすべて、0 は未評価） */
const RATINGS: { value: number | ''; label: string }[] = [
  { value: '', label: '評価: すべて' },
  ...[5, 4, 3, 2, 1].map((n) => ({ value: n, label: `${'★'.repeat(n)}${'☆'.repeat(5 - n)}` })),
  { value: 0, label: '未評価' },
]

const store = useBooksStore()
const { books, loading, error, filters, isFiltered } = storeToRefs(store)

const keyword = ref(filters.value.q)

const sortValue = computed({
  get: () => `${filters.value.sort}:${filters.value.order}`,
  set: (value: string) => {
    const [sort, order] = value.split(':') as [BookSort, SortOrder]
    filters.value.sort = sort
    filters.value.order = order
  },
})

let debounceTimer: ReturnType<typeof setTimeout> | undefined

watch(keyword, (value) => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    filters.value.q = value
  }, SEARCH_DEBOUNCE_MS)
})

/** 絞り込み中の条件（カードから選んだもの）。× で解除できる */
const chips = computed(() => {
  const f = filters.value
  const list: { key: 'series' | 'tag' | 'author' | 'genre'; name: string; value: string; display: string }[] = []
  if (f.series) list.push({ key: 'series', name: 'シリーズ', value: f.series, display: f.series })
  if (f.tag) list.push({ key: 'tag', name: 'タグ', value: f.tag, display: `#${f.tag}` })
  if (f.author) list.push({ key: 'author', name: '著者', value: f.author, display: f.author })
  if (f.genre) list.push({ key: 'genre', name: 'ジャンル', value: f.genre, display: f.genre })
  return list
})

/** シリーズで絞り込むときは、巻数順に読めるようシリーズ順に並べ替える */
function filterBySeries(series: string) {
  filters.value.series = series
  sortValue.value = 'series:asc'
}

// 絞り込み・並べ替えが変わるたびに取得し直す
watch(() => ({ ...filters.value }), () => store.fetchBooks())

onMounted(() => store.fetchBooks())
onBeforeUnmount(() => clearTimeout(debounceTimer))
</script>

<template>
  <section>
    <div role="tablist" aria-label="状態" class="flex gap-1 overflow-x-auto border-b border-stone-200">
      <button
        v-for="tab in TABS"
        :key="tab.value"
        type="button"
        role="tab"
        :aria-selected="filters.status === tab.value"
        class="shrink-0 border-b-2 px-3 py-2 text-sm"
        :class="
          filters.status === tab.value
            ? 'border-stone-900 font-semibold'
            : 'border-transparent text-stone-500 hover:text-stone-900'
        "
        @click="filters.status = tab.value"
      >
        {{ tab.label }}
      </button>
    </div>

    <div class="mt-4 flex flex-col gap-2 sm:flex-row">
      <input
        v-model="keyword"
        type="search"
        placeholder="タイトル・著者で検索"
        aria-label="キーワード検索"
        class="min-w-0 flex-1 rounded border border-stone-300 bg-surface px-3 py-2 text-sm"
      />
      <select
        v-model="sortValue"
        aria-label="並べ替え"
        class="rounded border border-stone-300 bg-surface px-3 py-2 text-sm"
      >
        <option v-for="s in SORTS" :key="s.value" :value="s.value">{{ s.label }}</option>
      </select>
      <select
        v-model="filters.rating"
        aria-label="評価で絞り込み"
        class="rounded border border-stone-300 bg-surface px-3 py-2 text-sm"
      >
        <option v-for="r in RATINGS" :key="r.label" :value="r.value">{{ r.label }}</option>
      </select>
      <button
        type="button"
        :aria-pressed="filters.favoriteOnly"
        class="shrink-0 rounded border px-3 py-2 text-sm"
        :class="
          filters.favoriteOnly
            ? 'border-amber-400 bg-amber-50 text-amber-700'
            : 'border-stone-300 bg-surface text-stone-600 hover:bg-stone-50'
        "
        @click="filters.favoriteOnly = !filters.favoriteOnly"
      >
        {{ filters.favoriteOnly ? '★' : '☆' }} お気に入り
      </button>
    </div>

    <div v-if="chips.length" class="mt-3 flex flex-wrap gap-2 text-sm" aria-label="絞り込み中の条件">
      <span
        v-for="chip in chips"
        :key="chip.key"
        class="flex items-center gap-1 rounded-full bg-stone-200 py-0.5 pl-3 pr-1"
      >
        {{ chip.name }}: {{ chip.display }}
        <button
          type="button"
          class="rounded-full px-1.5 text-stone-500 hover:bg-stone-300 hover:text-stone-900"
          :aria-label="`${chip.name}「${chip.value}」の絞り込みを解除`"
          @click="filters[chip.key] = ''"
        >
          ×
        </button>
      </span>
    </div>

    <p v-if="error" role="alert" class="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
      {{ error }}
      <button type="button" class="ml-2 underline" @click="store.fetchBooks()">再読み込み</button>
    </p>

    <p v-else-if="loading && books.length === 0" class="mt-6 text-stone-500">読み込み中…</p>

    <p v-else-if="books.length === 0" class="mt-6 text-stone-600">
      <template v-if="isFiltered">条件に合う本はありません。</template>
      <template v-else>
        本棚はまだ空です。
        <RouterLink to="/books/new" class="ml-1 underline">本を追加する</RouterLink>
      </template>
    </p>

    <ul v-else class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2" :class="{ 'opacity-60': loading }">
      <li v-for="book in books" :key="book.id">
        <BookCard
          :book="book"
          @filter-tag="filters.tag = $event"
          @filter-series="filterBySeries"
          @filter-author="filters.author = $event"
          @filter-genre="filters.genre = $event"
        />
      </li>
    </ul>
  </section>
</template>
