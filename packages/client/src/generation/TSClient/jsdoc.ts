import type { DMMF } from '@prisma/generator-helper'
import dedent from 'dedent'

import { capitalize, lowerCase } from '../../runtime/utils/common'
import { getGroupByArgsName, getModelArgName } from '../utils'

export interface JSDocMethodBodyCtx {
  name: string
  firstScalar: DMMF.Field | undefined
  method: string
  model: DMMF.Model
  action: DMMF.ModelAction
  mapping: DMMF.ModelMapping
}

const Docs = {
  cursor: `{@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}`,
  pagination: `{@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}`,
  aggregations: `{@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}`,
  distinct: `{@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}`,
  sorting: `{@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}`,
}

type JSDocsType = {
  [action in DMMF.ModelAction]: {
    body: (ctx: JSDocMethodBodyCtx) => string
    fields: {
      [field: string]: (name: string) => string
    }
  }
}

function addLinkToDocs(comment: string, docs: keyof typeof Docs) {
  return `${Docs[docs]}

${comment}`
}

function getDeprecationString(since: string, replacement: string) {
  return `@deprecated since ${since} please use \`${replacement}\``
}

const undefinedNote = `Note, that providing \`undefined\` is treated as the value not being there.
Read more here: https://pris.ly/d/null-undefined`

const JSDocFields = {
  take: (name) => addLinkToDocs(`Take \`±n\` '${name}' from the position of the cursor.`, 'pagination'),
  skip: (name) => addLinkToDocs(`Skip the first \`n\` '${name}'.`, 'pagination'),
  _count: (name) => addLinkToDocs(`Count returned '${name}'`, 'aggregations'),
  _avg: () => addLinkToDocs(`Select which fields to average`, 'aggregations'),
  _sum: () => addLinkToDocs(`Select which fields to sum`, 'aggregations'),
  _min: () => addLinkToDocs(`Select which fields to find the minimum value`, 'aggregations'),
  _max: () => addLinkToDocs(`Select which fields to find the maximum value`, 'aggregations'),
  count: () => getDeprecationString('2.23.0', '_count'),
  avg: () => getDeprecationString('2.23.0', '_avg'),
  sum: () => getDeprecationString('2.23.0', '_sum'),
  min: () => getDeprecationString('2.23.0', '_min'),
  max: () => getDeprecationString('2.23.0', '_max'),
  distinct: (name) => addLinkToDocs(`Filter by unique combinations of '${name}'.`, 'distinct'),
  orderBy: (name) => addLinkToDocs(`Determine the order of '${name}' to fetch.`, 'sorting'),
}

