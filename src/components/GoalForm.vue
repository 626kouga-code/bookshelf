<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  title: string
  targetBooks: number | null
  /** undefined なら「1日あたりの目標ページ数」欄自体を出さない */
  targetDailyPages?: number | null
  /** 達成度の説明（例: "12 / 24冊（50%）"）。目標未設定なら親から渡さない */
  achievement?: string | null
  disabled?: boolean
}>()

const emit = defineEmits<{ save: [input: { target_books: number | null; target_daily_pages?: number | null }] }>()

const books = ref<number | ''>(props.targetBooks ?? '')
const dailyPages = ref<number | ''>(props.targetDailyPages ?? '')
const error = ref<string | null>(null)

watch(
  () => props.targetBooks,
  (v) => {
    books.value = v ?? ''
  },
)
watch(
  () => props.targetDailyPages,
  (v) => {
    dailyPages.value = v ?? ''
  },
)

function onSubmit() {
  if (books.value !== '' && (!Number.isInteger(books.value) || books.value < 1)) {
    error.value = '目標冊数は1以上の整数で入力してください'
    return
  }
  if (props.targetDailyPages !== undefined && dailyPages.value !== '' && (!Number.isInteger(dailyPages.value) || dailyPages.value < 1)) {
    error.value = '1日あたりの目標ページ数は1以上の整数で入力してください'
    return
  }
  error.value = null
  const input: { target_books: number | null; target_daily_pages?: number | null } = {
    target_books: books.value === '' ? null : books.value,
  }
  if (props.targetDailyPages !== undefined) {
    input.target_daily_pages = dailyPages.value === '' ? null : dailyPages.value
  }
  emit('save', input)
}
</script>

<template>
  <form novalidate class="space-y-2" @submit.prevent="onSubmit">
    <h4 class="text-sm font-semibold">{{ title }}</h4>
    <p v-if="achievement" class="text-sm text-stone-600">{{ achievement }}</p>

    <div class="flex flex-wrap items-end gap-3">
      <label class="flex flex-col text-sm">
        目標冊数
        <input
          v-model.number="books"
          type="number"
          min="1"
          step="1"
          :disabled="disabled"
          class="w-24 rounded border border-stone-300 bg-surface px-2 py-1 text-sm"
        />
      </label>
      <label v-if="targetDailyPages !== undefined" class="flex flex-col text-sm">
        1日あたりの目標ページ数
        <input
          v-model.number="dailyPages"
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
        保存
      </button>
    </div>
    <p v-if="error" role="alert" class="text-sm text-red-700">{{ error }}</p>
  </form>
</template>
