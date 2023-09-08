import { afterAll, beforeAll, test } from '@jest/globals'
import { PrismaNeon } from '@jkomyno/prisma-adapter-neon' // TODO rename to `@prisma/adapter-neon`
import { PrismaPg } from '@jkomyno/prisma-adapter-pg' // rename to `@prisma/adapter-pg`
import { PrismaPlanetScale } from '@jkomyno/prisma-adapter-planetscale'
import { neonConfig, Pool as neonPool } from '@neondatabase/serverless'
import { connect } from '@planetscale/database'
import fs from 'fs-extra'
import path from 'path'
import { Pool as pgPool } from 'pg'
// TODO remove once support for Node.js v16 is dropped.
import { fetch as undiciFetch, WebSocket } from 'undici'

import { checkMissingProviders } from './checkMissingProviders'
import { getTestSuiteConfigs, getTestSuiteFolderPath, getTestSuiteMeta } from './getTestSuiteInfo'
import { getTestSuitePlan } from './getTestSuitePlan'
import { ProviderFlavors } from './providerFlavors'
import { getClientMeta, setupTestSuiteClient } from './setupTestSuiteClient'
import { DatasourceInfo, dropTestSuiteDatabase, setupTestSuiteDatabase, setupTestSuiteDbURI } from './setupTestSuiteEnv'
import { stopMiniProxyQueryEngine } from './stopMiniProxyQueryEngine'
import { ClientMeta, MatrixOptions } from './types'

export type TestSuiteMeta = ReturnType<typeof getTestSuiteMeta>
export type TestCallbackSuiteMeta = TestSuiteMeta & { generatedFolder: string }

/**
 * How does this work from a high level? What steps?
 * 1. You create a file that uses `setupTestSuiteMatrix`
 * 2. It defines a test suite, but it is a special one
 * 3. You create a `_matrix.ts` near your test suite
 * 4. This defines the test suite matrix to be used
 * 5. You write a few tests inside your test suite
 * 7. Execute tests like you usually would with jest
 * 9. The test suite expands into many via the matrix
 * 10. Each test suite has it's own generated schema
 * 11. Each test suite has it's own database, and env
 * 12. Each test suite has it's own generated client
 * 13. Each test suite is executed with those files
 * 14. Each test suite has its environment cleaned up
 *
 * @remarks Why does each test suite have a generated schema? This is to support
 * multi-provider testing and more. A base schema is automatically injected with
 * the cross-product of the configs defined in `_matrix.ts` (@see _example).
 *
 * @remarks Generated files are used for getting the test ready for execution
 * (writing the schema, the generated client, etc...). After the test are done
 * executing, the files can easily be submitted for type checking.
 *
 * @remarks Treat `_matrix.ts` as being analogous to a github action matrix.
 *
 * @remarks Jest snapshots will work out of the box, but not inline snapshots
 * because those can't work in a loop (jest limitation). To make it work, you
 * just need to pass `-u` to jest and we do the magic to make it work.
 *
 * @param tests where you write your tests
 */
