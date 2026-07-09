import { createRouter, createWebHashHistory } from 'vue-router'
import { isPinRequired, getLockRemaining } from '@/services/pin'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'bookshelf',
      component: () => import('@/views/BookshelfView.vue')
    },
    {
      path: '/unlock',
      name: 'unlock',
      component: () => import('@/views/PinUnlockView.vue')
    },
    {
      path: '/reader/:id',
      name: 'reader',
      component: () => import('@/views/ReaderView.vue'),
      props: true
    },
    {
      path: '/notes',
      name: 'notes',
      component: () => import('@/views/NotesView.vue')
    },
    {
      path: '/tags',
      name: 'tags',
      component: () => import('@/views/TagsView.vue')
    },
    {
      path: '/trash',
      name: 'trash',
      component: () => import('@/views/TrashView.vue')
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue')
    },
    {
      path: '/stats',
      name: 'stats',
      component: () => import('@/views/StatsView.vue')
    },
    {
      path: '/dictionary',
      name: 'dictionary',
      component: () => import('@/views/DictionaryView.vue')
    },
    {
      path: '/history',
      name: 'history',
      component: () => import('@/views/HistoryView.vue')
    },
    {
      path: '/libraries',
      name: 'libraries',
      component: () => import('@/views/LibraryView.vue')
    }
  ]
})

router.beforeEach(async (to) => {
  if (to.name === 'unlock') return true
  const locked = await isPinRequired()
  if (locked) {
    const remaining = await getLockRemaining()
    if (remaining > 0) {
      return { name: 'unlock', query: { locked: 'true' } }
    }
    return { name: 'unlock' }
  }
  return true
})

/** @deprecated No longer needed — PIN is checked on every navigation */
export function resetPinCheck() {}

export default router
