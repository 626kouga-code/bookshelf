<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { exportBackup, importBackup } from '@/api/backup'

const router = useRouter()

const exporting = ref(false)
const exportError = ref<string | null>(null)

const importing = ref(false)
const importError = ref<string | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

function todayForFilename(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
}

async function onExport() {
  if (exporting.value) return
  exporting.value = true
  exportError.value = null
  try {
    const data = await exportBackup()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `reading-app-backup-${todayForFilename()}.json`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    exportError.value = e instanceof Error ? e.message : 'エクスポートに失敗しました'
  } finally {
    exporting.value = false
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

    <section aria-label="エクスポート" class="mt-6">
      <h3 class="text-sm font-semibold">JSONエクスポート</h3>
      <p class="mt-1 text-sm text-stone-600">本・読書ログ・引用・読書目標をすべてJSONファイルとして書き出します。</p>
      <button
        type="button"
        :disabled="exporting"
        class="mt-2 rounded bg-stone-900 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-700 disabled:opacity-50"
        @click="onExport"
      >
        {{ exporting ? '書き出し中…' : 'エクスポート' }}
      </button>
      <p v-if="exportError" role="alert" class="mt-2 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        {{ exportError }}
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
