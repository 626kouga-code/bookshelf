<script setup lang="ts">
const MAX_RATING = 5

const props = defineProps<{
  /** 0（未評価）〜5 */
  modelValue: number
  disabled?: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

/** 現在の評価と同じ星を押したら未評価（0）に戻す */
function onSelect(value: number) {
  emit('update:modelValue', value === props.modelValue ? 0 : value)
}
</script>

<template>
  <div role="radiogroup" aria-label="評価" class="flex items-center gap-1">
    <button
      v-for="n in MAX_RATING"
      :key="n"
      type="button"
      role="radio"
      :aria-checked="modelValue === n"
      :aria-label="`${n}つ星`"
      :disabled="disabled"
      class="text-2xl leading-none disabled:opacity-50"
      :class="n <= modelValue ? 'text-amber-500' : 'text-stone-300 hover:text-amber-300'"
      @click="onSelect(n)"
    >
      {{ n <= modelValue ? '★' : '☆' }}
    </button>
    <span class="ml-2 text-xs text-stone-500">{{ modelValue > 0 ? `${modelValue} / ${MAX_RATING}` : '未評価' }}</span>
  </div>
</template>
