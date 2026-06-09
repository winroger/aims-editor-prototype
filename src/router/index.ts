import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'

/**
 * Application has main views for import, browse, explore, and export:
 *   - /app:    unified import canvas (setup + mapping)
 *   - /browse: list/card browser over generated RDF subjects
 *   - /explore: SHACL-guided chart builder over generated RDF subjects
 *   - /export: RO-Crate metadata + export workflow
 */
export const APP_MODES = [
  { key: 'app',    label: 'Import', icon: 'pi pi-share-alt', path: '/app' },
  { key: 'browse', label: 'Browse',  icon: 'pi pi-th-large',  path: '/browse' },
  { key: 'explore', label: 'Explore', icon: 'pi pi-chart-bar', path: '/explore' },
  { key: 'export', label: 'Export',  icon: 'pi pi-download',  path: '/export' },
] as const

export type AppModeKey = (typeof APP_MODES)[number]['key']

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/app' },
  {
    path: '/app',
    name: 'app',
    component: () => import('@/views/ImportView.vue'),
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
  {
    path: '/explore',
    name: 'explore',
    component: () => import('@/views/ExploreView.vue'),
  },
  // Backwards-compat redirects
  { path: '/setup', redirect: '/app' },
  { path: '/mapping', redirect: '/app' },
]

export default createRouter({
  history: createWebHashHistory(),
  routes,
})


