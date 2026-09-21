import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ReviewEditor from '../ReviewEditor.vue'

type Props = { review: string | null; disabled?: boolean }

const mountEditor = (props: Props) => mount(ReviewEditor, { props })

const textarea = (wrapper: ReturnType<typeof mountEditor>) => wrapper.find('textarea')
const saveButton = (wrapper: ReturnType<typeof mountEditor>) => wrapper.find('button[type="submit"]')
const emitted = (wrapper: ReturnType<typeof mountEditor>) => wrapper.emitted('save') as (string | null)[][] | undefined

describe('ReviewEditor', () => {
  it('保存済みの感想を入力欄に表示し、未入力なら空欄にする', () => {
    expect((textarea(mountEditor({ review: '面白かった\n二行目' })).element as HTMLTextAreaElement).value).toBe(
      '面白かった\n二行目',
    )
    expect((textarea(mountEditor({ review: null })).element as HTMLTextAreaElement).value).toBe('')
  })

  it('変更がないうちは保存ボタンを無効にする', async () => {
    const wrapper = mountEditor({ review: '感想' })
    expect(saveButton(wrapper).attributes('disabled')).toBeDefined()

    await textarea(wrapper).setValue('感想を書き足した')
    expect(saveButton(wrapper).attributes('disabled')).toBeUndefined()

    await textarea(wrapper).setValue('感想')
    expect(saveButton(wrapper).attributes('disabled')).toBeDefined()
  })

  it('前後の空白だけの違いは変更とみなさない', async () => {
    const wrapper = mountEditor({ review: '感想' })
    await textarea(wrapper).setValue('  感想\n')
    expect(saveButton(wrapper).attributes('disabled')).toBeDefined()
  })

  it('保存すると前後の空白を除いた感想を通知する', async () => {
    const wrapper = mountEditor({ review: null })
    await textarea(wrapper).setValue('  よかった\n二行目  ')
    await wrapper.find('form').trigger('submit')
    expect(emitted(wrapper)![0]).toEqual(['よかった\n二行目'])
  })

  it('空にして保存すると null を通知して感想を消す', async () => {
    const wrapper = mountEditor({ review: '感想' })
    await textarea(wrapper).setValue('   ')
    await wrapper.find('form').trigger('submit')
    expect(emitted(wrapper)![0]).toEqual([null])
  })

  it('外から感想が変わったら入力欄も合わせる', async () => {
    const wrapper = mountEditor({ review: '古い感想' })
    await wrapper.setProps({ review: '新しい感想' })
    expect((textarea(wrapper).element as HTMLTextAreaElement).value).toBe('新しい感想')
  })

  it('入力途中の内容は、感想が変わらない再描画では消えない', async () => {
    const wrapper = mountEditor({ review: '感想' })
    await textarea(wrapper).setValue('書きかけ')
    await wrapper.setProps({ review: '感想', disabled: true })
    await wrapper.setProps({ disabled: false })
    expect((textarea(wrapper).element as HTMLTextAreaElement).value).toBe('書きかけ')
  })

  it('無効のときは入力も保存もできない', () => {
    const wrapper = mountEditor({ review: '感想', disabled: true })
    expect(textarea(wrapper).attributes('disabled')).toBeDefined()
    expect(saveButton(wrapper).attributes('disabled')).toBeDefined()
  })
})
