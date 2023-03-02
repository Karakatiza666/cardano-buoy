import type { AssetName, ScriptHash, BigNum, Value, TransactionOutput, TransactionUnspentOutput, Address } from '@emurgo/cardano-serialization-lib-browser'
// import CSL from '@emurgo/cardano-serialization-lib-browser'
// import { Loader } from 'cardano-buoy'
import { fromHex, makeHex, toHex } from 'ts-binary-newtypes'
import { tuple } from 'ts-practical-fp'
import { BigNumber } from 'bignumber.js'
import type { Token, TyphonValue } from 'src/typhon/api'
import { nonNull } from 'ts-practical-fp'

// Remember - BigNum is always positive! Int can be negative
export const toBigNum = (n: number | BigNumber) => LCSL.BigNum.from_str(typeof n == 'number' ? n.toString() : n.toFixed())
export const fromBigNum = (n: BigNum) => new BigNumber(n.to_str())
export const toCSLInt = (amount: BigNumber) => amount.gte(0) ? LCSL.Int.new(toBigNum(amount)) : LCSL.Int.new_negative(toBigNum(amount.negated()))
export const copyBigNum = (b: BigNum) => cslClone(LCSL.BigNum, b)
export const cslClone = <T extends {to_bytes: () => Uint8Array} | undefined, C extends {from_bytes: (bytes: Uint8Array) => T}>(c: C, v: T) =>
   v ? c.from_bytes(v.to_bytes()) : undefined as T
export const toBigInt = (n: number | BigNumber | BigNum) => LCSL.BigInt.from_str(
     typeof n == 'number' ? n.toFixed()
   : BigNumber.isBigNumber(n) ? n.toFixed()
   : n.to_str() )

export function getPolicyId(scriptHash: ScriptHash) {
   // return (() => Buffer)().from(scriptHash.to_bytes()).toString('hex')
   return toHex(scriptHash.to_bytes())
}

export function getAssetName(assetName: AssetName) {
   // return (() => Buffer)().from(assetName.name()).toString('hex')
   return toHex(assetName.name())
}

export type CSLAssets = [ScriptHash, [AssetName, BigNum][]]
export type CSLTokenClass = {policyId: ScriptHash, assetName: AssetName}
export type CSLToken = {policyId: ScriptHash, assetName: AssetName, amount: BigNum}
export type CSLTokenExt = {policyId: ScriptHash, assetName: AssetName, amount: BigNumber}
export const toCSLTokenExt = (t: CSLToken): CSLTokenExt => ({...t, amount: fromBigNum(t.amount)})


const adaPolicy = fromHex(makeHex('00000000000000000000000000000000000000000000000000000000'))
const adaToken = fromHex(makeHex('00'))

export function cslValueAssets(value: Value): CSLAssets[] {
   if (value.is_zero()) {
      return []
   }
   let allAssets = (() => {
      const policy = LCSL.ScriptHash.from_bytes(adaPolicy)
      const assetName = LCSL.AssetName.new(adaToken)
      return [tuple(policy, [tuple(assetName, value.coin())])]
   })()
   allAssets = cslValueAssetsOnly(value).concat(allAssets)
   return allAssets
}

export function cslValueAssetsOnly(value: Value): CSLAssets[] {
   if (value.is_zero()) {
      return []
   }
   const multi = value.multiasset()
   if (multi) {
      const policies = multi.keys()
      const retrievedPolicies = new Array<CSLAssets>(policies.len())
      for (let i = 0; i < policies.len(); ++i) {
         const policy = policies.get(i)
         const policyAssets = multi.get(policy)!
         const assetNames = policyAssets.keys()
         const retrievedAssets = new Array<[AssetName, BigNum]>(assetNames.len())
         for (let j = 0; j < assetNames.len(); ++j) {
            const assetName = assetNames.get(j)
            retrievedAssets[j] = [assetName, policyAssets.get(assetName)!]
         }
         retrievedPolicies[i] = [policy, retrievedAssets]
      }
      return retrievedPolicies
   }
   return []
}

export const uint8ArrayEqual = (a: Uint8Array, b: Uint8Array) =>
   a.length === b.length && a.every((value, index) => value === b[index]);

export function cslAssetsTyphonValue(value: CSLAssets[]) {
   const result = { amount: new BigNumber(0), tokens: [] as Token[]}
   for (const [policyId, tokens] of value) {
      if (uint8ArrayEqual(policyId.to_bytes(), adaPolicy)) { // ADA
         result.amount = new BigNumber(tokens[0][1].to_str())
         break
      }
      for (const [assetName, amount] of tokens) {
         result.tokens.push({
            policyId: makeHex(policyId.to_hex()),
            assetName: toHex(assetName.name()), // assetName.to_hex() returns cbor hex
            amount: new BigNumber(amount.to_str())
         })
      }
   }
   return result
}

