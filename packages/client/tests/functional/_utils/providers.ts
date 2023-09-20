export enum Providers {
  SQLITE = 'sqlite',
  POSTGRESQL = 'postgresql',
  MYSQL = 'mysql',
  MONGODB = 'mongodb',
  COCKROACHDB = 'cockroachdb',
  SQLSERVER = 'sqlserver',
}

export enum ProviderFlavors {
  JS_PG = 'js_pg',
  JS_PLANETSCALE = 'js_planetscale',
  JS_NEON = 'js_neon',
  VITESS_8 = 'vitess_8',
}

export type AllProviders = { provider: Providers }[]

export const allProviders: AllProviders = Object.values(Providers).map((p) => ({ provider: p }))
