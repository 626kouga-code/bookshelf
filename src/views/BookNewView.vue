<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import BookForm from '@/components/BookForm.vue'
import { createBook, type BookInput } from '@/api/books'

const router = useRouter()

const submitting = ref(false)
const error = ref<string | null>(null)

async function onSubmit(input: BookInput) {
  if (submitting.value) return
  submitting.value = true
  error.value = null
  try {
    await createBook(input)
    await router.push('/')
  } catch (e) {
    error.value = e instanceof Error ? e.message : '登録に失敗しました'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <section class="mx-auto max-w-xl">
    <h2 class="mb-4 text-xl font-bold">本を追加</h2>
    <BookForm :submitting="submitting" :error="error" @submit="onSubmit" />
  </section>
</template>
