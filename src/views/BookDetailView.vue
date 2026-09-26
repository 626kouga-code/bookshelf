<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import BookForm from '@/components/BookForm.vue'
import ProgressUpdate from '@/components/ProgressUpdate.vue'
import QuoteSection from '@/components/QuoteSection.vue'
import RatingInput from '@/components/RatingInput.vue'
import ReadingLogSection from '@/components/ReadingLogSection.vue'
import ReviewEditor from '@/components/ReviewEditor.vue'
import {
  addLog,
  addQuote,
  deleteBook,
  deleteLog,
  deleteQuote,
  getBook,
  getPrediction,
  listLogs,
  listQuotes,
  updateBook,
  type Book,
  type BookInput,
  type Prediction,
  type Quote,
  type QuoteInput,
  type ReadingLog,
  type ReadingLogInput,
} from '@/api/books'
import { ApiRequestError } from '@/api/client'
import { useBooksStore, type BookFilters } from '@/stores/books'
import { formatDate, progressOf, seriesLabel, STATUS_CLASSES, STATUS_LABELS } from '@/utils/book'

const route = useRoute()
const router = useRouter()

const book = ref<Book | null>(null)
const loading = ref(true)
/** 取得の失敗。notFound のときは再読み込みではなく本棚への案内を出す */
const loadError = ref<{ message: string; notFound: boolean } | null>(null)

const editing = ref(false)
const saving = ref(false)
/** 詳細画面での部分更新（ページ・評価・感想・状態）の実行中 */
const updating = ref(false)
const deleting = ref(false)
/** 更新・削除の失敗（フォームや操作ボタンの近くに表示する） */
const actionError = ref<string | null>(null)

const bookId = computed(() => {
  const id = route.params.id
  return typeof id === 'string' && /^\d+$/.test(id) ? Number(id) : null
})

const progress = computed(() => (book.value ? progressOf(book.value) : null))
const series = computed(() => (book.value ? seriesLabel(book.value) : null))

const booksStore = useBooksStore()

/** タグ・シリーズの本を本棚で見る。状態・キーワードの絞り込みは外して、該当する本がすべて見えるようにする。 */
function showOnShelf(apply: (filters: BookFilters) => void) {
  const filters = booksStore.filters
  filters.status = ''
  filters.q = ''
  apply(filters)
  router.push('/')
}
const showTag = (tag: string) => showOnShelf((f) => (f.tag = tag))
const showSeries = (name: string) =>
  showOnShelf((f) => {
    f.series = name
    f.sort = 'series'
    f.order = 'asc'
  })

const logs = ref<ReadingLog[]>([])
const prediction = ref<Prediction | null>(null)
const logsLoading = ref(false)

/** 読書ログの一覧と、読書中のときの読了予測を読み込み直す。「読みたい」は対象外。 */
async function refreshLogs() {
  if (!book.value || book.value.status === 'want') {
    logs.value = []
    prediction.value = null
    return
  }
  const id = book.value.id
  logsLoading.value = true
  try {
    const [logList, pred] = await Promise.all([
      listLogs(id),
      book.value.status === 'reading' ? getPrediction(id) : Promise.resolve(null),
    ])
    logs.value = logList
    prediction.value = pred
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : '読書ログの取得に失敗しました'
  } finally {
    logsLoading.value = false
  }
}

const quotes = ref<Quote[]>([])
const quotesLoading = ref(false)

async function refreshQuotes() {
  if (!book.value) {
    quotes.value = []
    return
  }
  quotesLoading.value = true
  try {
    quotes.value = await listQuotes(book.value.id)
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : '引用の取得に失敗しました'
  } finally {
    quotesLoading.value = false
  }
}

// 連続して読み込んだとき、古いリクエストの結果で新しい結果を上書きしない
let latestRequest = 0

async function load() {
  const requestId = ++latestRequest
  editing.value = false
  actionError.value = null
  loadError.value = null
  book.value = null

  if (bookId.value === null) {
    loading.value = false
    loadError.value = { message: '本が見つかりません', notFound: true }
    return
  }

  loading.value = true
  try {
    const result = await getBook(bookId.value)
    if (requestId === latestRequest) {
      book.value = result
      await Promise.all([refreshLogs(), refreshQuotes()])
    }
  } catch (e) {
    if (requestId !== latestRequest) return
    loadError.value = {
      message: e instanceof Error ? e.message : '本の取得に失敗しました',
      notFound: e instanceof ApiRequestError && e.status === 404,
    }
  } finally {
    if (requestId === latestRequest) loading.value = false
  }
}

watch(bookId, load, { immediate: true })

function startEdit() {
  actionError.value = null
  editing.value = true
}

