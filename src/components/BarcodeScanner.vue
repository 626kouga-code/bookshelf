<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { isbnFromBarcode } from '@/utils/barcode'

const emit = defineEmits<{
  /** ISBN を読み取ったとき（13桁の数字） */
  detected: [isbn: string]
  close: []
}>()

/** ブラウザ標準のバーコード検出（Android の Chrome など）。TypeScript の型定義に無いので必要な分だけ書く */
interface NativeBarcodeDetector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>
}
interface NativeBarcodeDetectorClass {
  new (options: { formats: string[] }): NativeBarcodeDetector
  getSupportedFormats(): Promise<string[]>
}

const SCAN_INTERVAL_MS = 250

const video = ref<HTMLVideoElement | null>(null)
const error = ref<string | null>(null)
const starting = ref(true)

let stream: MediaStream | null = null
let timer: ReturnType<typeof setInterval> | undefined
let zxingControls: { stop(): void } | null = null
let done = false

/** ISBN ではないバーコードを読み取ったとき（下段の価格コードなど）の案内 */
const ignoredMessage = ref<string | null>(null)

/** ISBN なら1回だけ通知する（ISBN でないバーコードは案内を出して読み取りを続ける） */
function onCode(code: string) {
  const isbn = isbnFromBarcode(code)
  if (done) return
  if (!isbn) {
    ignoredMessage.value = `ISBN ではないバーコード（${code}）を読み取りました。上段のバーコード（978…）を映してください。`
    return
  }
  done = true
  stop()
  emit('detected', isbn)
}

async function nativeDetector(): Promise<NativeBarcodeDetector | null> {
  const Detector = (window as unknown as { BarcodeDetector?: NativeBarcodeDetectorClass }).BarcodeDetector
  if (!Detector) return null
  try {
    const formats = await Detector.getSupportedFormats()
    return formats.includes('ean_13') ? new Detector({ formats: ['ean_13'] }) : null
  } catch {
    return null
  }
}

/** BarcodeDetector が使えない環境（iPhone の Safari など）は zxing で読み取る。大きいので必要なときだけ読み込む */
async function startZxing(el: HTMLVideoElement) {
  const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
    import('@zxing/browser'),
    import('@zxing/library'),
  ])
  const hints = new Map([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13]]])
  const reader = new BrowserMultiFormatReader(hints)
  const controls = await reader.decodeFromVideoElement(el, (result) => {
    if (result) onCode(result.getText())
  })
  // 読み込みの間に閉じられていたら、すぐ止める
  if (done) controls.stop()
  else zxingControls = controls
}

async function start() {
  try {
    // 解像度を指定しないと 640x480 程度になり、ピントが合う距離（iPhone では15〜20cm）まで離すと
    // バーコードの線が細すぎて読み取れない。高い解像度を求めて、離れていても線を太く映す
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    })
    if (done || !video.value) return stop()
    video.value.srcObject = stream
    await video.value.play()

    const detector = await nativeDetector()
    if (detector) {
      const el = video.value
      timer = setInterval(async () => {
        try {
          const codes = await detector.detect(el)
          codes.forEach((c) => onCode(c.rawValue))
        } catch {
          // 映像の準備中などで失敗することがあるが、次の回で読み直す
        }
      }, SCAN_INTERVAL_MS)
    } else {
      await startZxing(video.value)
    }
  } catch (e) {
    stop()
    const name = e instanceof DOMException ? e.name : ''
    error.value =
      name === 'NotAllowedError'
        ? 'カメラの使用が許可されていません。ブラウザの設定でカメラを許可してください。'
        : name === 'NotFoundError'
          ? 'カメラが見つかりません。'
          : 'カメラを起動できませんでした。'
  } finally {
    starting.value = false
  }
}

/** カメラと読み取りを止める（ダイアログを閉じたとき・読み取れたとき） */
function stop() {
  clearInterval(timer)
  timer = undefined
  zxingControls?.stop()
  zxingControls = null
  stream?.getTracks().forEach((t) => t.stop())
  stream = null
}

function close() {
  done = true
  stop()
  emit('close')
}

onMounted(start)
onBeforeUnmount(() => {
  done = true
  stop()
})
</script>

<template>
  <div
    role="dialog"
    aria-modal="true"
    aria-labelledby="barcode-scanner-title"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
    @keydown.esc="close"
  >
    <div class="w-full max-w-md rounded-lg bg-surface p-4">
      <h3 id="barcode-scanner-title" class="text-sm font-semibold">バーコードを読み取る</h3>
      <p class="mt-1 text-xs text-stone-500">
        裏表紙の上段のバーコード（978 で始まる番号）を枠に合わせてください。近すぎるとピントが合わないので、15〜20cmほど離すと読み取りやすくなります。
      </p>

      <div class="relative mt-3 overflow-hidden rounded bg-black">
        <video ref="video" class="aspect-[4/3] w-full object-cover" muted playsinline />
        <!-- 読み取り位置の目安 -->
        <div
          v-if="!error"
          class="pointer-events-none absolute inset-x-8 top-1/2 h-20 -translate-y-1/2 rounded border-2 border-sky-400"
          aria-hidden="true"
        />
        <p v-if="starting && !error" class="absolute inset-0 flex items-center justify-center text-sm text-white">
          カメラを起動しています…
        </p>
      </div>

      <p v-if="ignoredMessage && !error" role="status" class="mt-3 text-sm text-amber-700">{{ ignoredMessage }}</p>

      <p v-if="error" role="alert" class="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        {{ error }} ISBN は検索欄に手入力もできます。
      </p>

      <div class="mt-3 flex justify-end">
        <button
          type="button"
          class="rounded border border-stone-300 bg-surface px-4 py-2 text-sm hover:bg-stone-50"
          @click="close"
        >
          閉じる
        </button>
      </div>
    </div>
  </div>
</template>
