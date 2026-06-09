import type { EChartsOption } from 'echarts'
import type { ExploreChartDefinitionSnapshot } from '@/services/project/projectSnapshot'
import type { ExploreDataframeColumnSnapshot } from '@/services/project/projectSnapshot'
import type { ExploreDataframeModel } from '@/services/explore/exploreService'

function stringValue(value: string | number | null | undefined, fallback = 'Unassigned'): string {
  if (value === null || value === undefined || value === '') return fallback
  return String(value)
}

function numericValue(value: string | number | null | undefined): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string' || value.trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function fieldLabel(fields: readonly ExploreDataframeColumnSnapshot[], key: string | undefined, fallback: string): string {
  if (!key) return fallback
  return fields.find(field => field.id === key)?.label ?? fallback
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2
}

export function buildExploreChartOption(
  chart: ExploreChartDefinitionSnapshot,
  dataframeModel: ExploreDataframeModel,
): EChartsOption | null {
  if (chart.chartType === 'bar') {
    const categoryKey = chart.fieldMapping.category
    if (!categoryKey) return null

    const grouped = new Map<string, number>()
    for (const row of dataframeModel.rows) {
      const category = stringValue(row.values[categoryKey], row.subjectLabel)
      const yCandidate = numericValue(chart.fieldMapping.y ? row.values[chart.fieldMapping.y] : null)
      const nextValue = yCandidate ?? 1
      grouped.set(category, (grouped.get(category) ?? 0) + nextValue)
    }

    const entries = Array.from(grouped.entries()).sort((left, right) => right[1] - left[1])
    if (entries.length === 0) return null

    return {
      animationDuration: 300,
      tooltip: { trigger: 'axis' },
      grid: { top: 56, right: 24, bottom: 48, left: 56 },
      xAxis: {
        type: 'category',
        data: entries.map(([label]) => label),
        axisLabel: { interval: 0, rotate: entries.length > 6 ? 25 : 0 },
        name: fieldLabel(dataframeModel.definition.columns, categoryKey, 'Category'),
      },
      yAxis: {
        type: 'value',
        name: chart.fieldMapping.y
          ? fieldLabel(dataframeModel.definition.columns, chart.fieldMapping.y, 'Value')
          : 'Count',
      },
      series: [{
        type: 'bar',
        data: entries.map(([, value]) => value),
        itemStyle: { color: '#2563eb' },
      }],
    }
  }

  if (chart.chartType === 'scatter') return buildScatterChartOption(chart, dataframeModel)
  return null
}

export function buildScatterChartOption(
  chart: ExploreChartDefinitionSnapshot,
  dataframeModel: ExploreDataframeModel,
): EChartsOption | null {
  const xKey = chart.fieldMapping.x
  const yKey = chart.fieldMapping.y
  if (!xKey || !yKey) return null

  const colorKey = chart.fieldMapping.color
  const sizeKey = chart.fieldMapping.size
  const medianLineBasis = chart.fieldMapping.medianLineBasis
  const palette = ['#0f766e', '#2563eb', '#ea580c', '#7c3aed', '#dc2626', '#0891b2']
  const colors = new Map<string, string>()

  const sizeValues = dataframeModel.rows
    .map(row => numericValue(sizeKey ? row.values[sizeKey] : null))
    .filter((value): value is number => value !== null)
  const minSizeValue = sizeValues.length > 0 ? Math.min(...sizeValues) : null
  const maxSizeValue = sizeValues.length > 0 ? Math.max(...sizeValues) : null

  function symbolSize(row: { values: Record<string, string | number | null> }): number {
    const sizeValue = numericValue(sizeKey ? row.values[sizeKey] : null)
    if (sizeValue === null || minSizeValue === null || maxSizeValue === null || minSizeValue === maxSizeValue) return 14
    const ratio = (sizeValue - minSizeValue) / (maxSizeValue - minSizeValue)
    return 10 + (ratio * 18)
  }

  interface ScatterPoint {
    value: [number, number]
    name: string
    itemStyle?: { color?: string }
    symbolSize: number
  }

  const points: ScatterPoint[] = []
  for (const row of dataframeModel.rows) {
    const x = numericValue(row.values[xKey])
    const y = numericValue(row.values[yKey])
    if (x === null || y === null) continue

    const colorValue = colorKey ? stringValue(row.values[colorKey], 'Unassigned') : null
    if (colorValue && !colors.has(colorValue)) {
      colors.set(colorValue, palette[colors.size % palette.length])
    }

    points.push({
      value: [x, y],
      name: stringValue(chart.fieldMapping.label ? row.values[chart.fieldMapping.label] : row.subjectLabel, row.subjectLabel),
      itemStyle: colorValue ? { color: colors.get(colorValue) } : undefined,
      symbolSize: symbolSize(row),
    })
  }

  if (points.length === 0) return null

  const medianValue = medianLineBasis === 'x'
    ? median(points.map(point => point.value[0]))
    : medianLineBasis === 'y'
      ? median(points.map(point => point.value[1]))
      : null

  return {
    animationDuration: 300,
    tooltip: {
      trigger: 'item',
      formatter: params => {
        const point = params as { data?: { name?: string; value?: [number, number] } }
        const name = point.data?.name ?? ''
        const value = point.data?.value ?? [0, 0]
        return `${name}<br>${fieldLabel(dataframeModel.definition.columns, xKey, 'X')}: ${value[0]}<br>${fieldLabel(dataframeModel.definition.columns, yKey, 'Y')}: ${value[1]}`
      },
    },
    legend: colorKey ? {
      data: Array.from(colors.keys()),
      top: 24,
      right: 24,
    } : undefined,
    grid: { top: 56, right: 24, bottom: 48, left: 56 },
    xAxis: {
      type: 'value',
      name: fieldLabel(dataframeModel.definition.columns, xKey, 'X'),
    },
    yAxis: {
      type: 'value',
      name: fieldLabel(dataframeModel.definition.columns, yKey, 'Y'),
    },
    series: [{
      type: 'scatter',
      data: points,
      symbolSize: value => {
        const point = value as { symbolSize?: number }
        return point.symbolSize ?? 14
      },
      itemStyle: colorKey ? undefined : { color: '#0f766e' },
      markLine: medianValue === null
        ? undefined
        : {
          symbol: ['none', 'none'],
          lineStyle: { type: 'dashed', color: '#dc2626' },
          data: [medianLineBasis === 'x'
            ? { xAxis: medianValue, name: `Median ${fieldLabel(dataframeModel.definition.columns, xKey, 'X')}` }
            : { yAxis: medianValue, name: `Median ${fieldLabel(dataframeModel.definition.columns, yKey, 'Y')}` }],
        },
    }],
  }
}

export function buildExploreChartPreviewOption(
  chart: ExploreChartDefinitionSnapshot,
  dataframeModel: ExploreDataframeModel,
): EChartsOption | null {
  if (chart.chartType === 'bar') return buildExploreChartOption(chart, dataframeModel)
  if (chart.chartType === 'scatter') return buildScatterChartOption(chart, dataframeModel)
  return null
}