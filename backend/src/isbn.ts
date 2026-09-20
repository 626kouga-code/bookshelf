/** ISBN-13 のチェックデジットを計算する（先頭12桁を渡す）。 */
function isbn13CheckDigit(first12: string): number {
  const sum = [...first12].reduce((acc, ch, i) => acc + Number(ch) * (i % 2 === 0 ? 1 : 3), 0)
  return (10 - (sum % 10)) % 10
}

/**
 * ISBN（10桁/13桁、ハイフン・空白付き可）を13桁に正規化する。
 * 形式やチェックデジットが不正な場合は null を返す。
 */
export function normalizeIsbn(input: string): string | null {
  const s = input.replace(/[-\s]/g, '').toUpperCase()

  if (/^\d{13}$/.test(s)) {
    return isbn13CheckDigit(s.slice(0, 12)) === Number(s[12]) ? s : null
  }

  if (/^\d{9}[\dX]$/.test(s)) {
    const sum = [...s.slice(0, 9)].reduce((acc, ch, i) => acc + Number(ch) * (10 - i), 0)
    const check = (11 - (sum % 11)) % 11
    if ((check === 10 ? 'X' : String(check)) !== s[9]) return null
    const first12 = `978${s.slice(0, 9)}`
    return `${first12}${isbn13CheckDigit(first12)}`
  }

  return null
}
