
export type CSLIterable<T> = {
   len(): number;
   get(index: number): T | undefined;
   add(elem: T): void;
   // free(): void
}


export const fromCslIterable = <T>(ts: CSLIterable<T>) => {
   const res = new Array<T>(ts.len())
   for(let i = 0; i < ts.len(); ++i) {
      res[i] = ts.get(i)!
   }
   return res
}

export const mapIterable = <T, R>(ts: CSLIterable<T>, f: (t: T) => R) => {
   const res = new Array<R>(ts.len())
   for(let i = 0; i < ts.len(); ++i) {
      res[i] = f(ts.get(i)!)
   }
   return res
}

export const foreachIterable = <T, R>(ts: CSLIterable<T>, f: (t: T) => void) => {
   for(let i = 0; i < ts.len(); ++i) {
      f(ts.get(i)!)
   }
}

export const toCslIterable0 = <T, Ts extends CSLIterable<T>>(Class: { new (): Ts }, ts: T[]) => {
   const csl = new Class()
   ts.forEach(t => csl.add(t))
   return csl
}

export const toCslIterable = <T, Ts extends CSLIterable<T>>(csl: Ts, ts: T[]) => {
   ts.forEach(t => csl.add(t))
   return csl
}

export const cslFilter0 = <T, Ts extends CSLIterable<T>>(Class: { new (): Ts }, pred: (t: T) => boolean, ts: CSLIterable<T>) => {
   const csl = new Class()
   for(let i = 0; i < ts.len(); ++i) {
      if (pred(ts.get(i)!)) {
         csl.add(ts.get(i)!)
      }
   }
   return csl
}

export const cslFilter = <T, Ts extends CSLIterable<T>>(csl: Ts, pred: (t: T) => boolean, ts: CSLIterable<T>) => {
   for(let i = 0; i < ts.len(); ++i) {
      if (pred(ts.get(i)!)) {
         csl.add(ts.get(i)!)
      }
   }
   return csl
}

export const addFrom = <T, Ts extends CSLIterable<T>>
   (target: {add(elem: T): void}, source: Ts) => {
      for(let i = 0; i < source.len(); ++i) {
         target.add(source.get(i)!)
      }
      return target
   }

export const appendIterable = <G, T, Ts extends CSLIterable<T>>(acc: G, a: G, getter: () => CSLIterable<T> | undefined, setter: (val: Ts) => void) => {
   if (getter.bind(a)()) {
      setter.bind(acc)( ((acc, a) => acc ? addFrom(acc, a) : a) (getter.bind(acc)(), getter.bind(a)()!) as Ts)
   }
}

export type CSLDictionary<K, V> = {
   len(): number;
   get(key: K): V | undefined;
   keys(): CSLIterable<K>;
   // free(): void
}

export const fromCslDictionary = <K, V>(ts: CSLDictionary<K, V>) => {
   const res = [] as [K, V][]
   const keys = ts.keys()
   for(let i = 0; i < keys.len(); ++i) {
      const k = keys.get(i)!
      res.push([k, ts.get(k)!]) 
   }
   return res
}