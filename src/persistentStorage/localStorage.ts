import type { StoragePrimitive } from 'src/types/persistentStorage'

import * as Lockr from 'lockr'

export default {
   get: async <T = StoragePrimitive>(keys: string | string[]) => {
      if (!Array.isArray(keys)) {
         keys = [keys]
      }
      const result: Record<string, T> = {}
      keys.forEach(key => result[key] = Lockr.get<T>(key))
      return result
   },
   set: <T = StoragePrimitive>(items: Record<string, T>) =>
      Object.entries(items).forEach(([key, val]) =>
         Lockr.set(key, val as string | number | Object)
      ),
   remove: async (keys: string | string[]) => {
      if (typeof keys == 'string') {
         keys = [keys]
      }
      keys.forEach(key => Lockr.rm(key))
   }
}