function setupTestSuiteMatrix(
  tests: (
    suiteConfig: Record<string, string>,
    suiteMeta: TestCallbackSuiteMeta,
    clientMeta: ClientMeta,
    setupDatabase: () => Promise<void>,
  ) => void,
  options?: MatrixOptions,
) {
  const originalEnv = process.env
  const suiteMeta = getTestSuiteMeta()
  const clientMeta = getClientMeta()
  const suiteConfigs = getTestSuiteConfigs(suiteMeta)
  const testPlan = getTestSuitePlan(suiteMeta, suiteConfigs, clientMeta, options)

  if (originalEnv.TEST_GENERATE_ONLY === 'true') {
    options = options ?? {}
    options.skipDefaultClientInstance = true
    options.skipDb = true
  }

  checkMissingProviders({
    suiteConfigs,
    suiteMeta,
    options,
  })

  for (const { name, suiteConfig, skip } of testPlan) {
    const generatedFolder = getTestSuiteFolderPath(suiteMeta, suiteConfig)
    const describeFn = skip ? describe.skip : describe
    const providerFlavor = suiteConfig.matrixOptions['providerFlavor'] as ProviderFlavors

    describeFn(name, () => {
      const clients = [] as any[]
      let datasourceInfo
      // we inject modified env vars, and make the client available as globals
      beforeAll(async () => {
        datasourceInfo = setupTestSuiteDbURI(suiteConfig.matrixOptions, clientMeta)

        globalThis['datasourceInfo'] = datasourceInfo

        globalThis['loaded'] = await setupTestSuiteClient({
          suiteMeta,
          suiteConfig,
          datasourceInfo,
          clientMeta,
          skipDb: options?.skipDb,
          alterStatementCallback: options?.alterStatementCallback,
        })

        globalThis['newPrismaClient'] = (args) => {
          let client
          if (providerFlavor === ProviderFlavors.PG) {
            const pool = new pgPool({
              connectionString: datasourceInfo.databaseUrl,
            })
            const adapter = new PrismaPg(pool)

            console.debug('Using PrismaPg adapter.')
            client = new globalThis['loaded']['PrismaClient']({ adapter, ...args })
          } else if (providerFlavor === ProviderFlavors.JS_PLANETSCALE) {
            const connection = connect({
              url: 'http://root:root@127.0.0.1:8085',
              /**
               * Custom `fetch` implementation is only necessary on Node.js < v18.x.x.
               */
              fetch: undiciFetch,
            })

            const adapter = new PrismaPlanetScale(connection)

            console.debug('Using PrismaPlanetScale adapter.')
            client = new globalThis['loaded']['PrismaClient']({ adapter, ...args })
          } else if (providerFlavor === ProviderFlavors.JS_NEON) {
            // When using HTTP on Node.js <18
            // neonConfig.fetchFunction = undiciFetch
            neonConfig.webSocketConstructor = WebSocket
            // client.neonConfig.webSocketConstructor = ws;
            // Disable all authentication and encryption
            neonConfig.useSecureWebSocket = false
            // neonConfig.pipelineTLS = false;
            neonConfig.pipelineConnect = false
            neonConfig.wsProxy = () => {
              return `127.0.0.1:5488/v1`
            }

            const pool = new neonPool({
              connectionString: datasourceInfo.databaseUrl,
            })

            const adapter = new PrismaNeon(pool)

            console.debug('Using PrismaNeon adapter.')
            client = new globalThis['loaded']['PrismaClient']({ adapter, ...args })
          } else {
            client = new globalThis['loaded']['PrismaClient']({ ...args })
          }

          clients.push(client)

          return client
        }

        if (!options?.skipDefaultClientInstance) {
          globalThis['prisma'] = globalThis['newPrismaClient']()
        }
        globalThis['Prisma'] = (await global['loaded'])['Prisma']
      })

      // for better type dx, copy a client into the test suite root node_modules
      // this is so that we can have intellisense for the client in the test suite
      beforeAll(() => {
        const rootNodeModuleFolderPath = path.join(suiteMeta.testRoot, 'node_modules')

        // reserve the node_modules so that parallel tests suites don't conflict
        fs.mkdir(rootNodeModuleFolderPath, async (error) => {
          if (error !== null && error.code !== 'EEXIST') throw error // unknown error
          if (error !== null && error.code === 'EEXIST') return // already reserved

          const suiteFolderPath = getTestSuiteFolderPath(suiteMeta, suiteConfig)
          const suiteNodeModuleFolderPath = path.join(suiteFolderPath, 'node_modules')

          await fs.copy(suiteNodeModuleFolderPath, rootNodeModuleFolderPath, { recursive: true })
        })
      })

      afterAll(async () => {
        for (const client of clients) {
          await client.$disconnect().catch(() => {
            // sometimes we test connection errors. In that case,
            // disconnect might also fail, so ignoring the error here
          })
          if (clientMeta.dataProxy) {
            await stopMiniProxyQueryEngine(client, globalThis['datasourceInfo'])
          }
        }
        clients.length = 0

        // Skip the database drop?
        if (
          !options?.skipDb &&
          ![
            // ProviderFlavors.VITESS_8,
            ProviderFlavors.JS_PLANETSCALE,
          ].includes(providerFlavor)
        ) {
          const datasourceInfo = globalThis['datasourceInfo'] as DatasourceInfo
          process.env[datasourceInfo.envVarName] = datasourceInfo.databaseUrl
          process.env[datasourceInfo.directEnvVarName] = datasourceInfo.databaseUrl
          await dropTestSuiteDatabase(suiteMeta, suiteConfig)
        }

        // cleanup env vars
        process.env = originalEnv
        delete globalThis['datasourceInfo']
        delete globalThis['loaded']
        delete globalThis['prisma']
        delete globalThis['Prisma']
        delete globalThis['newPrismaClient']
      }, 180_000) // TODO: lower the timeout?

      const setupDatabase = async () => {
        if (!options?.skipDb) {
          throw new Error(
            'Pass skipDb: true in the matrix options if you want to manually setup the database in your test.',
          )
        }

        return setupTestSuiteDatabase({
          suiteMeta,
          suiteConfig,
          errors: [],
          datasourceInfo,
          alterStatementCallback: options?.alterStatementCallback,
        })
      }

      if (originalEnv.TEST_GENERATE_ONLY === 'true') {
        // because we have our own custom `test` global call defined that reacts
        // to this env var already, we import the original jest `test` and call
        // it because we need to run at least one test to generate the client
        test('generate only', () => {})
      }

      tests(suiteConfig.matrixOptions, { ...suiteMeta, generatedFolder }, clientMeta, setupDatabase)
    })
  }
}

export { setupTestSuiteMatrix }
