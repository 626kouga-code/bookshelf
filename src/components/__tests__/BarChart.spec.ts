import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BarChart from '../BarChart.vue'

describe('BarChart', () => {
  it('データがなければ「データがありません」と表示する', () => {
    const wrapper = mount(BarChart, { props: { items: [] } })
    expect(wrapper.text()).toContain('データがありません')
    expect(wrapper.find('svg').exists()).toBe(false)
  })

  it('項目ごとにバーとラベル・値を表示する', () => {
    const wrapper = mount(BarChart, {
      props: {
        items: [
          { label: '9月', value: 3 },
          { label: '8月', value: 1 },
        ],
        unit: '冊',
      },
    })
    const rects = wrapper.findAll('rect')
    expect(rects).toHaveLength(2)
    expect(wrapper.text()).toContain('9月')
    expect(wrapper.text()).toContain('3冊')
    expect(wrapper.text()).toContain('8月')
    expect(wrapper.text()).toContain('1冊')
  })

  it('最大値の項目がもっとも長いバーになる', () => {
    const wrapper = mount(BarChart, {
      props: {
        items: [
          { label: 'a', value: 10 },
          { label: 'b', value: 5 },
        ],
      },
    })
    const rects = wrapper.findAll('rect')
    const widthOf = (i: number) => Number(rects[i]!.attributes('width'))
    expect(widthOf(0)).toBeGreaterThan(widthOf(1))
  })

  it('すべて0でもエラーにならない', () => {
    const wrapper = mount(BarChart, { props: { items: [{ label: 'a', value: 0 }] } })
    expect(wrapper.find('rect').attributes('width')).toBe('0')
  })
})
