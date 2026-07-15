import type { MappingExtensionModule } from '@/features/mapping/extensions/core/types'
import { aimsProfileModule } from '@/features/mapping/extensions/modules/shape-sources/aims-profile'
import { ttlUploadModule } from '@/features/mapping/extensions/modules/shape-sources/ttl-upload'

export const mappingExtensionModules: MappingExtensionModule[] = [
  ttlUploadModule,
  aimsProfileModule,
]

