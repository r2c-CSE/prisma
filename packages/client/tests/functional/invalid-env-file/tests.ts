import stripAnsi from 'strip-ansi'

import { NewPrismaClient } from '../_utils/types'
import testMatrix from './_matrix'
// @ts-ignore
import type { Prisma as PrismaNamespace, PrismaClient } from './node_modules/@prisma/client'

declare const newPrismaClient: NewPrismaClient<typeof PrismaClient>
declare let Prisma: typeof PrismaNamespace

testMatrix.setupTestSuite(
  (suitConfig, suiteMeta, clientMeta) => {
    beforeAll(() => {
      const env = require('./prisma/env.json')
      Object.assign(process.env, env)
    })

    test('PrismaClientInitializationError for invalid env', async () => {
      // This test often fails on macOS CI with thrown: "Exceeded timeout of
      // 60000 ms for a hook. Retrying might help, let's find out
      const isMacCI = Boolean(process.env.CI) && ['darwin'].includes(process.platform)
      if (isMacCI) {
        jest.retryTimes(3)
      }

      const prisma = newPrismaClient()
      const promise = prisma.$connect()

      expect.assertions(2)
      if (clientMeta.dataProxy && clientMeta.runtime === 'edge') {
        // this error is expected because the edge client is not able to read files
        await expect(promise).rejects.toBeInstanceOf(Prisma.PrismaClientInitializationError)
        await expect(promise).rejects.toThrowErrorMatchingInlineSnapshot(
          `error: Environment variable not found: DATABASE_URI.`,
        )
      } else if (clientMeta.dataProxy && clientMeta.runtime === 'node') {
        // TODO Prisma 6: should be a PrismaClientInitializationError, but the message is correct
        // await expect(promise).rejects.toBeInstanceOf(Prisma.InvalidDatasourceError)
        await expect(promise).rejects.toThrowErrorMatchingInlineSnapshot(`Datasource URL must use prisma:// protocol`)
      } else if (!clientMeta.dataProxy) {
        await promise.catch((e) => {
          const message = stripAnsi(e.message)
          expect(e).toBeInstanceOf(Prisma.PrismaClientInitializationError)
          expect(message).toContain('error: Error validating datasource `db`: the URL must start with the protocol')
        })
      } else {
        throw new Error('Unhandled case')
      }
    })
  },
  {
    skipDb: true,
    skipDefaultClientInstance: true, // So we can manually call connect for this test
  },
)
