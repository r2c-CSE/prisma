import { klona } from 'klona'

import { getTestSuiteFullName, NamedTestSuiteConfig } from './getTestSuiteInfo'
import { ProviderFlavors } from './providers'
import { TestSuiteMeta } from './setupTestSuiteMatrix'
import { ClientMeta, MatrixOptions } from './types'

export type TestPlanEntry = {
  name: string
  skip: boolean
  suiteConfig: NamedTestSuiteConfig
}

type SuitePlanContext = {
  includedProviders?: string[]
  excludedProviders: string[]
  updateSnapshots: 'inline' | 'external' | undefined
}

/**
 * Get a test plan from a list of suite configs. Test plan tells what the name of
 * the tests are, what are their config and whether or not they should be executed or skipped
 * @param suiteMeta
 * @returns [test-suite-title: string, test-suite-config: object]
 */

export function getTestSuitePlan(
  suiteMeta: TestSuiteMeta,
  suiteConfig: NamedTestSuiteConfig[],
  clientMeta: ClientMeta,
  options?: MatrixOptions,
): TestPlanEntry[] {
  const context = buildPlanContext()

  const shouldSkipAll = shouldSkipTestSuite(clientMeta, options)

  const testPlanEntries = suiteConfig.flatMap((namedConfig, configIndex) => {
    const testPlanEntries: TestPlanEntry[] = []

    const testPlanEntry: TestPlanEntry = {
      name: getTestSuiteFullName(suiteMeta, namedConfig),
      skip: shouldSkipAll || shouldSkipProvider(context, namedConfig, configIndex, clientMeta),
      suiteConfig: namedConfig,
    }

    // driver adapters further expand the matrix, we do it automatically here
    if (clientMeta.driverAdapter === true) {
      if (namedConfig.matrixOptions?.provider === 'postgresql') {
        const pgTestPlan = klona(testPlanEntry)
        pgTestPlan.name += ` (pg)`
        pgTestPlan.suiteConfig.parametersString += `, pg`
        pgTestPlan.suiteConfig.matrixOptions.providerFlavor = ProviderFlavors.JS_PG
        testPlanEntries.push(pgTestPlan)

        const neonTestPlan = klona(testPlanEntry)
        neonTestPlan.name += ` (neon)`
        neonTestPlan.suiteConfig.parametersString += `, neon`
        neonTestPlan.suiteConfig.matrixOptions.providerFlavor = ProviderFlavors.JS_NEON
        testPlanEntries.push(neonTestPlan)
      }

      if (namedConfig.matrixOptions?.provider === 'mysql') {
        const mysqlTestPlan = klona(testPlanEntry)
        mysqlTestPlan.name += ` (pg)`
        mysqlTestPlan.suiteConfig.parametersString += `, planetscale`
        mysqlTestPlan.suiteConfig.matrixOptions.providerFlavor = ProviderFlavors.JS_PLANETSCALE
        testPlanEntries.push(mysqlTestPlan)
      }
    } else {
      testPlanEntries.push(testPlanEntry)
    }

    return testPlanEntries
  })

  console.log(JSON.stringify(testPlanEntries, null, 2))

  return testPlanEntries
}

function shouldSkipTestSuite(clientMeta: ClientMeta, options?: MatrixOptions): boolean {
  if (!clientMeta.dataProxy || !options?.skipDataProxy) {
    return false
  }
  return options.skipDataProxy.runtimes.includes(clientMeta.runtime)
}

function shouldSkipProvider(
  { updateSnapshots, includedProviders, excludedProviders }: SuitePlanContext,
  config: NamedTestSuiteConfig,
  configIndex: number,
  clientMeta: ClientMeta,
): boolean {
  const provider = config.matrixOptions['provider'].toLocaleLowerCase()
  if (updateSnapshots === 'inline' && configIndex > 0) {
    // when updating inline snapshots, we have to run a  single suite only -
    // otherwise jest will fail with "Multiple inline snapshots for the same call are not supported" error
    return true
  }

  if (updateSnapshots === 'external' && configIndex === 0) {
    // when updating external snapshots, we assume that inline snapshots update was run just before it - so
    // there is no reason to re-run the first suite
    return true
  }

  if (includedProviders && !includedProviders.includes(provider)) {
    return true
  }

  if (clientMeta.dataProxy && provider === 'sqlite') {
    return true
  }

  if (clientMeta.driverAdapter && ['mysql', 'postgresql'].includes(provider) === false) {
    return true
  }

  return excludedProviders.includes(provider)
}

function buildPlanContext(): SuitePlanContext {
  return {
    includedProviders: process.env.ONLY_TEST_PROVIDERS?.split(','),
    excludedProviders: getExcludedProviders(),
    updateSnapshots: process.env.UPDATE_SNAPSHOTS as 'inline' | 'external' | undefined,
  }
}

const excludeEnvToProviderMap = {
  TEST_SKIP_MONGODB: 'mongodb',
  TEST_SKIP_MSSQL: 'sqlserver',
  TEST_SKIP_COCKROACHDB: 'cockroachdb',
  TEST_SKIP_POSTGRESQL: 'postgresql',
  TEST_SKIP_SQLITE: 'sqlite',
}

function getExcludedProviders() {
  return Object.entries(excludeEnvToProviderMap).reduce((acc, [envVarName, provider]) => {
    if (process.env[envVarName]) {
      acc.push(provider)
    }
    return acc
  }, [] as string[])
}
