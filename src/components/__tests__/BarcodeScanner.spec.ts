import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import BarcodeScanner from '../BarcodeScanner.vue'

// BarcodeDetector が無い環境で使う zxing をモックする
const zxing = vi.hoisted(() => ({
  controls: { stop: vi.fn() },
  /** decodeFromVideoElement に渡されたコールバック（テストから読み取り結果を送る） */
  callback: null as ((result: { getText(): string } | undefined) => void) | null,
}))
vi.mock('@zxing/browser', () => ({
  BrowserMultiFormatReader: class {
    async decodeFromVideoElement(_: HTMLVideoElement, cb: (result: { getText(): string } | undefined) => void) {
      zxing.callback = cb
      return zxing.controls
    }
  },
}))
vi.mock('@zxing/library', () => ({
  BarcodeFormat: { EAN_13: 'EAN_13' },
  DecodeHintType: { POSSIBLE_FORMATS: 'POSSIBLE_FORMATS' },
}))

const track = { stop: vi.fn() }
const stream = { getTracks: () => [track] } as unknown as MediaStream

function stubCamera(getUserMedia: () => Promise<MediaStream> = async () => stream) {
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: vi.fn(getUserMedia) }, configurable: true })
}

/** ブラウザ標準の BarcodeDetector のモック。detect は呼ばれるたびに results を1つずつ返す */
function stubNativeDetector(results: string[][]) {
  const detect = vi.fn(async () => (results.shift() ?? []).map((rawValue) => ({ rawValue })))
  vi.stubGlobal(
    'BarcodeDetector',
    class {
      static getSupportedFormats = async () => ['ean_13', 'qr_code']
      detect = detect
    },
  )
  return detect
}

describe('BarcodeScanner', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    track.stop.mockClear()
    zxing.controls.stop.mockClear()
    zxing.callback = null
    // jsdom は動画を再生できないので、play は何もしない
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('背面カメラを起動する', async () => {
    stubCamera()
    stubNativeDetector([])
    mount(BarcodeScanner)
    await flushPromises()
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    })
  })

  it('BarcodeDetector で ISBN を読み取ったら通知し、カメラを止める（価格コードは無視する）', async () => {
    stubCamera()
    stubNativeDetector([[], ['1920055008007'], ['1920055008007', '9784873115658']])
    const wrapper = mount(BarcodeScanner)
    await flushPromises()

    await vi.advanceTimersByTimeAsync(250 * 2)
    expect(wrapper.emitted('detected')).toBeUndefined()

    await vi.advanceTimersByTimeAsync(250)
    expect(wrapper.emitted('detected')).toEqual([['9784873115658']])
    expect(track.stop).toHaveBeenCalled()
  })

  it('一度読み取ったら、その後に検出しても通知しない', async () => {
    stubCamera()
    const detect = stubNativeDetector([['9784873115658'], ['9780306406157']])
    const wrapper = mount(BarcodeScanner)
    await flushPromises()
    await vi.advanceTimersByTimeAsync(250 * 3)
    expect(wrapper.emitted('detected')).toEqual([['9784873115658']])
    expect(detect).toHaveBeenCalledTimes(1)
  })

  it('BarcodeDetector が無い環境では zxing で読み取る', async () => {
    stubCamera()
    const wrapper = mount(BarcodeScanner)
    // zxing は動的に読み込むので、読み取りが始まるまで待つ
    await vi.waitFor(() => expect(zxing.callback).not.toBeNull())

    zxing.callback!({ getText: () => '1920055008007' })
    expect(wrapper.emitted('detected')).toBeUndefined()
    zxing.callback!({ getText: () => '9784873115658' })
    expect(wrapper.emitted('detected')).toEqual([['9784873115658']])
    expect(zxing.controls.stop).toHaveBeenCalled()
    expect(track.stop).toHaveBeenCalled()
  })

  it('「閉じる」で close を通知し、カメラを止める', async () => {
    stubCamera()
    stubNativeDetector([])
    const wrapper = mount(BarcodeScanner)
    await flushPromises()
    await wrapper.findAll('button').find((b) => b.text() === '閉じる')!.trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(track.stop).toHaveBeenCalled()
  })

  it('画面から消えたらカメラを止める', async () => {
    stubCamera()
    stubNativeDetector([])
    const wrapper = mount(BarcodeScanner)
    await flushPromises()
    wrapper.unmount()
    expect(track.stop).toHaveBeenCalled()
  })

  it.each([
    ['NotAllowedError', 'カメラの使用が許可されていません'],
    ['NotFoundError', 'カメラが見つかりません'],
    ['AbortError', 'カメラを起動できませんでした'],
  ])('カメラを起動できない（%s）ときはエラーを表示する', async (name, message) => {
    stubCamera(async () => {
      throw new DOMException('error', name)
    })
    const wrapper = mount(BarcodeScanner)
    await flushPromises()
    expect(wrapper.find('[role="alert"]').text()).toContain(message)
  })
})
