<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { exportBackup, importBackup } from '@/api/backup'
import { listBooks } from '@/api/books'
import { booksToCsv } from '@/utils/csv'
import { applyTheme, loadThemeSetting, saveThemeSetting, THEME_OPTIONS } from '@/utils/theme'

const router = useRouter()

const themeSetting = ref(loadThemeSetting())
watch(themeSetting, (setting) => {
  saveThemeSetting(setting)
  applyTheme(setting)
})

const exporting = ref(false)
const exportError = ref<string | null>(null)

const csvExporting = ref(false)
const csvExportError = ref<string | null>(null)

const importing = ref(false)
const importError = ref<string | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

function todayForFilename(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
}

/** ブラウザにファイルとしてダウンロードさせる。 */
function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

async function onExport() {
  if (exporting.value) return
  exporting.value = true
  exportError.value = null
  try {
    const data = await exportBackup()
    download(
      new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
      `reading-app-backup-${todayForFilename()}.json`,
    )
  } catch (e) {
    exportError.value = e instanceof Error ? e.message : 'エクスポートに失敗しました'
  } finally {
    exporting.value = false
  }
}

/** 本の一覧を、登録の古い順にCSVで書き出す。 */
async function onExportCsv() {
  if (csvExporting.value) return
  csvExporting.value = true
  csvExportError.value = null
  try {
    const books = await listBooks({ sort: 'added_at', order: 'asc' })
    download(new Blob([booksToCsv(books)], { type: 'text/csv' }), `reading-app-books-${todayForFilename()}.csv`)
  } catch (e) {
    csvExportError.value = e instanceof Error ? e.message : 'CSVエクスポートに失敗しました'
  } finally {
    csvExporting.value = false
  }
}

async function onImportFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const confirmed = window.confirm(
    '現在のデータはすべて削除され、選択したファイルの内容に置き換わります。よろしいですか？',
  )
  if (!confirmed) {
    input.value = ''
    return
  }

  importing.value = true
  importError.value = null
  try {
    let data: unknown
    try {
      data = JSON.parse(await file.text())
    } catch {
      throw new Error('JSONとして読み込めませんでした')
    }
    await importBackup(data)
    await router.push('/')
  } catch (e) {
    importError.value = e instanceof Error ? e.message : 'インポートに失敗しました'
  } finally {
    importing.value = false
    input.value = ''
  }
}
</script>

<template>
  <section class="mx-auto max-w-2xl">
    <h2 class="text-xl font-bold">設定</h2>

    <fieldset class="mt-6">
      <legend class="text-sm font-semibold">テーマ</legend>
      <div class="mt-2 flex flex-wrap gap-2">
        <label
          v-for="option in THEME_OPTIONS"
          :key="option.value"
          class="flex cursor-pointer items-center gap-2 rounded border px-3 py-2 text-sm"
          :class="
            themeSetting === option.value
              ? 'border-stone-900 font-semibold'
              : 'border-stone-300 bg-surface text-stone-600 hover:bg-stone-50'
          "
        >
          <input v-model="themeSetting" type="radio" name="theme" :value="option.value" class="accent-stone-900" />
          {{ option.label }}
        </label>
      </div>
      <p class="mt-1 text-xs text-stone-500">このブラウザに保存されます。</p>
    </fieldset>

    <section aria-label="エクスポート" class="mt-6">
      <h3 class="text-sm font-semibold">JSONエクスポート</h3>
      <p class="mt-1 text-sm text-stone-600">本・読書ログ・引用・読書目標をすべてJSONファイルとして書き出します。</p>
      <button
        type="button"
        :disabled="exporting"
        class="mt-2 rounded bg-stone-900 px-4 py-2 text-sm font-semibold text-stone-50 hover:bg-stone-700 disabled:opacity-50"
        @click="onExport"
      >
        {{ exporting ? '書き出し中…' : 'エクスポート' }}
      </button>
      <p v-if="exportError" role="alert" class="mt-2 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        {{ exportError }}
      </p>
    </section>

    <section aria-label="CSVエクスポート" class="mt-8">
      <h3 class="text-sm font-semibold">CSVエクスポート（本の一覧）</h3>
      <p class="mt-1 text-sm text-stone-600">
        本の一覧をCSVファイルとして書き出します。Excelやスプレッドシートで開けます（復元には使えません）。
      </p>
      <button
        type="button"
        :disabled="csvExporting"
        class="mt-2 rounded border border-stone-300 bg-surface px-4 py-2 text-sm hover:bg-stone-50 disabled:opacity-50"
        @click="onExportCsv"
      >
        {{ csvExporting ? '書き出し中…' : 'CSVエクスポート' }}
      </button>
      <p v-if="csvExportError" role="alert" class="mt-2 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        {{ csvExportError }}
      </p>
    </section>

    <section aria-label="インポート" class="mt-8">
      <h3 class="text-sm font-semibold">JSONインポート</h3>
      <p class="mt-1 text-sm text-stone-600">
        エクスポートしたJSONファイルから復元します。<strong class="text-red-700">現在のデータはすべて置き換わります。</strong>
      </p>
      <input
        ref="fileInput"
        type="file"
        accept="application/json"
        :disabled="importing"
        class="mt-2 block text-sm"
        @change="onImportFileChange"
      />
      <p v-if="importing" class="mt-2 text-sm text-stone-500">復元中…</p>
      <p v-if="importError" role="alert" class="mt-2 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        {{ importError }}
      </p>
    </section>
  </section>
</template>
