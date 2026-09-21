<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { BookInput, BookStatus } from '@/api/books'

const props = defineProps<{
  submitting?: boolean
  /** サーバーから返ったエラー（ISBN重複など） */
  error?: string | null
  submitLabel?: string
  /** 書誌情報の自動入力。渡し直すたびに、書誌に関する項目を置き換える（状態・現在のページは変えない） */
  prefill?: Pick<BookInput, 'title' | 'authors' | 'isbn' | 'pages' | 'genre' | 'cover'> | null
}>()

const emit = defineEmits<{ submit: [input: BookInput] }>()

const STATUS_OPTIONS: { value: BookStatus; label: string }[] = [
  { value: 'want', label: '読みたい' },
  { value: 'reading', label: '読書中' },
  { value: 'done', label: '読了' },
]

// number入力は未入力のとき '' になるため、型に含めておく
const form = reactive({
  title: '',
  authors: '',
  isbn: '',
  pages: '' as number | '',
  cover: '',
  genre: '',
  status: 'want' as BookStatus,
  currentPage: '' as number | '',
})

const validationError = ref<string | null>(null)

// 候補が無い項目は空にして、前に選んだ候補の値が残らないようにする
watch(
  () => props.prefill,
  (p) => {
    if (!p) return
    form.title = p.title
    form.authors = (p.authors ?? []).join('、')
    form.isbn = p.isbn ?? ''
    form.pages = p.pages ?? ''
    form.genre = p.genre ?? ''
    form.cover = p.cover ?? ''
    validationError.value = null
  },
)

const isPositiveInt = (v: number | '', min: number) => v === '' || (Number.isInteger(v) && v >= min)

const authorList = computed(() =>
  form.authors
    .split(/[,、，]/)
    .map((a) => a.trim())
    .filter((a) => a !== ''),
)

function onSubmit() {
  if (form.title.trim() === '') {
    validationError.value = 'タイトルを入力してください'
    return
  }
  if (!isPositiveInt(form.pages, 1)) {
    validationError.value = '総ページ数は1以上の整数で入力してください'
    return
  }
  if (form.status === 'reading' && !isPositiveInt(form.currentPage, 0)) {
    validationError.value = '現在のページは0以上の整数で入力してください'
    return
  }
  validationError.value = null

  const input: BookInput = { title: form.title.trim(), status: form.status }
  if (authorList.value.length) input.authors = authorList.value
  if (form.isbn.trim()) input.isbn = form.isbn.trim()
  if (form.pages !== '') input.pages = form.pages
  if (form.cover.trim()) input.cover = form.cover.trim()
  if (form.genre.trim()) input.genre = form.genre.trim()
  if (form.status === 'reading' && form.currentPage !== '') input.current_page = form.currentPage
  emit('submit', input)
}

const inputClass = 'mt-1 w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm'
</script>

<template>
  <form class="space-y-4" novalidate @submit.prevent="onSubmit">
    <p
      v-if="validationError || error"
      role="alert"
      class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700"
    >
      {{ validationError ?? error }}
    </p>

    <label class="block text-sm font-medium">
      タイトル <span class="text-red-600" aria-hidden="true">*</span>
      <input v-model="form.title" type="text" required aria-required="true" :class="inputClass" />
    </label>

    <label class="block text-sm font-medium">
      著者
      <input
        v-model="form.authors"
        type="text"
        placeholder="複数の場合は「、」か「,」で区切る"
        :class="inputClass"
      />
    </label>

    <label class="block text-sm font-medium">
      ISBN
      <input
        v-model="form.isbn"
        type="text"
        inputmode="numeric"
        placeholder="10桁または13桁（ハイフン可）"
        :class="inputClass"
      />
    </label>

    <div class="grid gap-4 sm:grid-cols-2">
      <label class="block text-sm font-medium">
        総ページ数
        <input v-model.number="form.pages" type="number" min="1" step="1" :class="inputClass" />
      </label>
      <label class="block text-sm font-medium">
        ジャンル
        <input v-model="form.genre" type="text" :class="inputClass" />
      </label>
    </div>

    <label class="block text-sm font-medium">
      表紙画像のURL
      <input v-model="form.cover" type="url" :class="inputClass" />
    </label>

    <div class="grid gap-4 sm:grid-cols-2">
      <label class="block text-sm font-medium">
        状態
        <select v-model="form.status" :class="inputClass">
          <option v-for="o in STATUS_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </label>
      <label v-if="form.status === 'reading'" class="block text-sm font-medium">
        現在のページ
        <input
          v-model.number="form.currentPage"
          type="number"
          min="0"
          step="1"
          :class="inputClass"
        />
      </label>
    </div>

    <button
      type="submit"
      :disabled="submitting"
      class="w-full rounded bg-stone-900 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-700 disabled:opacity-50 sm:w-auto"
    >
      {{ submitting ? '送信中…' : (submitLabel ?? '登録する') }}
    </button>
  </form>
</template>
