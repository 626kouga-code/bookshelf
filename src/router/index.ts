import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import BookNewView from '../views/BookNewView.vue'
import BookDetailView from '../views/BookDetailView.vue'
import QuoteSearchView from '../views/QuoteSearchView.vue'
import StatsView from '../views/StatsView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/books/new',
      name: 'book-new',
      component: BookNewView,
    },
    {
      path: '/books/:id',
      name: 'book-detail',
      component: BookDetailView,
    },
    {
      path: '/quotes',
      name: 'quotes',
      component: QuoteSearchView,
    },
    {
      path: '/stats',
      name: 'stats',
      component: StatsView,
    },
  ],
})

export default router
