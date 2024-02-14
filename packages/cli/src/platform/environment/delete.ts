import { arg, Command, isError } from '@prisma/internals'

import { messages } from '../_lib/messages'
import { getRequiredParameterOrThrow } from '../_lib/parameters'
import { requestOrThrow } from '../_lib/pdp'
import { getTokenOrThrow, platformParameters } from '../_lib/utils'

export class Delete implements Command {
  public static new(): Delete {
    return new Delete()
  }

  public async parse(argv: string[]) {
    const args = arg(argv, {
      ...platformParameters.environment,
    })
    if (isError(args)) return args
    const token = await getTokenOrThrow(args)
    const environmentId = getRequiredParameterOrThrow(args, ['--environment', '-e'])
    const { environmentDelete } = await requestOrThrow<
      {
        environmentDelete: {
          __typename: string
          id: string
          createdAt: string
          displayName: string
        }
      },
      {
        id: string
      }
    >({
      token,
      body: {
        query: /* graphql */ `
          mutation ($input: { $id: ID! }) {
            environmentDelete(input: $input) {
              __typename
              ...on Error {
                message
              }
              ...on Environment {
                id
                createdAt
                displayName
              }
            }
          }
        `,
        variables: {
          input: {
            id: environmentId,
          },
        },
      },
    })
    return messages.resourceDeleted(environmentDelete)
  }
}
