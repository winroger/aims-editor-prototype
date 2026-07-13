import { describe, expect, it } from 'vitest'
import { applyDefaultExtensionEdgeStyle } from '@/features/mapping/canvasGraphBuilders'

describe('canvasEdgeLabels', () => {
  it('suppresses relation badges for hidden extension helper edges', () => {
    const edge = applyDefaultExtensionEdgeStyle({
      id: 'airtable:hidden',
      source: 'hub:airtable',
      sourceHandle: 'airtable-out',
      target: 'src:table-1',
      targetHandle: 'table-parent',
      style: { opacity: 0 },
    })

    expect(edge.label).toBe('')
    expect(edge.data).toMatchObject({ relationLabel: '' })
  })

  it('suppresses badges for non-SHACL extension input edges', () => {
    const edge = applyDefaultExtensionEdgeStyle({
      id: 'geo-ui:input',
      source: 'src:buildings',
      sourceHandle: 'h:GeoNames ID',
      target: 'geonames:node-1',
      targetHandle: 'geo-input',
    })

    expect(edge.label).toBe('')
    expect(edge.data).toMatchObject({ relationLabel: '' })
  })
})