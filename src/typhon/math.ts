import type { Value } from '@emurgo/cardano-serialization-lib-browser'
import BigNumber from 'bignumber.js'
import { string } from 'fp-ts'
import { comp, comp2 } from 'ts-practical-fp'
import { cslAssetsTyphonValue, cslValueAssets, cslValueFromTokens, toBigNum } from 'src/csl/value'
import { every } from 'fp-ts/lib/Array.js'
import type { AssetClass, Token, TokenClass, TyphonValue, TyphonValueLike } from 'src/typhon/api'
import type { Hex } from 'ts-binary-newtypes'
import { mapTyphonAmount, trimTyphonValue, typhonZeroValue } from './value'
import { valueTyphonToCSL } from 'src/csl/common'
import { valueCSLToTyphon } from './common'
import { assetClassUnit, unitAssetClass } from 'src/utils/token'

const policyIdLen = 56

export const zipTyphonAmount = <T>(f: (a: BigNumber, b: BigNumber) => T) => (a: TyphonValue, b: TyphonValue) => {
   const zero = new BigNumber(0)
   const units = new Set<string>()
   for (const t of a.tokens) {
      units.add(assetClassUnit(t))
   }
   for (const t of b.tokens) {
      units.add(assetClassUnit(t))
   }
   const tokenPred = (target: string) => (t: Token) =>
     target == assetClassUnit(t)
   const amountOrZero = (target: string, v: TyphonValue) =>
      v.tokens.find(tokenPred(target))?.amount ?? zero
   return {
      amount: f(a.amount, b.amount),
      tokens: Array.from(units).map(unit => ({
         ...unitAssetClass(unit) as TokenClass,
         amount: f(amountOrZero(unit, a), amountOrZero(unit, b))
      }))
   }
}

export const flattenTyphonValue = <T>(v: {
   amount: T,
   tokens: {
      policyId: Hex
      assetName: Hex
      amount: T;
  }[]
}) => [v.amount, ...v.tokens.map(t => t.amount)]

export const typhonAdd = comp2(zipTyphonAmount((a, b) => a.plus(b)) , trimTyphonValue)
export const typhonSub = comp2(zipTyphonAmount((a, b) => a.minus(b)), trimTyphonValue)
export const typhonNeg = mapTyphonAmount((a: BigNumber) => a.negated())
export const typhonAdds = (v: TyphonValue[]) => v.reduce(typhonAdd, typhonZeroValue())

export const comparedTyphonValue = (pred: 'GT' | 'LT' | 'EQ' | 'GEQ' | 'LEQ') => {
   const f = (() => {
      switch (pred) {
         case 'GT':  return (a: BigNumber, b: BigNumber) => a.gt(b)
         case 'LT':  return (a: BigNumber, b: BigNumber) => a.lt(b)
         case 'EQ':  return (a: BigNumber, b: BigNumber) => a.eq(b)
         case 'GEQ': return (a: BigNumber, b: BigNumber) => a.gte(b)
         case 'LEQ': return (a: BigNumber, b: BigNumber) => a.lte(b)
      }
   })()
   return comp2(zipTyphonAmount(f), comp(flattenTyphonValue, every(a => a)))
}
export const typhonEq = comparedTyphonValue('EQ')

export const typhonUpdateCoin = (f: (c: BigNumber) => BigNumber) => (value: TyphonValue) => ({
   amount: f(value.amount),
   tokens: value.tokens
})

export const cslAddTyphon = (a: Value, b: TyphonValue) => {
   const result = valueTyphonToCSL(typhonAdd(valueCSLToTyphon(a), b))
   if (!result) throw new Error('cslAddTyphon result is negative!')
   return result
}

export const cslSubTyphon = (a: Value, b: TyphonValue) => {
   const result = valueTyphonToCSL(typhonSub(valueCSLToTyphon(a), b))
   if (!result) throw new Error('cslSubTyphon result is negative!')
   return result
}