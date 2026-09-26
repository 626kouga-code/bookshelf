<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import BarChart from '@/components/BarChart.vue'
import GoalForm from '@/components/GoalForm.vue'
import ReadingHeatmap from '@/components/ReadingHeatmap.vue'
import { getGoal, getStats, updateGoal, type Goal, type Stats } from '@/api/stats'

const now = new Date()
const currentYear = String(now.getFullYear())
const currentMonth = `${currentYear}-${String(now.getMonth() + 1).padStart(2, '0')}`

const stats = ref<Stats | null>(null)
const yearGoal = ref<Goal | null>(null)
const monthGoal = ref<Goal | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

const yearSaving = ref(false)
const monthSaving = ref(false)
const goalError = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    const [s, y, m] = await Promise.all([getStats(), getGoal('year', currentYear), getGoal('month', currentMonth)])
    stats.value = s
    yearGoal.value = y
    monthGoal.value = m
  } catch (e) {
    error.value = e instanceof Error ? e.message : '統計の取得に失敗しました'
  } finally {
    loading.value = false
  }
}

onMounted(load)

const monthlyChartItems = computed(() => {
  if (!stats.value) return []
  return stats.value.monthly_finished.map((m) => ({ label: `${Number(m.month.slice(5, 7))}月`, value: m.count }))
})

const genreChartItems = computed(() => {
  if (!stats.value) return []
  return stats.value.genre_counts.map((g) => ({ label: g.genre ?? '未設定', value: g.count }))
})

/** 当年に読了した冊数。monthly_finished（直近12ヶ月）のうち当年分を合計する。 */
const yearFinishedCount = computed(() =>
  stats.value ? stats.value.monthly_finished.filter((m) => m.month.startsWith(currentYear)).reduce((sum, m) => sum + m.count, 0) : 0,
)

const monthFinishedCount = computed(
  () => stats.value?.monthly_finished.find((m) => m.month === currentMonth)?.count ?? 0,
)

function achievementText(count: number, target: number | null): string | null {
  if (target === null) return null
  const percent = Math.min(100, Math.round((count / target) * 100))
  return `${count} / ${target}冊（${percent}%）`
}

const yearAchievement = computed(() => achievementText(yearFinishedCount.value, yearGoal.value?.target_books ?? null))
const monthAchievement = computed(() =>
  achievementText(monthFinishedCount.value, monthGoal.value?.target_books ?? null),
)

async function onSaveYearGoal(input: { target_books: number | null }) {
  if (yearSaving.value) return
  yearSaving.value = true
  goalError.value = null
  try {
    yearGoal.value = await updateGoal('year', currentYear, input)
  } catch (e) {
    goalError.value = e instanceof Error ? e.message : '年間目標の保存に失敗しました'
  } finally {
    yearSaving.value = false
  }
}

async function onSaveMonthGoal(input: { target_books: number | null; target_daily_pages?: number | null }) {
  if (monthSaving.value) return
  monthSaving.value = true
  goalError.value = null
  try {
    monthGoal.value = await updateGoal('month', currentMonth, input)
  } catch (e) {
    goalError.value = e instanceof Error ? e.message : '月間目標の保存に失敗しました'
  } finally {
    monthSaving.value = false
  }
}
</script>

<template>
  <section class="mx-auto max-w-2xl">
    <h2 class="text-xl font-bold">統計・目標</h2>

    <p v-if="loading" class="mt-6 text-stone-500">読み込み中…</p>

    <div v-else-if="error" role="alert" class="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
      {{ error }}
      <button type="button" class="ml-2 underline" @click="load()">再読み込み</button>
    </div>

    <template v-else-if="stats">
      <section aria-label="読書ヒートマップ" class="mt-6">
        <h3 class="mb-2 text-sm font-semibold">読書ヒートマップ</h3>
        <ReadingHeatmap :days="stats.daily_pages" />
      </section>

      <section aria-label="月別読了数" class="mt-6">
        <h3 class="mb-2 text-sm font-semibold">月別読了数（直近12ヶ月）</h3>
        <BarChart :items="monthlyChartItems" unit="冊" />
      </section>

      <section aria-label="ジャンル別冊数" class="mt-6">
        <h3 class="mb-2 text-sm font-semibold">ジャンル別冊数</h3>
        <BarChart :items="genreChartItems" unit="冊" />
      </section>

      <dl class="mt-6 grid grid-cols-2 gap-4 text-center">
        <div class="rounded border border-stone-200 p-3">
          <dt class="text-xs text-stone-500">累計読書ページ数</dt>
          <dd class="mt-1 text-2xl font-bold">{{ stats.total_pages_read.toLocaleString() }}</dd>
        </div>
        <div class="rounded border border-stone-200 p-3">
          <dt class="text-xs text-stone-500">連続読書日数</dt>
          <dd class="mt-1 text-2xl font-bold">{{ stats.current_streak_days }}日</dd>
        </div>
      </dl>

      <section aria-label="読書目標" class="mt-6 space-y-4">
        <h3 class="text-sm font-semibold">読書目標</h3>
        <GoalForm
          title="年間目標"
          :target-books="yearGoal?.target_books ?? null"
          :achievement="yearAchievement"
          :disabled="yearSaving"
          @save="onSaveYearGoal"
        />
        <GoalForm
          title="月間目標"
          :target-books="monthGoal?.target_books ?? null"
          :target-daily-pages="monthGoal?.target_daily_pages ?? null"
          :achievement="monthAchievement"
          :disabled="monthSaving"
          @save="onSaveMonthGoal"
        />
        <p v-if="goalError" role="alert" class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {{ goalError }}
        </p>
      </section>
    </template>
  </section>
</template>
