import path from 'node:path'

import { jestConsoleContext, jestContext } from '@prisma/get-platform'
import { extractSchemaContent, getSchemaWithPath } from '@prisma/internals'
import fs from 'fs-jetpack'

import { Format } from '../../Format'
import { Validate } from '../../Validate'

const ctx = jestContext.new().add(jestConsoleContext()).assemble()

const originalEnv = { ...process.env }

describe('format', () => {
  beforeEach(() => {
    process.env = { ...originalEnv }
  })
  afterAll(() => {
    process.env = { ...originalEnv }
  })

  describe('multi-schema-files with `prismaSchemaFolder`', () => {
    describe('valid schemas', () => {
      it('should prefer single file to the multi-schema alternatives', async () => {
        ctx.fixture('multi-schema-files/valid')
        expect(ctx.tree()).toMatchInlineSnapshot(`
          "
          └── prisma/
              └── schema/
                  └── schema1.prisma
                  └── schema2.prisma
              └── custom.prisma
              └── schema.prisma
          └── custom.prisma
          └── schema.prisma
          "
        `)

        // implicit: single schema file (`schema.prisma`)
        await expect(Format.new().parse([])).resolves.toMatchInlineSnapshot(`"Formatted schema.prisma in XXXms 🚀"`)

        await expect(Format.new().parse(['--check'])).resolves.toMatchInlineSnapshot(
          `"All files are formatted correctly!"`,
        )

        // explicit: single schema file (`schema.prisma`)
        await expect(Format.new().parse(['--schema=schema.prisma'])).resolves.toMatchInlineSnapshot(
          `"Formatted schema.prisma in XXXms 🚀"`,
        )

        // explicit: single schema file (`custom.prisma`)
        await expect(Format.new().parse(['--schema=custom.prisma'])).resolves.toMatchInlineSnapshot(
          `"Formatted custom.prisma in XXXms 🚀"`,
        )

        // explicit: single schema file (`prisma/custom.prisma`)
        await expect(Format.new().parse(['--schema=prisma/custom.prisma'])).resolves.toMatchInlineSnapshot(
          `"Formatted prisma/custom.prisma in XXXms 🚀"`,
        )

        // explicit: multi schema files with `prismaSchemaFolder` enabled
        await expect(Format.new().parse(['--schema=prisma/schema'])).resolves.toMatchInlineSnapshot(
          `"Formatted prisma/schema in XXXms 🚀"`,
        )

        await ctx.fs.removeAsync('schema.prisma')
        expect(ctx.tree()).toMatchInlineSnapshot(`
          "
          └── prisma/
              └── schema/
                  └── schema1.prisma
                  └── schema2.prisma
              └── custom.prisma
              └── schema.prisma
          └── custom.prisma
          "
        `)

        // implicit: conflict between folder and file
        await expect(Format.new().parse([])).rejects.toThrowErrorMatchingInlineSnapshot(
          `"Found Prisma Schemas at both \`prisma/schema.prisma\` and \`prisma/schema\`. Please remove one."`,
        )

        await ctx.fs.removeAsync(path.join('prisma', 'schema.prisma'))
        expect(ctx.tree()).toMatchInlineSnapshot(`
          "
          └── prisma/
              └── schema/
                  └── schema1.prisma
                  └── schema2.prisma
              └── custom.prisma
          └── custom.prisma
          "
        `)

        // implicit: multi schema files with `prismaSchemaFolder` enabled
        await expect(Format.new().parse([])).resolves.toMatchInlineSnapshot(`"Formatted prisma/schema in XXXms 🚀"`)
      })
    })

    describe('invalid schemas', () => {
      it('reports error when schemas when the config blocks (`generator`, `datasource`) are invalid', async () => {
        ctx.fixture('multi-schema-files/invalid/invalid_config_blocks')

        // - `prisma/schema/config.prisma` is invalid (it contains invalid attributes)
        // - `prisma/schema/schema.prisma` is valid
        expect(ctx.tree()).toMatchInlineSnapshot(`
          "
          └── prisma/
              └── schema/
                  └── config.prisma
                  └── schema.prisma
          "
        `)

        await expect(Format.new().parse([])).rejects.toThrowErrorMatchingInlineSnapshot(`
          "Prisma schema validation - (get-config wasm)
          Error code: P1012
          error: Property not known: "custom".
            -->  prisma/schema/config.prisma:8
             | 
           7 |   provider = "sqlite"
           8 |   custom   = "attr"
             | 

          Validation Error Count: 1
          [Context: getConfig]

          Prisma CLI Version : 0.0.0"
        `)
      })

      it('should throw when both schema file and folder exist (even when invalid)', async () => {
        ctx.fixture('multi-schema-files/invalid/default_schema_invalid-multi_schema_valid')
        expect(ctx.tree()).toMatchInlineSnapshot(`
          "
          └── prisma/
              └── schema/
                  └── schema1.prisma
                  └── schema2.prisma
                  └── skip.txt
              └── schema.prisma
          "
        `)

        // implicit: single schema file (`prisma/schema.prisma`)
        await expect(Format.new().parse([])).rejects.toThrowErrorMatchingInlineSnapshot(
          `"Found Prisma Schemas at both \`prisma/schema.prisma\` and \`prisma/schema\`. Please remove one."`,
        )

        await ctx.fs.removeAsync(path.join('prisma', 'schema.prisma'))
        expect(ctx.tree()).toMatchInlineSnapshot(`
          "
          └── prisma/
              └── schema/
                  └── schema1.prisma
                  └── schema2.prisma
                  └── skip.txt
          "
        `)

        // implicit: multi schema files (`prisma/schema`)
        await expect(Format.new().parse([])).resolves.toMatchInlineSnapshot(`"Formatted prisma/schema in XXXms 🚀"`)
      })

      it('fixes invalid relations across multiple schema files', async () => {
        ctx.fixture('multi-schema-files/invalid/relations')

        // - `prisma/schema/schema1.prisma` is invalid (its model lacks a backrelation to the model in the other file)
        // - `prisma/schema/schema2.prisma` is valid
        expect(ctx.tree()).toMatchInlineSnapshot(`
          "
          └── prisma/
              └── schema/
                  └── schema1.prisma
                  └── schema2.prisma
                  └── skip.txt
          "
        `)

        await expect(Validate.new().parse([])).rejects.toMatchInlineSnapshot(`
          "Prisma schema validation - (validate wasm)
          Error code: P1012
          error: Error validating field \`user\` in model \`Link\`: The relation field \`user\` on model \`Link\` is missing an opposite relation field on the model \`User\`. Either run \`prisma format\` or add it manually.
            -->  prisma/schema/schema2.prisma:7
             | 
           6 |   shortUrl  String
           7 |   user      User?    @relation(fields: [userId], references: [id])
           8 |   userId    String?
             | 

          Validation Error Count: 1
          [Context: validate]

          Prisma CLI Version : 0.0.0"
        `)
        await expect(Format.new().parse([])).resolves.toMatchInlineSnapshot(`"Formatted prisma/schema in XXXms 🚀"`)
        await expect(Validate.new().parse([])).resolves.toMatchInlineSnapshot(
          `"The schemas at prisma/schema are valid 🚀"`,
        )

        const { schemas } = (await getSchemaWithPath())!

        // notice how the `Link` backrelation was added in the first schema file:
        expect(extractSchemaContent(schemas)).toMatchInlineSnapshot(`
          [
            "generator client {
            provider        = "prisma-client-js"
            previewFeatures = ["prismaSchemaFolder"]
          }

          datasource db {
            provider = "sqlite"
            url      = "file:dev.db"
          }

          model User {
            id        String    @id @default(uuid())
            createdAt DateTime  @default(now())
            updatedAt DateTime  @updatedAt
            name      String?
            email     String    @unique
            date      DateTime?
            // missing Link[]
            Link      Link[]
          }
          ",
            "model Link {
            id        String   @id @default(uuid())
            createdAt DateTime @default(now())
            updatedAt DateTime @updatedAt
            url       String
            shortUrl  String
            user      User?    @relation(fields: [userId], references: [id])
            userId    String?
          }
          ",
          ]
        `)
      })
    })
  })

  it('should add a trailing EOL', async () => {
    ctx.fixture('example-project/prisma')
    await Format.new().parse([])
    expect(fs.read('schema.prisma')).toMatchSnapshot()
  })

  it('should add missing backrelation', async () => {
    ctx.fixture('example-project/prisma')
    await Format.new().parse(['--schema=missing-backrelation.prisma'])
    expect(fs.read('missing-backrelation.prisma')).toMatchSnapshot()
  })

  it('should succeed if schema is broken', async () => {
    ctx.fixture('example-project/prisma')
    await expect(Format.new().parse(['--schema=broken.prisma'])).resolves.toMatchInlineSnapshot(
      `"Formatted broken.prisma in XXXms 🚀"`,
    )
  })

  it('check should fail on unformatted code', async () => {
    ctx.fixture('example-project/prisma-unformatted')
    await expect(Format.new().parse(['--schema=unformatted.prisma', '--check'])).resolves.toMatchInlineSnapshot(
      `"! There are unformatted files. Run prisma format to format them."`,
    )
  })
})
