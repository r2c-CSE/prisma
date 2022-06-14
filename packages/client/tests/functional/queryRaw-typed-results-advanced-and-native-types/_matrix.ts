import { defineMatrix } from '../_utils/defineMatrix'

export default defineMatrix(() => [
  [
    {
      provider: 'postgresql',
    },
    {
      provider: 'cockroachdb',
    },
    {
      provider: 'sqlserver',
    },
  ],
  [
    {
      previewFeatures: '',
    },
    {
      previewFeatures: '"improvedQueryRaw"',
    },
  ],
])
