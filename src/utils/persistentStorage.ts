// import chromeStorage from '$lib/services/persistentStorage/chrome'
// import browserStorage from '$lib/services/persistentStorage/browser'
import localStorage from 'src/persistentStorage/localStorage'
import { pushUnique } from 'ts-practical-fp'
import type { StoragePrimitive } from 'src/types/persistentStorage'
// import telegramStorage from '$lib/services/persistentStorage/telegram'

let instance: ReturnType<typeof lazyInstance>

// Create lazy instances to avoid trying to access global.browser and global.chrome during SSR
const lazyInstance = () => {
   // switch (import.meta.env.MODE) {
   //    case 'web': return localStorage
   //    case 'ext-chrome': return browserStorage() // chromeStorage()
   //    case 'telegram': return telegramStorage
   //    default: throw new Error('No persistent storage found for current platform!')
   // }
   return localStorage
}

const mkInstance = () => instance || (instance = lazyInstance())

export const persistentStorage = mkInstance

export const persistentArrayStorage = <T extends StoragePrimitive>(key: string) => ({
   get: () => mkInstance().get<T[]>(key).then(r => r?.[key] ?? []),
   set: (arr: T[]) => mkInstance().set({[key]: arr}),
   push: (item: T) => mkInstance().get<T[]>(key)
      .then(r => r?.[key] ?? [])
      .then(arr => mkInstance().set({[key]: Array.isArray(item) ? arr.push(item) : (pushUnique(item)(arr as (string | number | bigint | boolean | RegExp | Date)[]) ) })),
   clear: () => mkInstance().remove(key)
})