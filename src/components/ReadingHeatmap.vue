<script setup lang="ts">
import { computed } from 'vue'
import type { DailyPages } from '@/api/stats'

const props = defineProps<{
  days: DailyPages[]
  /** 基準日（テスト用）。省略時は今日。 */
  today?: Date
}>()

const WEEKS = 53
const CELL = 10
const STEP = 12
const LEFT = 20
const TOP = 14

/**
 * 色の濃さ（0: 記録なし、1〜4: 最大ページ数に対する割合で4段階）。クラス名はTailwindが拾えるよう文字列のまま書く。
 * ダークテーマでは、たくさん読んだ日ほど明るくする。
 */
const LEVEL_CLASSES = [
  'fill-stone-100',
  'fill-sky-200 dark:fill-sky-900',
  'fill-sky-400 dark:fill-sky-700',
  'fill-sky-600 dark:fill-sky-500',
  'fill-sky-800 dark:fill-sky-300',
]
const WEEKDAY_LABELS = [
  { row: 1, label: '月' },
  { row: 3, label: '水' },
  { row: 5, label: '金' },
]

/** ブラウザのタイムゾーンでの日付を YYYY-MM-DD にする（読書ログの日付と同じ形式）。 */
function toKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function levelOf(pages: number, max: number): number {
  if (pages <= 0) return 0
  return Math.min(4, Math.ceil((pages / max) * 4))
}

const pagesByDate = computed(() => new Map(props.days.map((d) => [d.date, d.pages])))
const max = computed(() => Math.max(1, ...props.days.map((d) => d.pages)))

/** 列＝週（日曜始まり）、行＝曜日。右端の列が今週で、今日より後の日は描かない。 */
const cells = computed(() => {
  const today = props.today ?? new Date()
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const start = new Date(end)
  start.setDate(start.getDate() - end.getDay() - (WEEKS - 1) * 7)

  const result: { key: string; col: number; row: number; date: Date; pages: number; level: number }[] = []
  for (let d = new Date(start), i = 0; d <= end; d.setDate(d.getDate() + 1), i++) {
    const key = toKey(d)
    const pages = pagesByDate.value.get(key) ?? 0
    result.push({ key, col: Math.floor(i / 7), row: i % 7, date: new Date(d), pages, level: levelOf(pages, max.value) })
  }
  return result
})

/** 月が変わった週の列の上に「◯月」を出す。左端のラベルが次とくっつく場合は省く。 */
const monthLabels = computed(() => {
  const labels: { col: number; label: string }[] = []
  let prevMonth = -1
  for (const cell of cells.value) {
    if (cell.row !== 0) continue
    const month = cell.date.getMonth()
    if (month !== prevMonth) labels.push({ col: cell.col, label: `${month + 1}月` })
    prevMonth = month
  }
  if (labels.length > 1 && labels[1]!.col - labels[0]!.col < 3) labels.shift()
  return labels
})

const readDays = computed(() => cells.value.filter((c) => c.pages > 0).length)
const totalPages = computed(() => cells.value.reduce((sum, c) => sum + c.pages, 0))

const width = LEFT + WEEKS * STEP
const height = TOP + 7 * STEP

function tooltip(cell: { date: Date; pages: number }): string {
  const date = `${cell.date.getFullYear()}/${cell.date.getMonth() + 1}/${cell.date.getDate()}`
  return cell.pages > 0 ? `${date}: ${cell.pages}ページ` : `${date}: 記録なし`
}
</script>

<template>
  <div>
    <p class="mb-2 text-xs text-stone-500">
      直近1年で {{ readDays }}日・{{ totalPages.toLocaleString() }}ページ読書
    </p>
    <svg
      :viewBox="`0 0 ${width} ${height}`"
      class="w-full text-stone-500"
      role="img"
      :aria-label="`読書ヒートマップ（直近1年で${readDays}日読書）`"
    >
      <text
        v-for="m in monthLabels"
        :key="`m-${m.col}`"
        :x="LEFT + m.col * STEP"
        y="9"
        font-size="8"
        fill="currentColor"
      >
        {{ m.label }}
      </text>
      <text
        v-for="w in WEEKDAY_LABELS"
        :key="`w-${w.row}`"
        x="0"
        :y="TOP + w.row * STEP + 8"
        font-size="8"
        fill="currentColor"
      >
        {{ w.label }}
      </text>
      <rect
        v-for="cell in cells"
        :key="cell.key"
        :x="LEFT + cell.col * STEP"
        :y="TOP + cell.row * STEP"
        :width="CELL"
        :height="CELL"
        rx="2"
        :class="LEVEL_CLASSES[cell.level]"
        :data-date="cell.key"
        :data-level="cell.level"
      >
        <title>{{ tooltip(cell) }}</title>
      </rect>
    </svg>
    <div class="mt-1 flex items-center justify-end gap-1 text-xs text-stone-500" aria-hidden="true">
      少
      <svg v-for="(cls, i) in LEVEL_CLASSES" :key="i" viewBox="0 0 10 10" class="h-2.5 w-2.5">
        <rect width="10" height="10" rx="2" :class="cls" />
      </svg>
      多
    </div>
  </div>
</template>
