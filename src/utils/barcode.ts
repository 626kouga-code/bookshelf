/**
 * 本のバーコードとして読み取った数字が ISBN（978/979 で始まる EAN-13）ならそのまま返し、違えば null。
 * 日本の本の裏表紙には2段のバーコードがあり、2段目（192… の価格コード）は ISBN ではないので捨てる。
 * 読み取りの誤りを除くため、チェックディジットも確かめる。
 */
export function isbnFromBarcode(code: string): string | null {
  const digits = code.trim()
  if (!/^97[89]\d{10}$/.test(digits)) return null
  const sum = [...digits.slice(0, 12)].reduce((acc, d, i) => acc + Number(d) * (i % 2 === 0 ? 1 : 3), 0)
  const check = (10 - (sum % 10)) % 10
  return check === Number(digits[12]) ? digits : null
}
