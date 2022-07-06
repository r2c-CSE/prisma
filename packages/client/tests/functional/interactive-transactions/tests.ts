import { ClientEngineType, getClientEngineType } from '@prisma/internals'

import testMatrix from './_matrix'

// @ts-ignore this is just for type checks
declare let prisma: import('@prisma/client').PrismaClient
// @ts-ignore this is just for type checks
declare let PrismaClient: typeof import('@prisma/client').PrismaClient

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

testMatrix.setupTestSuite(({ provider }) => {
  // TODO: Technically, only "high concurrency" test requires larger timeout
  // but `jest.setTimeout` does not work inside of the test at the moment
  //  https://github.com/facebook/jest/issues/11543
  jest.setTimeout(60_000)

  beforeEach(async () => {
    await prisma.user.deleteMany()
  })

  /**
   * Minimal example of an interactive transaction
   */
  test('basic', async () => {
    const result = await prisma.$transaction(async (prisma) => {
      await prisma.user.create({
        data: {
          email: 'user_1@website.com',
        },
      })

      await prisma.user.create({
        data: {
          email: 'user_2@website.com',
        },
      })

      return prisma.user.findMany()
    })

    expect(result.length).toBe(2)
  })

  /**
   * Transactions should fail after the default timeout
   */
  test('timeout default', async () => {
    const result = prisma.$transaction(async (prisma) => {
      await prisma.user.create({
        data: {
          email: 'user_1@website.com',
        },
      })

      await delay(6000)
    })

    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(
      `Transaction API error: Transaction already closed: A commit cannot be executed on a closed transaction..`,
    )

    expect(await prisma.user.findMany()).toHaveLength(0)
  })

  /**
   * Transactions should fail if they time out on `timeout`
   */
  test('timeout override', async () => {
    const result = prisma.$transaction(
      async (prisma) => {
        await prisma.user.create({
          data: {
            email: 'user_1@website.com',
          },
        })

        await new Promise((res) => setTimeout(res, 600))
      },
      {
        maxWait: 200,
        timeout: 500,
      },
    )

    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(
      `Transaction API error: Transaction already closed: A commit cannot be executed on a closed transaction..`,
    )

    expect(await prisma.user.findMany()).toHaveLength(0)
  })

  /**
   * Transactions should fail and rollback if thrown within
   */
  test('rollback throw', async () => {
    const result = prisma.$transaction(async (prisma) => {
      await prisma.user.create({
        data: {
          email: 'user_1@website.com',
        },
      })

      throw new Error('you better rollback now')
    })

    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`you better rollback now`)

    const users = await prisma.user.findMany()

    expect(users.length).toBe(0)
  })

  /**
   * A transaction might fail if it's called inside another transaction
   * //! this works only for postgresql
   */
  testIf(provider === 'postgresql')('potgresql: nested create', async () => {
    const result = prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          email: 'user_1@website.com',
        },
      })

      await prisma.$transaction(async (tx) => {
        await tx.user.create({
          data: {
            email: 'user_2@website.com',
          },
        })
      })

      return tx.user.findMany()
    })

    await expect(result).resolves.toHaveLength(2)
  })

  /**
   * We don't allow certain methods to be called in a transaction
   */
  test('forbidden', async () => {
    const forbidden = ['$connect', '$disconnect', '$on', '$transaction', '$use']
    expect.assertions(forbidden.length + 1)

    const result = prisma.$transaction((prisma) => {
      for (const method of forbidden) {
        expect(prisma).not.toHaveProperty(method)
      }
      return Promise.resolve()
    })

    await expect(result).resolves.toBe(undefined)
  })

  /**
   * If one of the query fails, all queries should cancel
   */
  test('rollback query', async () => {
    const result = prisma.$transaction(async (prisma) => {
      await prisma.user.create({
        data: {
          email: 'user_1@website.com',
        },
      })

      await prisma.user.create({
        data: {
          email: 'user_1@website.com',
        },
      })
    })

    await expect(result).rejects.toThrowErrorMatchingSnapshot()

    const users = await prisma.user.findMany()

    expect(users.length).toBe(0)
  })

  test('already committed', async () => {
    let transactionBoundPrisma
    await prisma.$transaction((prisma) => {
      transactionBoundPrisma = prisma
      return Promise.resolve()
    })

    const result = prisma.$transaction(async () => {
      await transactionBoundPrisma.user.create({
        data: {
          email: 'user_1@website.com',
        },
      })
    })

    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`

            Invalid \`transactionBoundPrisma.user.create()\` invocation in
            /client/tests/functional/interactive-transactions/tests.ts:190:41

              187 })
              188 
              189 const result = prisma.$transaction(async () => {
            → 190   await transactionBoundPrisma.user.create(
              Transaction API error: Transaction already closed: A query cannot be executed on a closed transaction..
          `)

    const users = await prisma.user.findMany()

    expect(users.length).toBe(0)
  })

  /**
   * Batching should work with using the interactive transaction logic
   */
  test('batching', async () => {
    await prisma.$transaction([
      prisma.user.create({
        data: {
          email: 'user_1@website.com',
        },
      }),
      prisma.user.create({
        data: {
          email: 'user_2@website.com',
        },
      }),
    ])

    const users = await prisma.user.findMany()

    expect(users.length).toBe(2)
  })

  /**
   * A bad batch should rollback using the interactive transaction logic
   * // TODO: skipped because output differs from binary to library
   */
  testIf(getClientEngineType() === ClientEngineType.Library)('batching rollback', async () => {
    const result = prisma.$transaction([
      prisma.user.create({
        data: {
          email: 'user_1@website.com',
        },
      }),
      prisma.user.create({
        data: {
          email: 'user_1@website.com',
        },
      }),
    ])

    await expect(result).rejects.toThrowErrorMatchingSnapshot()

    const users = await prisma.user.findMany()

    expect(users.length).toBe(0)
  })

  /**
   * A bad batch should rollback using the interactive transaction logic
   * // TODO: skipped because output differs from binary to library
   */
  testIf(getClientEngineType() === ClientEngineType.Library && provider !== 'mongodb')(
    'batching raw rollback',
    async () => {
      await prisma.user.create({
        data: {
          id: '1',
          email: 'user_1@website.com',
        },
      })

      const result =
        provider === 'mysql'
          ? prisma.$transaction([
              // @ts-test-if: provider !== 'mongodb'
              prisma.$executeRaw`INSERT INTO User (id, email) VALUES (${'2'}, ${'user_2@website.com'})`,
              // @ts-test-if: provider !== 'mongodb'
              prisma.$queryRaw`DELETE FROM User`,
              // @ts-test-if: provider !== 'mongodb'
              prisma.$executeRaw`INSERT INTO User (id, email) VALUES (${'1'}, ${'user_1@website.com'})`,
              // @ts-test-if: provider !== 'mongodb'
              prisma.$executeRaw`INSERT INTO User (id, email) VALUES (${'1'}, ${'user_1@website.com'})`,
            ])
          : prisma.$transaction([
              // @ts-test-if: provider !== 'mongodb'
              prisma.$executeRaw`INSERT INTO "User" (id, email) VALUES (${'2'}, ${'user_2@website.com'})`,
              // @ts-test-if: provider !== 'mongodb'
              prisma.$queryRaw`DELETE FROM "User"`,
              // @ts-test-if: provider !== 'mongodb'
              prisma.$executeRaw`INSERT INTO "User" (id, email) VALUES (${'1'}, ${'user_1@website.com'})`,
              // @ts-test-if: provider !== 'mongodb'
              prisma.$executeRaw`INSERT INTO "User" (id, email) VALUES (${'1'}, ${'user_1@website.com'})`,
            ])

      await expect(result).rejects.toThrowErrorMatchingSnapshot()

      const users = await prisma.user.findMany()

      expect(users.length).toBe(1)
    },
  )

  // running this test on isolated prisma instance since
  // middleware change the return values of model methods
  // and this would affect subsequent tests if run on a main instance
  describe('middlewares', () => {
    let isolatedPrisma: typeof prisma

    beforeEach(() => {
      isolatedPrisma = new PrismaClient()
    })

    afterEach(async () => {
      await isolatedPrisma.$disconnect()
    })

    /**
     * Minimal example of a interactive transaction & middleware
     */
    test('middleware basic', async () => {
      let runInTransaction = false

      isolatedPrisma.$use(async (params, next) => {
        await next(params)

        runInTransaction = params.runInTransaction

        return 'result'
      })

      const result = await isolatedPrisma.$transaction((prisma) => {
        return prisma.user.create({
          data: {
            email: 'user_1@website.com',
          },
        })
      })

      expect(result).toBe('result')
      expect(runInTransaction).toBe(true)
    })

    /**
     * Middlewares should work normally on batches
     */
    test('middlewares batching', async () => {
      isolatedPrisma.$use(async (params, next) => {
        const result = await next(params)

        return result
      })

      await isolatedPrisma.$transaction([
        prisma.user.create({
          data: {
            email: 'user_1@website.com',
          },
        }),
        prisma.user.create({
          data: {
            email: 'user_2@website.com',
          },
        }),
      ])

      const users = await prisma.user.findMany()

      expect(users.length).toBe(2)
    })
  })

  /**
   * Two concurrent transactions should work
   */
  test('concurrent', async () => {
    await Promise.all([
      prisma.$transaction([
        prisma.user.create({
          data: {
            email: 'user_1@website.com',
          },
        }),
      ]),
      prisma.$transaction([
        prisma.user.create({
          data: {
            email: 'user_2@website.com',
          },
        }),
      ]),
    ])

    const users = await prisma.user.findMany()

    expect(users.length).toBe(2)
  })

  /**
   * Makes sure that the engine does not deadlock
   * For sqlite, it sometimes causes DB lock up and all subsequent
   * tests fail. We might want to re-enable it either after we implemented
   * WAL mode (https://github.com/prisma/prisma/issues/3303) or identified the
   * issue on our side
   */
  testIf(provider !== 'sqlite')('high concurrency', async () => {
    jest.setTimeout(30_000)

    await prisma.user.create({
      data: {
        email: 'x',
        name: 'y',
      },
    })

    for (let i = 0; i < 5; i++) {
      await Promise.allSettled([
        prisma.$transaction((tx) => tx.user.update({ data: { name: 'a' }, where: { email: 'x' } }), { timeout: 25 }),
        prisma.$transaction((tx) => tx.user.update({ data: { name: 'b' }, where: { email: 'x' } }), { timeout: 25 }),
        prisma.$transaction((tx) => tx.user.update({ data: { name: 'c' }, where: { email: 'x' } }), { timeout: 25 }),
        prisma.$transaction((tx) => tx.user.update({ data: { name: 'd' }, where: { email: 'x' } }), { timeout: 25 }),
        prisma.$transaction((tx) => tx.user.update({ data: { name: 'e' }, where: { email: 'x' } }), { timeout: 25 }),
        prisma.$transaction((tx) => tx.user.update({ data: { name: 'f' }, where: { email: 'x' } }), { timeout: 25 }),
        prisma.$transaction((tx) => tx.user.update({ data: { name: 'g' }, where: { email: 'x' } }), { timeout: 25 }),
        prisma.$transaction((tx) => tx.user.update({ data: { name: 'h' }, where: { email: 'x' } }), { timeout: 25 }),
        prisma.$transaction((tx) => tx.user.update({ data: { name: 'i' }, where: { email: 'x' } }), { timeout: 25 }),
        prisma.$transaction((tx) => tx.user.update({ data: { name: 'j' }, where: { email: 'x' } }), { timeout: 25 }),
      ]).catch(() => {}) // we don't care for errors, there will be
    }
  })

  /**
   * Rollback should happen even with `then` calls
   */
  test('rollback with then calls', async () => {
    const result = prisma.$transaction(async (prisma) => {
      await prisma.user
        .create({
          data: {
            email: 'user_1@website.com',
          },
        })
        .then()

      await prisma.user
        .create({
          data: {
            email: 'user_2@website.com',
          },
        })
        .then()
        .then()

      throw new Error('rollback')
    })

    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`rollback`)

    const users = await prisma.user.findMany()

    expect(users.length).toBe(0)
  })

  /**
   * Rollback should happen even with `catch` calls
   */
  test('rollback with catch calls', async () => {
    const result = prisma.$transaction(async (prisma) => {
      await prisma.user
        .create({
          data: {
            email: 'user_1@website.com',
          },
        })
        .catch()
      await prisma.user
        .create({
          data: {
            email: 'user_2@website.com',
          },
        })
        .catch()
        .then()

      throw new Error('rollback')
    })

    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`rollback`)

    const users = await prisma.user.findMany()

    expect(users.length).toBe(0)
  })

  /**
   * Rollback should happen even with `finally` calls
   */
  test('rollback with finally calls', async () => {
    const result = prisma.$transaction(async (prisma) => {
      await prisma.user
        .create({
          data: {
            email: 'user_1@website.com',
          },
        })
        .finally()

      await prisma.user
        .create({
          data: {
            email: 'user_2@website.com',
          },
        })
        .then()
        .catch()
        .finally()

      throw new Error('rollback')
    })

    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`rollback`)

    const users = await prisma.user.findMany()

    expect(users.length).toBe(0)
  })

  /**
   * Makes sure that the engine can process when the transaction has locks inside
   * Engine PR - https://github.com/prisma/prisma-engines/pull/2811
   * Issue - https://github.com/prisma/prisma/issues/11750
   */
  testIf(provider === 'postgresql')('high concurrency with SET FOR UPDATE', async () => {
    jest.setTimeout(60_000)
    const CONCURRENCY = 12

    await prisma.user.create({
      data: {
        email: 'x',
        name: 'y',
        val: 1,
      },
    })

    const promises = [...Array(CONCURRENCY)].map(() =>
      prisma.$transaction(
        async (transactionPrisma) => {
          // @ts-test-if: provider !== 'mongodb'
          await transactionPrisma.$queryRaw`SELECT id from "User" where email = 'x' FOR UPDATE`

          const user = await transactionPrisma.user.findUnique({
            rejectOnNotFound: true,
            where: {
              email: 'x',
            },
          })

          // Add a delay here to force the transaction to be open for longer
          // this will increase the chance of deadlock in the itx transactions
          // if deadlock is a possiblity.
          await delay(100)

          const updatedUser = await transactionPrisma.user.update({
            where: {
              email: 'x',
            },
            data: {
              val: user.val! + 1,
            },
          })

          return updatedUser
        },
        { timeout: 60000, maxWait: 60000 },
      ),
    )

    await Promise.allSettled(promises)

    const finalUser = await prisma.user.findUnique({
      rejectOnNotFound: true,
      where: {
        email: 'x',
      },
    })

    expect(finalUser.val).toEqual(CONCURRENCY + 1)
  })
})
