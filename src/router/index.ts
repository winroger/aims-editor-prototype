import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/editor' },
  {
    path: '/editor',
    name: 'editor',
    component: () => import('@/views/PrepareView.vue'),
  },
  // Backwards-compat redirects
  { path: '/setup', redirect: '/editor' },
  { path: '/mapping', redirect: '/editor' },
  { path: '/prepare', redirect: '/editor' },
  { path: '/review', redirect: '/editor' },
  { path: '/publish', redirect: '/editor' },
  { path: '/analyze', redirect: '/editor' },
]

export default createRouter({
  history: createWebHashHistory(),
  routes,
})


