/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

// shacl-form web component (registered as side-effect by importing the package)
declare module 'vue' {
  interface GlobalComponents {
    'shacl-form': any
  }
}

declare module 'shacl-engine' {
  export class Validator {
    constructor(dataset: unknown, options: Record<string, unknown>)
    validate(data: { dataset: unknown; terms?: Iterable<unknown> }, shapes?: { terms?: Iterable<unknown> }): Promise<{ conforms: boolean; results: unknown[] }>
  }
}

declare module 'shacl-engine/sparql.js' {
  export const validations: Map<unknown, unknown>
  export const targetResolvers: Map<unknown, unknown>
}

export {}
