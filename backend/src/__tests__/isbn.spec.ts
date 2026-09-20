import { describe, expect, it } from 'vitest'
import { normalizeIsbn } from '../isbn.ts'

describe('normalizeIsbn', () => {
  it('13桁はそのまま返す', () => {
    expect(normalizeIsbn('9780306406157')).toBe('9780306406157')
  })

  it('ハイフンと空白を取り除く', () => {
    expect(normalizeIsbn('978-0-306-40615-7')).toBe('9780306406157')
    expect(normalizeIsbn(' 978 0306406157 ')).toBe('9780306406157')
  })

  it('10桁は13桁に変換する', () => {
    expect(normalizeIsbn('0306406152')).toBe('9780306406157')
    expect(normalizeIsbn('0-306-40615-2')).toBe('9780306406157')
  })

  it('末尾が X の10桁も変換できる', () => {
    expect(normalizeIsbn('080442957X')).toBe('9780804429573')
    expect(normalizeIsbn('080442957x')).toBe('9780804429573')
  })

  it('チェックデジットが不正なら null', () => {
    expect(normalizeIsbn('9780306406158')).toBeNull()
    expect(normalizeIsbn('0306406153')).toBeNull()
  })

  it('形式が不正なら null', () => {
    expect(normalizeIsbn('')).toBeNull()
    expect(normalizeIsbn('abc')).toBeNull()
    expect(normalizeIsbn('12345')).toBeNull()
  })
})
