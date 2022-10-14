import testMatrix from './_matrix'
import { setup } from './_setup'
// @ts-ignore
import type { PrismaClient } from './node_modules/@prisma/client'

declare let prisma: PrismaClient

let vars: Awaited<ReturnType<typeof setup>>
testMatrix.setupTestSuite(() => {
  beforeAll(async () => {
    vars = await setup(prisma)
  })

  test('findUniqueOrThrow with where 1 unique (PK)', async () => {
    await prisma.user.findUniqueOrThrow({
      where: {
        id: vars.userId,
      },
    })
  })

  test('findUniqueOrThrow with where 2 uniques (PK & non-PK)', async () => {
    await prisma.post.findUniqueOrThrow({
      where: {
        id: vars.postId1,
        title: 'Hello World 1',
      },
    })
  })

  test('finUniqueOrThrow with where 1 unique (non-PK)', async () => {
    await prisma.post.findUniqueOrThrow({
      where: {
        title: 'Hello World 1',
      },
    })
  })
})
