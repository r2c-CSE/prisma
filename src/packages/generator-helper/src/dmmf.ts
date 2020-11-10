
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace DMMF {
  export interface Document {
    datamodel: Datamodel
    schema: Schema
    mappings: Mappings
  }

  export interface Mappings {
    modelOperations: ModelMapping[]
    otherOperations: {
      read: string[]
      write: string[]
    }
  }

  export interface OtherOperationMappings {
    read: string[]
    write: string[]
  }

  export interface DatamodelEnum {
    name: string
    values: EnumValue[]
    dbName?: string | null
    documentation?: string
  }

  export interface SchemaEnum {
    name: string
    values: string[]
  }

  export interface EnumValue {
    name: string
    dbName: string | null
  }

  export interface Datamodel {
    models: Model[]
    enums: DatamodelEnum[]
  }

  export interface uniqueIndex {
    name: string
    fields: string[]
  }

  export interface Model {
    name: string
    isEmbedded: boolean
    dbName: string | null
    fields: Field[]
    fieldMap?: Record<string, Field>
    uniqueFields: string[][]
    uniqueIndexes: uniqueIndex[]
    documentation?: string
    idFields: string[]
    [key: string]: any // safe net for additional new props
  }

  export type FieldKind = 'scalar' | 'object' | 'enum'

  export type InputFieldNamespace = 'model' | 'prisma'
  export type InputFieldLocation = 'scalar' | 'inputObjectTypes' | 'outputObjectTypes' | 'enumTypes'

  export interface Field {
    kind: FieldKind
    name: string
    isRequired: boolean
    isList: boolean
    isUnique: boolean
    isId: boolean
    type: string
    dbNames?: string[] | null
    isGenerated: boolean
    hasDefaultValue: boolean
    default?: FieldDefault | string | boolean | number
    relationToFields?: any[]
    relationOnDelete?: string
    relationName?: string
    documentation?: string
    [key: string]: any // safe net for additional new props
  }

  export interface FieldDefault {
    name: string
    args: any[]
  }

  export interface Schema {
    rootQueryType?: string
    rootMutationType?: string
    inputObjectTypes: {
      model?: InputType[]
      prisma: InputType[]
    }
    outputObjectTypes: {
      model: OutputType[]
      prisma: OutputType[]
    }
    enums: {
      model?: SchemaEnum[]
      prisma: SchemaEnum[]
    }
  }

  export interface Query {
    name: string
    args: SchemaArg[]
    output: QueryOutput
  }

  export interface QueryOutput {
    name: string
    isRequired: boolean
    isList: boolean
  }

  export type ArgType = string | InputType | SchemaEnum

  export interface SchemaArgInputType {
    isList: boolean
    type: ArgType
    location: InputFieldLocation
    namespace?: InputFieldNamespace
  }

  export interface SchemaArg {
    name: string
    comment?: string
    isNullable: boolean
    isRequired: boolean
    inputTypes: SchemaArgInputType[]
  }

  export interface OutputType {
    name: string
    fields: SchemaField[]
    fieldMap?: Record<string, SchemaField>
    isEmbedded?: boolean
  }

  export interface SchemaField {
    name: string
    isRequired: boolean
    isNullable?: boolean
    outputType: {
      type: string | OutputType | SchemaEnum // note that in the serialized state we don't have the reference to MergedOutputTypes
      isList: boolean
      kind: FieldKind
    }
    args: SchemaArg[]
  }

  export interface InputType {
    name: string
    constraints: {
      maxNumFields: number | null
      minNumFields: number | null
    }
    fields: SchemaArg[]
    fieldMap?: Record<string, SchemaArg>
  }

  export interface ModelMapping {
    model: string
    plural: string
    findOne?: string | null
    findFirst?: string | null
    findMany?: string | null
    create?: string | null
    update?: string | null
    updateMany?: string | null
    upsert?: string | null
    delete?: string | null
    deleteMany?: string | null
    aggregate?: string | null
  }

  export enum ModelAction {
    findOne = 'findOne',
    findFirst = 'findFirst',
    findMany = 'findMany',
    create = 'create',
    update = 'update',
    updateMany = 'updateMany',
    upsert = 'upsert',
    delete = 'delete',
    deleteMany = 'deleteMany',
  }
}
