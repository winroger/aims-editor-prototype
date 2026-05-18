<script setup lang="ts">
import { computed } from 'vue'
import { BaseEdge, getBezierPath, type EdgeProps } from '@vue-flow/core'

interface GradientEdgeData {
  sourceColor?: string
  targetColor?: string
}

const props = defineProps<EdgeProps<GradientEdgeData>>()

const gradientId = computed(() => `edge-gradient-${props.id.replace(/[^a-zA-Z0-9_-]/g, '-')}`)

const edgePath = computed(() => getBezierPath({
  sourceX: props.sourceX,
  sourceY: props.sourceY,
  targetX: props.targetX,
  targetY: props.targetY,
  sourcePosition: props.sourcePosition,
  targetPosition: props.targetPosition,
  curvature: props.curvature,
})[0])

const edgeStyle = computed(() => ({
  ...(props.style ?? {}),
  stroke: `url(#${gradientId.value})`,
}))

const sourceColor = computed(() => props.data?.sourceColor ?? '#6366f1')
const targetColor = computed(() => props.data?.targetColor ?? '#6366f1')
</script>

<template>
  <defs>
    <linearGradient
      :id="gradientId"
      gradientUnits="userSpaceOnUse"
      :x1="sourceX"
      :y1="sourceY"
      :x2="targetX"
      :y2="targetY"
    >
      <stop offset="0%" :stop-color="sourceColor" />
      <stop offset="100%" :stop-color="targetColor" />
    </linearGradient>
  </defs>

  <BaseEdge
    :id="id"
    :path="edgePath"
    :marker-start="markerStart"
    :marker-end="markerEnd"
    :interaction-width="interactionWidth"
    :style="edgeStyle"
  />
</template>