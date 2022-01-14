import type { Client } from '../../getPrismaClient'
import { applyModel } from './applyModel'
import { dmmfToJSModelName } from './utils/dmmfToJSModelName'
import { jsToDMMFModelName } from './utils/jsToDMMFModelName'

/**
 * Dynamically creates a model proxy interface for a give name. For each prop
 * accessed on this proxy, it will lookup the dmmf to find if that model exists.
 * If it is the case, it will create a proxy for that model via {@link applyModel}.
 * @param client to create the proxy around
 * @returns a proxy to access models
 */
export function applyModels<C extends Client>(client: C) {
  // we don't want to create a new proxy on each prop access
  const modelCache = {} as { [key: string]: object }
  const ownKeys = getOwnKeys(client)

  return new Proxy(client, {
    get(target, prop: string) {
      const dmmfModelName = jsToDMMFModelName(prop)

      // see if a model proxy has already been created before
      if (modelCache[dmmfModelName] !== undefined) {
        return modelCache[dmmfModelName]
      }

      // creates a new model proxy on the fly and caches it
      if (client._dmmf.modelMap[dmmfModelName] !== undefined) {
        return (modelCache[dmmfModelName] = applyModel(client, dmmfModelName))
      }

      // above just failed if the model name is lower cased
      if (client._dmmf.modelMap[prop] !== undefined) {
        return (modelCache[dmmfModelName] = applyModel(client, prop))
      }

      return target[prop] // returns the base client prop
    },
    has: (_, prop: string) => ownKeys.includes(prop),
    ownKeys: () => ownKeys,
  })
}

// the only accessible fields are the ones that are models
function getOwnKeys(client: Client) {
  return [...Object.keys(client._dmmf.modelMap).map(dmmfToJSModelName), ...Object.keys(client)]
}
