import { PrismaClient } from './@prisma/client'

const prisma = new PrismaClient({
  rejectOnNotFound: {
    findFirst: {
      User: true,
      Post: true,
    }
  },
  log: [{
    emit: 'event', level:"query"
  }]
})

async function main() {
  prisma.$on('query', () => {})
  const res = await prisma.user.findFirst({
    where: {
      id: 'asdaf',
    },
    rejectOnNotFound: new Error('Home')
  })
  // console.log(res);
  // const res = await prisma.user.findUnique({
  //   where: {
  //     email: 'prisma@prisma.de'
  //   },
  //   rejectOnEmpty: true
  // })

  // console.log(res)

  prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  prisma.$disconnect()
})
