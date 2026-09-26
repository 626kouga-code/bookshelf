import { computed, reactive, ref } from 'vue'
import { defineStore } from 'pinia'
import { listBooks, type Book, type BookSort, type BookStatus, type SortOrder } from '@/api/books'

export interface BookFilters {
  /** 空文字は「すべて」 */
  status: BookStatus | ''
  q: string
  /** 空文字は指定なし */
  tag: string
  /** 空文字は指定なし */
  series: string
  /** true ならお気に入りだけ */
  favoriteOnly: boolean
  sort: BookSort
  order: SortOrder
}

export const useBooksStore = defineStore('books', () => {
  const books = ref<Book[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const filters = reactive<BookFilters>({
    status: '',
    q: '',
    tag: '',
    series: '',
    favoriteOnly: false,
    sort: 'added_at',
    order: 'desc',
  })

  // 連続して呼ばれたとき、古いリクエストの結果で新しい結果を上書きしない
  let latestRequest = 0

  async function fetchBooks() {
    const requestId = ++latestRequest
    loading.value = true
    error.value = null
    try {
      const result = await listBooks({
        status: filters.status || undefined,
        q: filters.q.trim() || undefined,
        tag: filters.tag || undefined,
        series: filters.series || undefined,
        favorite: filters.favoriteOnly || undefined,
        sort: filters.sort,
        order: filters.order,
      })
      if (requestId !== latestRequest) return
      books.value = result
    } catch (e) {
      if (requestId !== latestRequest) return
      error.value = e instanceof Error ? e.message : '本の取得に失敗しました'
    } finally {
      if (requestId === latestRequest) loading.value = false
    }
  }

  /** 絞り込み条件が既定（すべて・検索なし）かどうか。空状態の文言の出し分けに使う。 */
  const isFiltered = computed(
    () =>
      filters.status !== '' ||
      filters.q.trim() !== '' ||
      filters.tag !== '' ||
      filters.series !== '' ||
      filters.favoriteOnly,
  )

  return { books, loading, error, filters, isFiltered, fetchBooks }
})
