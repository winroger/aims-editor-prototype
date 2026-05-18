import { createMappingExtensionModule } from '@/features/mapping/extensions/core/createMappingExtensionModule'

export const ttlUploadModule = createMappingExtensionModule({
  id: 'shape-source.ttl-upload',
  shapeSourceImports: [
    {
      id: 'ttl-upload',
      label: 'Upload TTL file',
      icon: 'pi pi-file-import',
      action: 'upload-files',
    },
  ],
})