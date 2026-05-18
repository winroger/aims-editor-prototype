<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'
import Message from 'primevue/message'
import Tag from 'primevue/tag'
import { useToast } from 'primevue/usetoast'
import { loadAimsProfiles, fetchAimsProfileTurtle, type AimsProfile } from '@/services/infrastructure/imports/aimsProfileService'
import { useShapesStore } from '@/stores/shapesStore'

const emit = defineEmits<{ added: [] }>()

const toast = useToast()
const shapesStore = useShapesStore()

const profiles = ref<AimsProfile[]>([])
const selectedProfile = ref<AimsProfile | null>(null)
const search = ref('')
const isLoading = ref(false)
const isSubmitting = ref(false)
const error = ref<string | null>(null)

const filteredProfiles = computed(() => {
  const needle = search.value.trim().toLowerCase()
  if (!needle) return profiles.value
  return profiles.value.filter(profile => {
    const haystack = [profile.name, profile.description, profile.creator]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return haystack.includes(needle)
  })
})

async function loadProfiles(): Promise<void> {
  isLoading.value = true
  error.value = null
  try {
    profiles.value = await loadAimsProfiles()
    if (!selectedProfile.value || !profiles.value.some(profile => profile.base_url === selectedProfile.value?.base_url)) {
      selectedProfile.value = profiles.value[0] ?? null
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    isLoading.value = false
  }
}

async function addProfile(): Promise<void> {
  if (!selectedProfile.value) {
    error.value = 'Waehle zuerst ein Profil aus dem Metadata Profile Service aus.'
    return
  }

  isSubmitting.value = true
  error.value = null
  try {
    const turtle = await fetchAimsProfileTurtle(selectedProfile.value)
    await shapesStore.addProfileFromTurtle(turtle, `${selectedProfile.value.name}.ttl`, selectedProfile.value.base_url)
    toast.add({
      severity: 'success',
      summary: 'Schema loaded',
      detail: `${selectedProfile.value.name} wurde aus dem Metadata Profile Service geladen.`,
      life: 3500,
    })
    if (shapesStore.lastResolveErrors.length > 0) {
      toast.add({
        severity: 'warn',
        summary: 'Some imports were not resolved',
        detail: `${shapesStore.lastResolveErrors.length} owl:import(s) konnten nicht geladen werden.`,
        life: 4500,
      })
    }
    emit('added')
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    isSubmitting.value = false
  }
}

onMounted(() => { void loadProfiles() })
</script>

<template>
  <div class="aims-profile-panel">
    <div class="toolbar">
      <label class="field search-field">
        <span>Profile durchsuchen</span>
        <InputText v-model="search" placeholder="RO-kit dataset" fluid />
      </label>
      <Button
        label="Aktualisieren"
        icon="pi pi-refresh"
        severity="secondary"
        :loading="isLoading"
        @click="loadProfiles"
      />
    </div>

    <Message severity="info" :closable="false">
      Es werden aktuell nur Profile mit RO-kit oder RO-crate Bezug aus dem Metadata Profile Service angeboten.
    </Message>

    <Message v-if="error" severity="error" :closable="false">
      {{ error }}
    </Message>

    <div class="list-shell">
      <aside class="profile-list" :class="{ loading: isLoading }">
        <button
          v-for="profile in filteredProfiles"
          :key="profile.base_url"
          class="profile-option"
          :class="{ selected: selectedProfile?.base_url === profile.base_url }"
          @click="selectedProfile = profile"
        >
          <strong>{{ profile.name }}</strong>
          <span>{{ profile.description || profile.base_url }}</span>
        </button>
        <div v-if="!isLoading && filteredProfiles.length === 0" class="empty-list">
          Keine passenden Profile gefunden.
        </div>
      </aside>

      <section class="profile-detail">
        <template v-if="selectedProfile">
          <header class="detail-header">
            <div>
              <h3>{{ selectedProfile.name }}</h3>
              <p>{{ selectedProfile.description || 'Keine Beschreibung hinterlegt.' }}</p>
            </div>
            <Tag :value="String(selectedProfile.state ?? 'public')" severity="info" />
          </header>

          <dl class="detail-grid">
            <div>
              <dt>Creator</dt>
              <dd>{{ selectedProfile.creator || 'Unbekannt' }}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{{ selectedProfile.created || 'Unbekannt' }}</dd>
            </div>
            <div>
              <dt>MIME type</dt>
              <dd>{{ selectedProfile.mimeType || 'text/turtle' }}</dd>
            </div>
            <div>
              <dt>Base URL</dt>
              <dd>{{ selectedProfile.base_url }}</dd>
            </div>
          </dl>
        </template>
        <div v-else class="empty-detail">
          Waehle links ein Profil aus.
        </div>
      </section>
    </div>

    <div class="actions">
      <Button
        label="Ausgewaehltes Profil laden"
        icon="pi pi-plus"
        :disabled="!selectedProfile"
        :loading="isSubmitting"
        @click="addProfile"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.aims-profile-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.toolbar {
  display: flex;
  align-items: end;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.search-field {
  min-width: min(460px, 100%);
  flex: 1;
}

.list-shell {
  display: grid;
  grid-template-columns: minmax(260px, 360px) minmax(0, 1fr);
  gap: var(--space-3);
}

.profile-list,
.profile-detail {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-1);
}

.profile-list {
  max-height: 60vh;
  overflow: auto;
  padding: var(--space-2);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.profile-option {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
  text-align: left;
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface-1);
  cursor: pointer;

  strong {
    font-size: 0.95rem;
  }

  span {
    color: var(--color-text-muted);
    font-size: 0.8rem;
    overflow-wrap: anywhere;
  }

  &:hover {
    background: var(--color-surface-2);
  }

  &.selected {
    border-color: var(--color-accent);
    background: rgba(99, 102, 241, 0.06);
  }
}

.profile-detail {
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.detail-header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: var(--space-3);

  h3,
  p {
    margin: 0;
  }

  p {
    margin-top: 4px;
    color: var(--color-text-muted);
  }
}

.detail-grid {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 8px 12px;
  margin: 0;

  div { display: contents; }

  dt {
    color: var(--color-text-muted);
    font-weight: 600;
  }

  dd {
    margin: 0;
    overflow-wrap: anywhere;
    font-family: var(--font-mono);
  }
}

.actions {
  display: flex;
  justify-content: flex-end;
}

.empty-list,
.empty-detail {
  padding: var(--space-4);
  color: var(--color-text-muted);
}

@media (max-width: 900px) {
  .list-shell {
    grid-template-columns: 1fr;
  }
}
</style>