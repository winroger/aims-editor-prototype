declare module '@rdfjs/data-model' {
  const factory: any
  export default factory
}

declare module '@rdfjs/dataset' {
  const datasetFactory: any
  export default datasetFactory
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