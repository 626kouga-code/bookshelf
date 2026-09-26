<script setup lang="ts">
import { ref } from 'vue'
import type { Prediction, ReadingLog, ReadingLogInput } from '@/api/books'

defineProps<{
  logs: ReadingLog[]
  prediction: Prediction | null
  /** 読了済みなど、記録・削除・予測を出さず履歴だけ表示する */
  readOnly?: boolean
  disabled?: boolean
  loading?: boolean
}>()

const emit = defineEmits<{ add: [input: ReadingLogInput]; delete: [logId: number] }>()

/** 日付入力の既定値（ブラウザのタイムゾーンでの今日）。 */
function today(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const date = ref(today())
const pages = ref<number | ''>('')
const error = ref<string | null>(null)

function onSubmit() {
  if (!date.value) {
    error.value = '日付を入力してください'
    return
  }
  const p = pages.value
  if (p === '' || !Number.isInteger(p) || p < 1) {
    error.value = 'ページ数は1以上の整数で入力してください'
    return
  }
  error.value = null
  emit('add', { date: date.value, pages: p })
  pages.value = ''
}
</script>

<template>
  <div>
    <h3 class="mb-2 text-sm font-semibold">読書ログ</h3>

    <form v-if="!readOnly" novalidate class="flex flex-wrap items-end gap-2" @submit.prevent="onSubmit">
      <label class="flex flex-col text-sm">
        日付
        <input
          v-model="date"
          type="date"
          :disabled="disabled"
          class="rounded border border-stone-300 bg-surface px-2 py-1 text-sm"
        />
      </label>
      <label class="flex flex-col text-sm">
        読んだページ数
        <input
          v-model.number="pages"
          type="number"
          min="1"
          step="1"
          :disabled="disabled"
          class="w-24 rounded border border-stone-300 bg-surface px-2 py-1 text-sm"
        />
      </label>
      <button
        type="submit"
        :disabled="disabled"
        class="rounded border border-stone-300 bg-surface px-3 py-1 text-sm hover:bg-stone-50 disabled:opacity-50"
      >
        記録する
      </button>
    </form>
    <p v-if="error" role="alert" class="mt-2 text-sm text-red-700">{{ error }}</p>

    <p v-if="!readOnly && prediction" class="mt-3 text-sm text-stone-600">
      <template v-if="prediction.available">
        このペースなら、あと約{{ prediction.estimatedDays }}日で読み終わりそうです（1日あたり{{
          Math.round((prediction.pagesPerDay ?? 0) * 10) / 10
        }}ページ）
      </template>
      <template v-else>{{ prediction.reason }}</template>
    </p>

    <p v-if="loading" class="mt-3 text-sm text-stone-500">読み込み中…</p>
    <ul v-else-if="logs.length" class="mt-3 divide-y divide-stone-100 text-sm">
      <li v-for="log in logs" :key="log.id" class="flex items-center justify-between py-1.5">
        <span>{{ log.date }}（{{ log.pages }}ページ）</span>
        <button
          v-if="!readOnly"
          type="button"
          :disabled="disabled"
          class="text-xs text-red-700 hover:underline disabled:opacity-50"
          @click="emit('delete', log.id)"
        >
          削除
        </button>
      </li>
    </ul>
    <p v-else class="mt-3 text-sm text-stone-500">まだ記録がありません</p>
  </div>
</template>
