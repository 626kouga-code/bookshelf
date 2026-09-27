import { describe, expect, it } from 'vitest'
import { isbnFromBarcode } from '../barcode'

describe('isbnFromBarcode', () => {
  it('978/979 で始まり、チェックディジットが正しい13桁は ISBN として返す', () => {
    expect(isbnFromBarcode('9784873115658')).toBe('9784873115658')
    expect(isbnFromBarcode(' 9780306406157 ')).toBe('9780306406157')
    expect(isbnFromBarcode('9791032300824')).toBe('9791032300824')
  })

  it('日本の本の2段目のバーコード（192… の価格コード）は ISBN ではない', () => {
    expect(isbnFromBarcode('1920055008007')).toBeNull()
  })

  it('チェックディジットが合わないもの（読み取りの誤り）は捨てる', () => {
    expect(isbnFromBarcode('9784873115650')).toBeNull()
  })

  it('13桁でない・数字以外を含むものは捨てる', () => {
    expect(isbnFromBarcode('978487311565')).toBeNull()
    expect(isbnFromBarcode('978-4-87311-565-8')).toBeNull()
    expect(isbnFromBarcode('')).toBeNull()
  })
})