async function onSave(input: BookInput) {
  if (!book.value || saving.value) return
  saving.value = true
  actionError.value = null
  try {
    book.value = await updateBook(book.value.id, input)
    editing.value = false
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : '保存に失敗しました'
  } finally {
    saving.value = false
  }
}

/** 編集フォームを開かずに一部の項目だけを更新する。失敗しても画面の入力は残す。 */
async function patchBook(patch: Partial<BookInput>) {
  if (!book.value || updating.value || deleting.value) return
  updating.value = true
  actionError.value = null
  try {
    book.value = await updateBook(book.value.id, patch)
    await refreshLogs()
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : '更新に失敗しました'
  } finally {
    updating.value = false
  }
}

/** 読書ログを記録する。本の current_page はサーバー側で連動して更新される。 */
async function onAddLog(input: ReadingLogInput) {
  if (!book.value || updating.value || deleting.value) return
  updating.value = true
  actionError.value = null
  try {
    await addLog(book.value.id, input)
    book.value = await getBook(book.value.id)
    await refreshLogs()
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : '読書ログの記録に失敗しました'
  } finally {
    updating.value = false
  }
}

/** 読書ログを削除する。本の current_page はサーバー側で連動して更新される。 */
async function onDeleteLog(logId: number) {
  if (!book.value || updating.value || deleting.value) return
  updating.value = true
  actionError.value = null
  try {
    await deleteLog(book.value.id, logId)
    book.value = await getBook(book.value.id)
    await refreshLogs()
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : '読書ログの削除に失敗しました'
  } finally {
    updating.value = false
  }
}

/** 引用を追加する。 */
async function onAddQuote(input: QuoteInput) {
  if (!book.value || updating.value || deleting.value) return
  updating.value = true
  actionError.value = null
  try {
    await addQuote(book.value.id, input)
    await refreshQuotes()
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : '引用の追加に失敗しました'
  } finally {
    updating.value = false
  }
}

/** 引用を削除する。 */
async function onDeleteQuote(quoteId: number) {
  if (!book.value || updating.value || deleting.value) return
  updating.value = true
  actionError.value = null
  try {
    await deleteQuote(book.value.id, quoteId)
    await refreshQuotes()
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : '引用の削除に失敗しました'
  } finally {
    updating.value = false
  }
}

