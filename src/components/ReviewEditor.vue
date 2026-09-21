<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  review: string | null
  disabled?: boolean
}>()

const emit = defineEmits<{ save: [review: string | null] }>()

const text = ref(props.review ?? '')

// 保存後など、外から感想が変わったら入力欄も合わせる
watch(
  () => props.review,
  (review) => {
    text.value = review ?? ''
  },
)

/** 保存済みの内容から変わっているか。前後の空白だけの違いは変更とみなさない */
const dirty = computed(() => text.value.trim() !== (props.review ?? '').trim())

function onSave() {
  const trimmed = text.value.trim()
  // 空にして保存すると感想を消す
  emit('save', trimmed === '' ? null : trimmed)
}
</script>

<template>
  <form class="space-y-2" @submit.prevent="onSave">
    <label class="block text-sm font-semibold" for="review-text">感想</label>
    <textarea
      id="review-text"
      v-model="text"
      rows="4"
      placeholder="読んだ感想や気づきをメモ"
      :disabled="disabled"
      class="w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm"
    />
    <button
      type="submit"
      :disabled="disabled || !dirty"
      class="rounded border border-stone-300 bg-white px-3 py-1 text-sm hover:bg-stone-50 disabled:opacity-50"
    >
      感想を保存
    </button>
  </form>
</template>
