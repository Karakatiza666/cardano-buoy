import BigNumber from "bignumber.js";
import { upsertUniqueOn } from "ts-practical-fp";
import type { Hex } from "ts-binary-newtypes";
import { tuple } from "ts-practical-fp";
import type { Token, TokenClass, TyphonValue, TyphonValueLike } from "src/typhon/api";

const tokenKey = (t: TokenClass) => t.policyId + t.assetName
const tokenPred = (a: TokenClass) => (b: TokenClass) => tokenKey(a) == tokenKey(b)
export const typhonValueToken = (target: TokenClass, value: TyphonValue) =>
   value.tokens.find(tokenPred(target)) ?? {...target, amount: new BigNumber(0)}



export const typhonCoinValue = (coin: BigNumber): TyphonValue => ({ amount: coin, tokens: []})
export const typhonZeroValue = (tokens?: Token[]) => typhonValue(new BigNumber(0), tokens)
export const typhonValue = (coin: BigNumber, tokens?: Token[]) => ({ amount: coin, tokens: tokens ?? [] })


export const mapTyphonAmount = <A, T>(f: (v: A) => T) => (v: TyphonValueLike<A>): TyphonValueLike<T> => ({
   amount: f(v.amount),
   tokens: v.tokens.map(t => ({...t, amount: f(t.amount)}))
})

export const mapTyphonValue = <T extends TyphonValue>
   (f: (v: TyphonValue) => TyphonValue) => (v: T): T => ({
   ...v,
   ...f(v)
})

// Set new amount of token in a value
export const replaceTyphonToken = (token: Token, value: TyphonValue): TyphonValue => ({
   amount: value.amount,
   tokens: upsertUniqueOn(tokenKey, token)(value.tokens)
   // tokens: value.tokens.map(t => {
   //    if (tokenKey(token) == tokenKey(t)) {
   //       return {...token}
   //    }
   //    return t
   // })
})

// Negative tokens have negative amounts
export const partitionTyphon = (value: TyphonValue) => {
   const pairs = mapTyphonAmount((a: BigNumber) => a.lt(0) ? tuple(a, new BigNumber(0)) : tuple(new BigNumber(0), a) )(value)
   // console.log('partitionTyphon', mapTyphonAmount((a: [BigNumber, BigNumber]) => `${a[0].toFixed()} : ${a[1].toFixed()}`)(pairs))
   const neg = trimTyphonValue(mapTyphonAmount((a: [BigNumber, BigNumber]) => a[0])(pairs))
   const pos = trimTyphonValue(mapTyphonAmount((a: [BigNumber, BigNumber]) => a[1])(pairs))
   return { neg, pos }
}

export const filterTyphonTokens = <T>(pred: (a: T) => boolean) => (value: TyphonValueLike<T>) =>
   ({ amount: value.amount, tokens: value.tokens.filter(({amount}) => pred(amount)) })

export const trimTyphonValue: ((value: TyphonValue) => TyphonValue) = filterTyphonTokens(a => !a.isZero())

export const typhonDropCoin = (value: TyphonValue): TyphonValue => ({ amount: new BigNumber(0), tokens: value.tokens })
export const typhonHasAnyTokens = (value: TyphonValue) => value.tokens.length != 0
export const typhonValueTokens = (value: TyphonValue, policyId: Hex) =>
   value.tokens.filter(t => t.policyId == policyId)

export const typhonOnlyCoin = (value: TyphonValue) => (console.log('typhonOnlyCoin'), ({amount: value.amount, tokens: [] as Token[]}))
export const typhonOnlyTokens = (value: TyphonValue) => ({tokens: value.tokens, amount: new BigNumber(0)})

export const typhonSetToken = (token: Token) => <T extends TyphonValue>(value: T) => {
   const result = {...value, tokens: value.tokens.slice() }
   result.tokens.splice(
      (index => index !== -1 ? index : result.tokens.length)(result.tokens.findIndex(tokenPred(token))),
      1, ...token.amount.isZero() ? [] : [token])
   return result
}