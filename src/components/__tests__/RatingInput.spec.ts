import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import RatingInput from '../RatingInput.vue'

const mountRating = (modelValue: number, disabled = false) =>
  mount(RatingInput, { props: { modelValue, disabled } })

const stars = (wrapper: ReturnType<typeof mountRating>) => wrapper.findAll('[role="radio"]')

describe('RatingInput', () => {
  it('5つの星を表示し、評価の数だけ塗りつぶす', () => {
    const wrapper = mountRating(3)
    expect(stars(wrapper)).toHaveLength(5)
    expect(stars(wrapper).map((s) => s.text()).join('')).toBe('★★★☆☆')
  })

  it('現在の評価の星だけが選択状態になり、未評価なら何も選択されない', () => {
    expect(stars(mountRating(4)).map((s) => s.attributes('aria-checked'))).toEqual([
      'false',
      'false',
      'false',
      'true',
      'false',
    ])
    expect(stars(mountRating(0)).every((s) => s.attributes('aria-checked') === 'false')).toBe(true)
  })

  it('評価の数値または「未評価」を表示する', () => {
    expect(mountRating(4).text()).toContain('4 / 5')
    expect(mountRating(0).text()).toContain('未評価')
  })

  it('星を押すとその評価を通知する', async () => {
    const wrapper = mountRating(0)
    await stars(wrapper)[2]!.trigger('click')
    expect(wrapper.emitted('update:modelValue')![0]).toEqual([3])
  })

  it('別の星を押すと評価を変更できる', async () => {
    const wrapper = mountRating(3)
    await stars(wrapper)[4]!.trigger('click')
    expect(wrapper.emitted('update:modelValue')![0]).toEqual([5])
  })

  it('今の評価と同じ星をもう一度押すと未評価（0）に戻す', async () => {
    const wrapper = mountRating(3)
    await stars(wrapper)[2]!.trigger('click')
    expect(wrapper.emitted('update:modelValue')![0]).toEqual([0])
  })

  it('無効のときは押せない', () => {
    expect(stars(mountRating(2, true)).every((s) => s.attributes('disabled') !== undefined)).toBe(true)
  })
})
