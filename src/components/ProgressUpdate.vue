<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  currentPage: number | null
  /** 総ページ数。分かっているときは、これを超える値を受け付けない */
  pages: number | null
  disabled?: boolean
}>()

const emit = defineEmits<{ update: [page: number] }>()

// number入力は未入力のとき '' になる
const value = ref<number | ''>(props.currentPage ?? '')
const error = ref<string | null>(null)

// 保存後など、外から現在のページが変わったら入力欄も合わせる
watch(
  () => props.currentPage,
  (page) => {
    value.value = page ?? ''
    error.value = null
  },
)

function onSubmit() {
  const page = value.value
  if (page === '' || !Number.isInteger(page) || page < 0) {
    error.value = '現在のページは0以上の整数で入力してください'
    return
  }
  if (props.pages && page > props.pages) {
    error.value = `総ページ数（${props.pages}）を超えています`
    return
  }
  error.value = null
  emit('update', page)
}
</script>

<template>
  <form novalidate class="flex flex-wrap items-center gap-2" @submit.prevent="onSubmit">
    <label class="flex items-center gap-2 text-sm">
      現在のページ
      <input
        v-model.number="value"
        type="number"
        min="0"
        step="1"
        :max="pages ?? undefined"
        :disabled="disabled"
        class="w-24 rounded border border-stone-300 bg-white px-2 py-1 text-sm"
      />
      <span v-if="pages" class="text-stone-500">/ {{ pages }}</span>
    </label>
    <button
      type="submit"
      :disabled="disabled"
      class="rounded border border-stone-300 bg-white px-3 py-1 text-sm hover:bg-stone-50 disabled:opacity-50"
    >
      更新
    </button>
    <p v-if="error" role="alert" class="w-full text-sm text-red-700">{{ error }}</p>
  </form>
</template>