export const JSDocs: JSDocsType = {
  groupBy: {
    body: (ctx) => dedent`
      Group by '${ctx.name}'.
      ${undefinedNote}
      @param {${getGroupByArgsName(ctx.model.name)}} args - Group by arguments.
      @example
      // Group by city, order by createdAt, get count
      const result = await prisma.user.groupBy({
        by: ['city', 'createdAt'],
        orderBy: {
          createdAt: true
        },
        _count: {
          _all: true
        },
      })
    `,
    fields: {},
  },
  create: {
    body: (ctx) => dedent`
      Create '${ctx.name}'.
      @param {${getModelArgName(ctx.model.name, ctx.action)}} args - Arguments to create '${ctx.name}'.
      @example
      // Create one ${ctx.name}
      const ${ctx.name} = await ${ctx.method}({
        data: {
          // ... data to create '${ctx.name}'
        }
      })
    `,
    fields: {
      data: (name) => `The data needed to create '${name}'.`,
    },
  },
  createMany: {
    body: (ctx) => dedent`
      Create many '${ctx.name}'.
      @param {${getModelArgName(ctx.model.name, ctx.action)}} args - Arguments to create many '${ctx.name}'.
      @example
      // Create many '${ctx.name}'
      const results = await ${ctx.method}({
        data: {
          // ... provide data here
        }
      })
    `,
    fields: {
      data: (name) => `The data used to create many '${name}'.`,
    },
  },
  findUnique: {
    body: (ctx) => dedent`
      Returns ${ctx.name} that matches the filter or null if nothing is found
      @param {${getModelArgName(ctx.model.name, ctx.action)}} args - Arguments to find '${ctx.name}'
      @example
      // Get one ${ctx.name}
      const ${lowerCase(ctx.mapping.model)} = await ${ctx.method}({
        where: {
          // ... provide filter here
        }
      })
    `,
    fields: {
      where: (name) => `Filter, which ${name} to fetch.`,
    },
  },
  findFirst: {
    body: (ctx) => dedent`
      Find the first ${ctx.name} that matches the filter.
      ${undefinedNote}
      @param {${getModelArgName(ctx.model.name, ctx.action)}} args - Arguments to find '${ctx.name}'
      @example
      // Get one ${ctx.name}
      const ${lowerCase(ctx.mapping.model)} = await ${ctx.method}({
        where: {
          // ... provide filter here
        }
      })
    `,
    fields: {
      where: (name) => `Filter, which ${name} to fetch.`,
      orderBy: JSDocFields.orderBy,
      cursor: (name) => addLinkToDocs(`Sets the position for searching for '${name}'.`, 'cursor'),
      take: JSDocFields.take,
      skip: JSDocFields.skip,
      distinct: JSDocFields.distinct,
    },
  },
  findMany: {
    body: (ctx) => {
      const onlySelect = ctx.firstScalar
        ? `\n// Only select the \`${ctx.firstScalar.name}\`
const resultsWith${capitalize(ctx.firstScalar.name)}Only = await ${ctx.method}({ select: { ${
            ctx.firstScalar.name
          }: true } })`
        : ''

      return dedent`
        Find zero or more '${ctx.name}' that match the filter.
        ${undefinedNote}
        @param {${getModelArgName(
          ctx.model.name,
          ctx.action,
        )}=} args - Arguments to filter and select certain fields only.
        @example
        // Get all '${ctx.name}'
        const results = await ${ctx.method}()
                
        // Get first 10 '${ctx.name}'
        const results = await ${ctx.method}({ take: 10 })
        ${onlySelect}
      `
    },
    fields: {
      where: (name) => `Filter on '${name}'.`,
      orderBy: JSDocFields.orderBy,
      skip: JSDocFields.skip,
      cursor: (name) => addLinkToDocs(`Sets the position for listing '${name}'.`, 'cursor'),
      take: JSDocFields.take,
    },
  },
  update: {
    body: (ctx) => dedent`
      Update one ${ctx.name}.
      @param {${getModelArgName(ctx.model.name, ctx.action)}} args - Arguments to update one ${ctx.name}.
      @example
      // Update one ${ctx.name}
      const ${lowerCase(ctx.mapping.model)} = await ${ctx.method}({
        where: {
          // ... provide filter here
        },
        data: {
          // ... provide data here
        }
      })
    `,
    fields: {
      data: (name) => `The data needed to update '${name}'.`,
      where: (name) => `Choose, which ${name} to update.`,
    },
  },
  upsert: {
    body: (ctx) => dedent`
      Create or update one ${ctx.name}.
      @param {${getModelArgName(ctx.model.name, ctx.action)}} args - Arguments to update or create '${ctx.name}'.
      @example
      // Update or create '${ctx.name}'
      const ${lowerCase(ctx.mapping.model)} = await ${ctx.method}({
        create: {
          // ... data to create '${ctx.name}'
        },
        update: {
          // ... in case it already exists, update
        },
        where: {
          // ... the filter for the ${ctx.name} we want to update
        }
      })
    `,
    fields: {
      where: (name) => `The filter to search for the ${name} to update in case it exists.`,
      create: (name) =>
        `In case the ${name} found by the \`where\` argument doesn't exist, create a new ${name} with this data.`,
      update: (name) => `In case the ${name} was found with the provided \`where\` argument, update it with this data.`,
    },
  },
  delete: {
    body: (ctx) => dedent`
      Delete '${ctx.name}'.
      @param {${getModelArgName(ctx.model.name, ctx.action)}} args - Arguments to delete one ${ctx.name}.
      @example
      // Delete one ${ctx.name}
      await ${ctx.method}({
        where: {
          // ... filter to delete one ${ctx.name}
        }
      })
    `,
    fields: {
      where: (name) => `Filter which ${name} to delete.`,
    },
  },
  aggregate: {
    body: (ctx) => dedent`
      Allows you to perform aggregations operations on '${ctx.name}'.
      ${undefinedNote}
      @param {${getModelArgName(
        ctx.model.name,
        ctx.action,
      )}} args - Select which aggregations you would like to apply and on what fields.
      @example
      // Ordered by age ascending
      // Where email contains prisma.io
      // Limited to the 10 users
      const aggregations = await prisma.user.aggregate({
        _avg: {
          age: true,
        },
        where: {
          email: {
            contains: "prisma.io",
          },
        },
        orderBy: {
          age: "asc",
        },
        take: 10,
      })
    `,
    fields: {
      where: (name) => `Filter what '${name}' to aggregate.`,
      orderBy: JSDocFields.orderBy,
      cursor: () => addLinkToDocs(`Sets the start position`, 'cursor'),
      take: JSDocFields.take,
      skip: JSDocFields.skip,
      _count: JSDocFields._count,
      _avg: JSDocFields._avg,
      _sum: JSDocFields._sum,
      _min: JSDocFields._min,
      _max: JSDocFields._max,
      count: JSDocFields.count,
      avg: JSDocFields.avg,
      sum: JSDocFields.sum,
      min: JSDocFields.min,
      max: JSDocFields.max,
    },
  },
  count: {
    body: (ctx) => dedent`
      Count the number of '${ctx.name}'.
      ${undefinedNote}
      @param {${getModelArgName(ctx.model.name, ctx.action)}} args - Arguments to filter '${ctx.name}' to count.
      @example
      // Count the number of '${ctx.name}'
      const count = await ${ctx.method}({
        where: {
          // ... the filter for the '${ctx.name}' we want to count
        }
      })
    `,
    fields: {},
  },
  updateMany: {
    body: (ctx) => dedent`
      Update zero or more '${ctx.name}'.
      ${undefinedNote}
      @param {${getModelArgName(ctx.model.name, ctx.action)}} args - Arguments to update one or more rows.
      @example
      // Update many '${ctx.name}'
      const results = await ${ctx.method}({
        where: {
          // ... provide filter here
        },
        data: {
          // ... provide data here
        }
      })
    `,
    fields: {
      data: (name) => `The data used to update '${name}'.`,
      where: (name) => `Filter which '${name}' to update`,
    },
  },
  deleteMany: {
    body: (ctx) => dedent`
      Delete zero or more '${ctx.name}'.
      @param {${getModelArgName(ctx.model.name, ctx.action)}} args - Arguments to filter '${ctx.name}' to delete.
      @example
      // Delete a few '${ctx.name}'
      const { count } = await ${ctx.method}({
        where: {
          // ... provide filter here
        }
      })
    `,
    fields: {
      where: (name) => `Filter which '${name}' to delete`,
    },
  },
  aggregateRaw: {
    body: (ctx) => dedent`
      Perform aggregation operations on '${ctx.name}'.
      @param {${getModelArgName(ctx.model.name, ctx.action)}} args - Select which aggregations you would like to apply.
      @example
      const results = await ${ctx.method}({
        pipeline: [
          { $match: { status: "registered" } },
          { $group: { _id: "$country", total: { $sum: 1 } } }
        ]
      })
    `,
    fields: {
      pipeline: () =>
        'An array of aggregation stages to process and transform the document stream via the aggregation pipeline. ${@link https://docs.mongodb.com/manual/reference/operator/aggregation-pipeline MongoDB Docs}.',
      options: () =>
        'Additional options to pass to the `aggregate` command ${@link https://docs.mongodb.com/manual/reference/command/aggregate/#command-fields MongoDB Docs}.',
    },
  },
  findRaw: {
    body: (ctx) => dedent`
      Find zero or more '${ctx.name}' that matches the filter.
      @param {${getModelArgName(ctx.model.name, ctx.action)}} args - Select which filters you would like to apply.
      @example
      const results = await ${ctx.method}({
        filter: { age: { $gt: 25 } } 
      })
    `,
    fields: {
      filter: () =>
        'The query predicate filter. If unspecified, then all documents in the collection will match the predicate. ${@link https://docs.mongodb.com/manual/reference/operator/query MongoDB Docs}.',
      options: () =>
        'Additional options to pass to the `find` command ${@link https://docs.mongodb.com/manual/reference/command/find/#command-fields MongoDB Docs}.',
    },
  },
}
