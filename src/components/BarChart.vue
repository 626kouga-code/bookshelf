<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  items: { label: string; value: number }[]
  /** 値の後ろに付ける単位（例: 冊、ページ） */
  unit?: string
}>()

const ROW_HEIGHT = 8

const max = computed(() => Math.max(1, ...props.items.map((i) => i.value)))

function barWidth(value: number): number {
  // 見出し・数値の表示分を確保して、バー自体は最大70まで
  return Math.round((value / max.value) * 70)
}
</script>

<template>
  <svg
    v-if="items.length"
    :viewBox="`0 0 100 ${items.length * ROW_HEIGHT}`"
    :style="{ height: `${items.length * 24}px` }"
    class="w-full text-stone-700"
    role="img"
    aria-hidden="true"
  >
    <g v-for="(item, i) in items" :key="item.label">
      <text x="0" :y="i * ROW_HEIGHT + 3" font-size="3" fill="currentColor">{{ item.label }}</text>
      <rect x="0" :y="i * ROW_HEIGHT + 4.5" :width="barWidth(item.value)" height="3" class="fill-sky-500" />
      <text :x="barWidth(item.value) + 2" :y="i * ROW_HEIGHT + 7" font-size="2.5" fill="currentColor">
        {{ item.value }}{{ unit }}
      </text>
    </g>
  </svg>
  <p v-else class="text-sm text-stone-500">データがありません</p>
</template>
