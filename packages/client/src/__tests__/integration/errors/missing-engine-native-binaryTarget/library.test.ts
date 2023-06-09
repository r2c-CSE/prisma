import { getNodeAPIName, getPlatform } from '@prisma/get-platform'
import { ClientEngineType, getClientEngineType } from '@prisma/internals'
import fs from 'fs'
import path from 'path'

import { generateTestClient } from '../../../../utils/getTestClient'

test('missing-engine-native-binaryTarget: library', async () => {
  if (getClientEngineType() !== ClientEngineType.Library) {
    return
  }

  expect.assertions(1)
  await generateTestClient()

  const { PrismaClient } = require('./node_modules/@prisma/client')

  const platform = await getPlatform()
  const binaryPath =
    getClientEngineType() === ClientEngineType.Library
      ? path.join(__dirname, 'node_modules/.prisma/client', getNodeAPIName(platform, 'fs'))
      : path.join(__dirname, 'node_modules/.prisma/client', `query-engine-${platform}`)
  fs.unlinkSync(binaryPath)
  const prisma = new PrismaClient({
    log: [
      {
        emit: 'event',
        level: 'query',
      },
    ],
  })

  await expect(async () => {
    await prisma.user.findMany()
  }).rejects.toThrowErrorMatchingInlineSnapshot(`

    Invalid \`prisma.user.findMany()\` invocation in
    /client/src/__tests__/integration/errors/missing-engine-native-binaryTarget/library.test.ts:0:0

      31 })
      32 
      33 await expect(async () => {
    → 34   await prisma.user.findMany(
    Prisma Client could not locate the Query Engine for runtime "TEST_PLATFORM".

    This is likely caused by tooling that has not copied "libquery_engine-TEST_PLATFORM.LIBRARY_TYPE.node" to the deployment folder.
    Ensure that you ran \`prisma generate\` and that "libquery_engine-TEST_PLATFORM.LIBRARY_TYPE.node" has been copied to "src/__tests__/integration/errors/missing-engine-native-binaryTarget/node_modules/.prisma/client".

    We would appreciate if you could take the time to share some information with us.
    Please help us by answering a few questions: https://pris.ly/engine-not-found-tooling-investigation

    The following locations have been searched:
      /client/src/__tests__/integration/errors/missing-engine-native-binaryTarget/node_modules/.prisma/client
      /client/src/__tests__/integration/errors/missing-engine-native-binaryTarget/node_modules/@prisma/client
      /client/src/__tests__/integration/errors/missing-engine-native-binaryTarget/node_modules/@prisma/client/runtime
      /tmp/prisma-engines
      /client/src/__tests__/integration/errors/missing-engine-native-binaryTarget
  `)
})
