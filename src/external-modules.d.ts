declare module '@rdfjs/data-model' {
  import type { DataFactory } from '@rdfjs/types'
  const factory: DataFactory
  export default factory
}

declare module '@rdfjs/dataset' {
  import type { DatasetCore, Quad } from '@rdfjs/types'
  const datasetFactory: {
    dataset(): DatasetCore<Quad>
  }
  export default datasetFactory
}