export const cslValueAmount = (policyId: ScriptHash, assetName: AssetName, value: Value) =>
   value.multiasset()?.get_asset(policyId, assetName) ?? toBigNum(0)
export const cslValueToken = (token: CSLTokenClass, value: Value) =>
   value.multiasset()?.get_asset(token.policyId, token.assetName) ?? toBigNum(0)
export const cslValueHasCurrency = (policyId: ScriptHash, value: Value) =>
   !!value.multiasset()?.get(policyId)
export const cslValueHasToken = (token: CSLTokenClass, value: Value) =>
   !!value.multiasset()?.get(token.policyId)?.get(token.assetName)

export const cslHasAnyTokens = (value: Value) => {
   return !comparedValue('EQ', LCSL.Value.new(value.coin()), value)
}


export const cslValueFromTokens = (tokens: CSLToken[], coin = toBigNum(0)) => {
   if (tokens.length == 0) {
      return LCSL.Value.new(coin)
   }
   const multiAsset = LCSL.MultiAsset.new()
   for (const token of tokens) {
      multiAsset.set_asset(token.policyId, token.assetName, copyBigNum(token.amount))
   }
   return LCSL.Value.new_with_assets(coin, multiAsset)
}

// Returns deltas - amounts to add to initial value to get final value
export const cslValueWithTokens = (value: Value, tokens: CSLToken[]) => {
   const multi = value.multiasset() ?? LCSL.MultiAsset.new()
   // console.log('multi', multi)
   const deltas: CSLTokenExt[] = []
   for (const token of tokens) {
      const prev = multi.set_asset(token.policyId, token.assetName, copyBigNum(token.amount)) ?? toBigNum(0)
      // const prev = multi.set_asset(cslClone(LCSL.ScriptHash, token.policyId), cslClone(LCSL.AssetName, token.assetName), copyBigNum(token.amount)) ?? toBigNum(0)
      deltas.push({...token, amount: fromBigNum(token.amount).minus(fromBigNum(prev))})
   }
   const newValue = LCSL.Value.new_with_assets(value.coin(), multi)
   // console.log('newValue', newValue.coin().to_str())
   return { value: newValue, deltas }
}

export const cslValueExtract = (policyId: ScriptHash, assetName: AssetName, value: Value) => {
   const amounts = (amount => amount ? [{amount, policyId, assetName}] : [])
      (cslValueAmount(policyId, assetName, value))
   return cslValueFromTokens(amounts)
}

export const cslCopyUTxO = <T extends TransactionOutput | TransactionUnspentOutput>(a: Address, v: Value, old: T): T => {
   if (old instanceof LCSL.TransactionOutput) {
      const out = LCSL.TransactionOutput.new(a, v)
      if (old.has_data_hash()) {
         // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
         out.set_data_hash(old.data_hash()!)
      }
      if (old.has_plutus_data()) {
         // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
         out.set_plutus_data(old.plutus_data()!)
      }
      if (old.has_script_ref()) {
         // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
         out.set_script_ref(old.script_ref()!)
      }
      return out as T
   } else if (old instanceof LCSL.TransactionUnspentOutput) {
      return LCSL.TransactionUnspentOutput.new(old.input(), cslCopyUTxO(a, v, old.output())) as T
   }
   throw new Error('cslCopyUTxO: unexpected class')
}

// export const cslUpdateCoin = (f: (c: BigNum) => BigNum) => (value: Value) => (value.set_coin(f(value.coin())), value)
export const cslUpdateCoin = (f: (c: BigNum) => BigNum) => <T extends Value | TransactionOutput>(value: T): T => {
   if (value instanceof LCSL.Value) {
      // console.log('x_a')
      const x = ( (c, m) => m ? LCSL.Value.new_with_assets(c, m) : LCSL.Value.new(c))(f(value.coin()), value.multiasset()) as T
      // console.log('x_a/')
      return x
   } else if (value instanceof LCSL.TransactionOutput) {
      // console.log('x_b')
      const x = cslCopyUTxO(value.address(), cslUpdateCoin(f)(value.amount()), value)
      // console.log('x_b/')
      return x
   }
   throw new Error('cslUpdateCoin: unknown class')
}

