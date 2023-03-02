export type StoragePrimitive = boolean | string | number | bigint | Date | RegExp | StoragePrimitive[]

export type StorageType = boolean | string | number | bigint | Date | RegExp | Record<string, StoragePrimitive> |  StoragePrimitive[]

export type PersistentStorage = {
   get(keys: string | string[]): Promise<Record<string, StoragePrimitive>>
   set(items: Record<string, StoragePrimitive>): Promise<void>
   remove(keys: string | string[]): Promise<void>
}