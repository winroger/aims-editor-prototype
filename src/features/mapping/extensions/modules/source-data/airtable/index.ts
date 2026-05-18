import { defineAsyncComponent, markRaw } from 'vue'
import { createMappingExtensionModule } from '@/features/mapping/extensions/core/createMappingExtensionModule'

const AirtableConnectPanel = defineAsyncComponent(() => import('@/features/mapping/components/setup/AirtableConnectPanel.vue'))
const HubNode = defineAsyncComponent(() => import('@/features/mapping/components/canvas/HubNode.vue'))

export const airtableModule = createMappingExtensionModule({
  id: 'source-data.airtable',
  setupDialogs: [
    {
      id: 'airtable-connect',
      header: 'Connect Airtable',
      width: '720px',
      component: AirtableConnectPanel,
      buildProps: payload => ({
        initialBaseId: payload?.initialBaseId,
      }),
    },
  ],
  dataSourceImports: [
    {
      id: 'airtable-tables',
      label: 'Airtable table',
      icon: 'pi pi-database',
      dialogId: 'airtable-connect',
    },
  ],
  canvasNodeTypes: {
    hubNode: markRaw(HubNode),
  },
  canvasModules: [
    {
      id: 'airtable-hub',
      buildNodes: context => context.dataStore.listAirtableBases().map(baseId => {
        const tables = context.dataStore.getAirtableTablesForBase(baseId)
        return {
          id: `air:${baseId}`,
          type: 'hubNode',
          position: { x: 0, y: 0 },
          data: {
            title: 'Airtable',
            subtitle: `${tables.length} table(s)`,
            icon: 'pi pi-database',
            sourceHandleId: 'airtable-out',
            rows: [
              {
                label: 'Base',
                value: baseId,
                asCode: true,
              },
            ],
            section: {
              label: 'Loaded tables',
              items: tables.map(table => table.name),
            },
            action: {
              label: 'Refresh',
              icon: 'pi pi-refresh',
              loading: context.isRefreshingAirtableBase(baseId),
              onClick: () => context.refreshAirtableBase(baseId),
            },
            theme: {
              background: 'linear-gradient(160deg, #ecfeff 0%, #f0fdfa 100%)',
              borderColor: '#99f6e4',
              accentColor: '#0f766e',
              mutedColor: '#115e59',
              handleColor: '#d1d5db',
              codeBackground: 'rgba(255, 255, 255, 0.7)',
            },
            onOpenConfig: () => context.openSetupDialog('airtable-connect', { initialBaseId: baseId }),
            onHoverChange: (isHovered: boolean) => context.setAirtableEdgeVisibility(baseId, isHovered),
          },
        }
      }),
    },
  ],
  defaultNodePositions: {
    hubNode: { x: 40, y: 40 },
  },
})