export const cslSetToken = (token: CSLToken) => <T extends Value | TransactionOutput | TransactionUnspentOutput>(value: T): T => {
   if (value instanceof LCSL.Value) {
      // console.log('x_c0', value.multiasset(), token.amount)
      const multi = (value.multiasset() ?? (token.amount.is_zero() ? undefined : LCSL.MultiAsset.new()))
      multi?.set_asset(token.policyId, token.assetName, cslClone(LCSL.BigNum, token.amount))
      // console.log('x_c')
      const x = (multi ? LCSL.Value.new_with_assets(value.coin(), multi) : LCSL.Value.new(value.coin())) as T
      // console.log('x_c/')
      return x
   } else if (value instanceof LCSL.TransactionOutput) {
      // console.log('x_d', token.amount)
      const x = cslCopyUTxO(value.address(), cslSetToken(token)(value.amount()), value) // cslSetToken(token)(value.output()) as T
      // console.log('x_d/')
      return x
   } else if (value instanceof LCSL.TransactionUnspentOutput) {
      // console.log('x_e')
      const x = cslCopyUTxO(value.output().address(), cslSetToken(token)(value.output().amount()), value)
      // console.log('x_e/')
      return x
   }
   throw new Error('cslSetToken: unknown class')
}

export const cslOnlyCoin = (value: Value) => LCSL.Value.new(value.coin())

export const cslOnlyTokens = (value: Value) => LCSL.Value.new_from_assets(value.multiasset() ?? LCSL.MultiAsset.new())

export const cslValueWithCoin = (v: Value, coin: BigNum) => {
   const multi = v.multiasset()
   return multi
      ? LCSL.Value.new_with_assets(coin, multi)
      : LCSL.Value.new(coin)
}

const compareBigNum = (a: BigNum, b: BigNum) => {
   const res = a.compare(b)
   return (
      res > 0 ? 'GT' :
      res < 0 ? 'LT' :
                'EQ'
   )
}

export const comparedBigNum = (pred: 'GT' | 'LT' | 'EQ' | 'GEQ' | 'LEQ', a: BigNum, b: BigNum) => {
   const res = compareBigNum(a, b)
   const check = {
      'GT': ['GT'],
      'LT': ['LT'],
      'EQ': ['EQ'],
      'GEQ': ['GT', 'EQ'],
      'LEQ': ['LT', 'EQ'],
   }
   return check[pred].includes(res)
}

export const comparedValue = (pred: 'GT' | 'LT' | 'EQ' | 'GEQ' | 'LEQ', a: Value, b: Value) => {
   const res = a.compare(b)
   if (!nonNull(res)) return false
   const check = {
      'GT':  res  > 0,
      'LT':  res  < 0,
      'EQ':  res == 0,
      'GEQ': res >= 0,
      'LEQ': res <= 0,
   }
   // console.log('comparedValue', check)
   return check[pred]
}

export const ada = (n: number) => toBigNum(n * 1000000)

export const clamped_add = (a: BigNum, b: BigNumber) =>
   b.lt(0)
      ? a.clamped_sub(toBigNum(b.negated()))
      : a.checked_add(toBigNum(b))

export const clamped_sub = (a: BigNum, b: BigNumber) =>
   b.lt(0)
      ? a.checked_add(toBigNum(b.negated()))
      : a.clamped_sub(toBigNum(b))

export const clamped_add_coin = (v: Value, b: BigNumber | BigNum) =>
   BigNumber.isBigNumber(b)
      ? b.lt(0)
         ? v.clamped_sub(LCSL.Value.new(toBigNum(b.negated())))
         : v.checked_add(LCSL.Value.new(toBigNum(b)))
      : v.checked_add(LCSL.Value.new(b))

export const checked_add = (a: BigNum, b: BigNum) => a.checked_add(b)

// export const checked_add = (lhs: Value, rhs: Value) => {
//    try {
//       return lhs.checked_add(rhs)
//    } catch { /* empty */ }
//    return null
// }

export const checked_sub = (lhs: Value, rhs: Value) => {
   try {
      return lhs.checked_sub(rhs)
   } catch { /* empty */ }
   return null
}

export const cslMax = (a: BigNum, b: BigNum) =>
   comparedBigNum('GT', a, b) ? a : b

export const cslMin = (a: BigNum, b: BigNum) =>
   comparedBigNum('LT', a, b) ? a : b
// export const clamped_add_value = (a: Value, b: BigNumber) =>
//    b.lt(0)
//       ? a.clamped_sub(toBigNum(b.negated()))
//       : a.checked_add(toBigNum(b))

export const cslOutputValue = (out: TransactionOutput | TransactionUnspentOutput) =>
      out instanceof LCSL.TransactionOutput ? out.amount()
    : out.output().amount()

export const cslMapAmount = (f: (a: BigNum) => BigNum) => (v: CSLToken) => ({
   ...v, amount: f(v.amount)
})