async function onDelete() {
  if (!book.value || deleting.value) return
  if (!window.confirm(`「${book.value.title}」を削除します。読書ログや引用も一緒に削除され、元に戻せません。よろしいですか？`)) {
    return
  }
  deleting.value = true
  actionError.value = null
  try {
    await deleteBook(book.value.id)
    await router.push('/')
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : '削除に失敗しました'
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <section class="mx-auto max-w-2xl">
    <RouterLink to="/" class="text-sm text-stone-500 hover:text-stone-900">← 本棚に戻る</RouterLink>

    <p v-if="loading" class="mt-6 text-stone-500">読み込み中…</p>

    <div v-else-if="loadError" role="alert" class="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
      {{ loadError.message }}
      <button v-if="!loadError.notFound" type="button" class="ml-2 underline" @click="load()">再読み込み</button>
    </div>

    <template v-else-if="book">
      <template v-if="editing">
        <h2 class="mb-4 mt-4 text-xl font-bold">本を編集</h2>
        <BookForm
          :initial="book"
          clear-empty
          submit-label="保存する"
          cancel-label="キャンセル"
          :submitting="saving"
          :error="actionError"
          @submit="onSave"
          @cancel="editing = false"
        />
      </template>

      <article v-else class="mt-4">
        <div class="flex gap-4">
          <img
            v-if="book.cover"
            :src="book.cover"
            :alt="`${book.title}の表紙`"
            class="h-40 w-28 shrink-0 rounded object-cover"
          />
          <div
            v-else
            class="flex h-40 w-28 shrink-0 items-center justify-center rounded bg-stone-100 text-xs text-stone-400"
            aria-hidden="true"
          >
            No image
          </div>

          <div class="min-w-0 flex-1">
            <div class="flex items-start gap-2">
              <h2 class="min-w-0 flex-1 break-words text-xl font-bold">{{ book.title }}</h2>
              <button
                type="button"
                :aria-pressed="book.favorite"
                :aria-label="book.favorite ? 'お気に入りから外す' : 'お気に入りに追加'"
                :title="book.favorite ? 'お気に入りから外す' : 'お気に入りに追加'"
                :disabled="updating || deleting"
                class="shrink-0 text-2xl leading-none disabled:opacity-50"
                :class="book.favorite ? 'text-amber-500' : 'text-stone-300 hover:text-amber-400'"
                @click="patchBook({ favorite: !book.favorite })"
              >
                {{ book.favorite ? '★' : '☆' }}
              </button>
            </div>
            <p v-if="book.authors.length" class="mt-1 text-stone-600">{{ book.authors.join('、') }}</p>
            <p v-if="series" class="mt-1 text-sm text-stone-600">
              シリーズ:
              <button type="button" class="underline hover:text-stone-900" @click="showSeries(book.series!)">
                {{ series }}
              </button>
            </p>
            <div v-if="book.tags.length" class="mt-2 flex flex-wrap gap-1 text-xs">
              <button
                v-for="tag in book.tags"
                :key="tag"
                type="button"
                class="rounded bg-stone-100 px-1.5 py-0.5 text-stone-600 hover:bg-stone-200"
                :title="`タグ「${tag}」の本を本棚で見る`"
                @click="showTag(tag)"
              >
                #{{ tag }}
              </button>
            </div>

            <div class="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span class="rounded-full px-2 py-0.5 text-xs" :class="STATUS_CLASSES[book.status]">
                {{ STATUS_LABELS[book.status] }}
              </span>
            </div>

            <div v-if="book.status === 'reading' && progress" class="mt-3">
              <div class="h-2 overflow-hidden rounded-full bg-stone-100">
                <div class="h-full bg-sky-500" :style="{ width: `${progress.percent}%` }" />
              </div>
              <p class="mt-1 text-xs text-stone-500">
                {{ progress.current }} / {{ progress.pages }} ページ（{{ progress.percent }}%）
              </p>
            </div>
          </div>
        </div>

        <section v-if="book.status !== 'done'" aria-label="進捗" class="mt-6 space-y-3">
          <ProgressUpdate
            v-if="book.status === 'reading'"
            :current-page="book.current_page"
            :pages="book.pages"
            :disabled="updating || deleting"
            @update="patchBook({ current_page: $event })"
          />
          <button
            v-if="book.status === 'reading'"
            type="button"
            :disabled="updating || deleting"
            class="rounded bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            @click="patchBook({ status: 'done' })"
          >
            読了にする
          </button>
          <button
            v-else
            type="button"
            :disabled="updating || deleting"
            class="rounded bg-sky-700 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-50"
            @click="patchBook({ status: 'reading' })"
          >
            読み始める
          </button>
        </section>

        <section v-if="book.status !== 'want'" aria-label="読書ログ" class="mt-6">
          <ReadingLogSection
            :logs="logs"
            :prediction="prediction"
            :read-only="book.status === 'done'"
            :disabled="updating || deleting"
            :loading="logsLoading"
            @add="onAddLog"
            @delete="onDeleteLog"
          />
        </section>

        <section aria-label="評価" class="mt-6">
          <h3 class="mb-1 text-sm font-semibold">評価</h3>
          <RatingInput
            :model-value="book.rating"
            :disabled="updating || deleting"
            @update:model-value="patchBook({ rating: $event })"
          />
        </section>

        <dl class="mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <template v-if="book.genre">
            <dt class="text-stone-500">ジャンル</dt>
            <dd>{{ book.genre }}</dd>
          </template>
          <template v-if="book.isbn">
            <dt class="text-stone-500">ISBN</dt>
            <dd>{{ book.isbn }}</dd>
          </template>
          <template v-if="book.pages">
            <dt class="text-stone-500">総ページ数</dt>
            <dd>{{ book.pages }}</dd>
          </template>
          <dt class="text-stone-500">登録日</dt>
          <dd>{{ formatDate(book.added_at) }}</dd>
          <template v-if="book.finished_at">
            <dt class="text-stone-500">読了日</dt>
            <dd>{{ formatDate(book.finished_at) }}</dd>
          </template>
        </dl>

        <section aria-label="感想" class="mt-6">
          <ReviewEditor
            :review="book.review"
            :disabled="updating || deleting"
            @save="patchBook({ review: $event })"
          />
        </section>

        <section aria-label="引用" class="mt-6">
          <QuoteSection
            :quotes="quotes"
            :disabled="updating || deleting"
            :loading="quotesLoading"
            @add="onAddQuote"
            @delete="onDeleteQuote"
          />
        </section>

        <p v-if="actionError" role="alert" class="mt-6 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {{ actionError }}
        </p>

        <div class="mt-8 flex gap-2">
          <button
            type="button"
            class="rounded bg-stone-900 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-700"
            @click="startEdit"
          >
            編集
          </button>
          <button
            type="button"
            :disabled="deleting"
            class="rounded border border-red-300 bg-white px-4 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
            @click="onDelete"
          >
            {{ deleting ? '削除中…' : '削除' }}
          </button>
        </div>
      </article>
    </template>
  </section>
</template>
