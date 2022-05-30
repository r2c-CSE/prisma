import { PrismaClientInitializationError } from '@prisma/engine-core'

import testMatrix from './_matrix'

// @ts-ignore this is just for type checks
declare let prisma: import('@prisma/client').PrismaClient

testMatrix.setupTestSuite(
  () => {
    test('should assert that the error has the correct errorCode', async () => {
      expect.assertions(2)

      try {
        await prisma.$connect()
      } catch (error) {
        const e = error as PrismaClientInitializationError
        expect(e.constructor.name).toEqual('PrismaClientInitializationError')
        expect(e.errorCode).toEqual('P1001')
      } finally {
        prisma.$disconnect().catch(() => {})
      }
    })
  },
  { skipDb: true }, // So we can maually call connect for this test
)
