<script setup lang="ts">
import { ref } from 'vue'
import type { Quote, QuoteInput } from '@/api/books'

defineProps<{
  quotes: Quote[]
  disabled?: boolean
  loading?: boolean
}>()

const emit = defineEmits<{ add: [input: QuoteInput]; delete: [quoteId: number] }>()

const text = ref('')
const page = ref<number | ''>('')
const error = ref<string | null>(null)

function onSubmit() {
  const trimmed = text.value.trim()
  if (trimmed === '') {
    error.value = '引用の文章を入力してください'
    return
  }
  const p = page.value
  if (p !== '' && (!Number.isInteger(p) || p < 1)) {
    error.value = 'ページ番号は1以上の整数で入力してください'
    return
  }
  error.value = null
  emit('add', { text: trimmed, page: p === '' ? null : p })
  text.value = ''
  page.value = ''
}
</script>

<template>
  <div>
    <h3 class="mb-2 text-sm font-semibold">引用</h3>

    <form novalidate class="space-y-2" @submit.prevent="onSubmit">
      <textarea
        v-model="text"
        rows="3"
        placeholder="心に残った一節をメモ"
        :disabled="disabled"
        class="w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm"
      />
      <div class="flex flex-wrap items-center gap-2">
        <label class="flex items-center gap-2 text-sm">
          ページ
          <input
            v-model.number="page"
            type="number"
            min="1"
            step="1"
            :disabled="disabled"
            class="w-20 rounded border border-stone-300 bg-white px-2 py-1 text-sm"
          />
        </label>
        <button
          type="submit"
          :disabled="disabled"
          class="rounded border border-stone-300 bg-white px-3 py-1 text-sm hover:bg-stone-50 disabled:opacity-50"
        >
          引用を追加
        </button>
      </div>
    </form>
    <p v-if="error" role="alert" class="mt-2 text-sm text-red-700">{{ error }}</p>

    <p v-if="loading" class="mt-3 text-sm text-stone-500">読み込み中…</p>
    <ul v-else-if="quotes.length" class="mt-3 space-y-2">
      <li v-for="quote in quotes" :key="quote.id" class="flex items-start justify-between gap-2 rounded border border-stone-200 p-2 text-sm">
        <div class="min-w-0">
          <p class="whitespace-pre-wrap break-words">{{ quote.text }}</p>
          <p v-if="quote.page" class="mt-1 text-xs text-stone-500">p.{{ quote.page }}</p>
        </div>
        <button
          type="button"
          :disabled="disabled"
          class="shrink-0 text-xs text-red-700 hover:underline disabled:opacity-50"
          @click="emit('delete', quote.id)"
        >
          削除
        </button>
      </li>
    </ul>
    <p v-else class="mt-3 text-sm text-stone-500">まだ引用がありません</p>
  </div>
</template>
