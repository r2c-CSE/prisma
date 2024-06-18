import { DatabaseCredentials } from '@prisma/internals'

const simpleUnixPathPattern = /^\.{0,2}\//

export function getSocketFromDatabaseCredentials(credentials: DatabaseCredentials): string | null {
  if (['postgres', 'postgresql', 'cockroachdb'].includes(credentials.type)) {
    const host = credentials.host

    if (typeof host === 'string' && simpleUnixPathPattern.test(host)) {
      return host
    }

    return null
  }

  return credentials.socket ?? null
}
