import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'

/**
 * Application has two main views:
 *   - /app:    unified mapping canvas (setup + mapping)
 *   - /browse: list/card browser over generated RDF subjects
 *   - /export: RO-Crate metadata + export workflow
 */
export const APP_MODES = [
  { key: 'app',    label: 'Mapping', icon: 'pi pi-share-alt', path: '/app' },
  { key: 'browse', label: 'Browse',  icon: 'pi pi-th-large',  path: '/browse' },
  { key: 'export', label: 'Export',  icon: 'pi pi-download',  path: '/export' },
] as const

export type AppModeKey = (typeof APP_MODES)[number]['key']

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/app' },
  {
    path: '/app',
    name: 'app',
    component: () => import('@/views/AppView.vue'),
  },
  {
    path: '/browse',
    name: 'browse',
    component: () => import('@/views/BrowseView.vue'),
  },
  {
    path: '/export',
    name: 'export',
    component: () => import('@/views/ExportView.vue'),
  },
  // Backwards-compat redirects
  { path: '/setup', redirect: '/app' },
  { path: '/mapping', redirect: '/app' },
]

export default createRouter({
  history: createWebHashHistory(),
  routes,
})
