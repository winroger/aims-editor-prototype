<template>
  <div class="app-shell">
    <header class="app-shell__header">
      <div class="app-shell__brand">
        <i class="pi pi-sitemap app-shell__brand-icon" />
        <div class="app-shell__brand-copy">
          <h1 class="app-shell__title">SHACL Editor</h1>
        </div>
      </div>
    </header>

    <main class="app-shell__content">
      <slot />
    </main>
  </div>
</template>

<style scoped lang="scss">
.app-shell {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
  color: var(--color-text);
}

.app-shell__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
}

.app-shell__brand {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.app-shell__brand-icon {
  font-size: 1.5rem;
  color: var(--color-primary);
  flex-shrink: 0;
}

.app-shell__brand-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.app-shell__title {
  margin: 0;
  font-size: 1.3rem;
}

.app-shell__content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

@media (max-width: 900px) {
  .app-shell__header {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
