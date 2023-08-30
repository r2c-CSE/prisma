import { defineMatrix } from '../../_utils/defineMatrix'

export default defineMatrix(() => [
  [
    {
      provider: 'postgresql',
    },
    // {
    //   provider: 'postgresql',
    //   providerFlavor: 'js_neon',
    // },
    {
      provider: 'mysql',
    },
    {
      provider: 'mysql',
      providerFlavor: 'vitess_8',
    },
    {
      provider: 'mysql',
      providerFlavor: 'js_planetscale',
    },
    {
      provider: 'cockroachdb',
    },
    {
      provider: 'mongodb',
    },
  ],
])
