<script setup lang="ts">
import { ref } from 'vue'
import { searchGoogleBooks, type BookCandidate } from '@/api/googleBooks'

const emit = defineEmits<{ select: [candidate: BookCandidate] }>()

const query = ref('')
const candidates = ref<BookCandidate[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
/** 検索を実行済みか（0件表示の出し分けに使う） */
const searched = ref(false)

// 連続して検索したとき、古いリクエストの結果で新しい結果を上書きしない
let latestRequest = 0

async function onSearch() {
  if (query.value.trim() === '') return
  const requestId = ++latestRequest
  loading.value = true
  error.value = null
  try {
    const result = await searchGoogleBooks(query.value)
    if (requestId !== latestRequest) return
    candidates.value = result
    searched.value = true
  } catch (e) {
    if (requestId !== latestRequest) return
    candidates.value = []
    searched.value = false
    error.value = e instanceof Error ? e.message : '書誌情報を取得できませんでした。'
  } finally {
    if (requestId === latestRequest) loading.value = false
  }
}
</script>

<template>
  <section aria-labelledby="book-search-heading" class="mb-6 rounded-lg border border-stone-200 bg-white p-4">
    <h3 id="book-search-heading" class="text-sm font-semibold">ISBN・タイトルから探す</h3>
    <p class="mt-1 text-xs text-stone-500">見つかった本を選ぶと、下のフォームに自動で入力されます。</p>

    <form class="mt-3 flex gap-2" @submit.prevent="onSearch">
      <input
        v-model="query"
        type="search"
        placeholder="ISBN またはタイトル"
        aria-label="検索キーワード"
        class="min-w-0 flex-1 rounded border border-stone-300 bg-white px-3 py-2 text-sm"
      />
      <button
        type="submit"
        :disabled="loading || query.trim() === ''"
        class="shrink-0 rounded bg-stone-900 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-700 disabled:opacity-50"
      >
        {{ loading ? '検索中…' : '検索' }}
      </button>
    </form>

    <p v-if="error" role="alert" class="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
      {{ error }} 下のフォームから手入力でも登録できます。
    </p>

    <p v-else-if="searched && candidates.length === 0" class="mt-3 text-sm text-stone-600">
      見つかりませんでした。別のキーワードを試すか、下のフォームに手入力してください。
    </p>

    <ul v-else-if="candidates.length" class="mt-3 divide-y divide-stone-100" aria-label="検索結果">
      <li v-for="(c, i) in candidates" :key="`${c.isbn ?? ''}-${i}`">
        <button
          type="button"
          class="flex w-full gap-3 py-2 text-left hover:bg-stone-50"
          @click="emit('select', c)"
        >
          <img
            v-if="c.cover"
            :src="c.cover"
            alt=""
            class="h-16 w-11 shrink-0 rounded object-cover"
            loading="lazy"
          />
          <div v-else class="h-16 w-11 shrink-0 rounded bg-stone-100" aria-hidden="true" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold">{{ c.title }}</p>
            <p v-if="c.authors?.length" class="truncate text-xs text-stone-600">{{ c.authors.join('、') }}</p>
            <p class="text-xs text-stone-400">
              <span v-if="c.isbn">ISBN {{ c.isbn }}</span>
              <span v-if="c.pages"> ・ {{ c.pages }}ページ</span>
            </p>
          </div>
        </button>
      </li>
    </ul>
  </section>
</template>
