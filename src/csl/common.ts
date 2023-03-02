// import CSL from '@emurgo/cardano-serialization-lib-browser'
// import { Loader } from 'cardano-buoy'
import type { Address, DatumSource, Language, PlutusData, PlutusScriptSource, TransactionInput, TransactionUnspentOutput, Value } from "@emurgo/cardano-serialization-lib-browser"
import { HashType, type ExUnits, type Input, type NetworkId, type ShelleyAddress } from "@stricahq/typhonjs/dist/types.js"
import type Typhon from "@stricahq/typhonjs/dist/types.js"
import BigNumber from "bignumber.js"
import { fromHex, makeHex, numToHex, type Hex } from "ts-binary-newtypes"
import type { GQLTransactionOutput } from 'src/graphql/types'
import type { Output, Token, TokenClass, TxIn, TyphonValue } from "src/typhon/api"
import { cslAssetsTyphonValue, cslValueAssets, cslValueFromTokens, fromBigNum, toBigNum, type CSLTokenExt } from "src/csl/value"
import { getAddressFromBech32 } from "@stricahq/typhonjs/dist/utils/utils.js"
import { requireShelleyAddr } from "src/typhon/common"
import { BaseAddress, EnterpriseAddress, PointerAddress } from "@stricahq/typhonjs/dist/address/index.js"
import * as vlq from 'vlq'
import { toBase64 } from "ts-binary-newtypes"
import type { EvaluationCost, EvaluationTag } from "src/types/evaluation"

export type DetailedPlutusMetadataJson = {
   string: string
} | {
   int: number
} | {
   bytes: Hex
} | {
   list: DetailedPlutusMetadataJson[]
} | {
   map: {k: DetailedPlutusMetadataJson, v: DetailedPlutusMetadataJson}[]
}

export type DetailedPlutusDataJson = {
   constructor: number,
   fields: DetailedPlutusDataJson[]
} | {
   int: number
} | {
   bytes: Hex
} | {
   list: DetailedPlutusDataJson[]
} | {
   map: {k: DetailedPlutusDataJson, v: DetailedPlutusDataJson}[]
}

export const parseDetailedPlutusDataJson = (raw: string | Record<string, unknown>) => {
   const json = typeof raw == 'string' ? JSON.parse(raw) : raw
   if (!['constructor', 'fields', 'int', 'bytes', 'list', 'map'].includes(Object.keys(json)[0]))
      throw new Error('parseDetailedPlutusDataJson: not a DetailedSchema json!')
   return json as DetailedPlutusDataJson
}

export const txOutRefBytes = (input: TransactionInput | TxIn) =>
   'txHash' in input
      ? makeHex(input.txHash + numToHex(input.index))
      : makeHex(input.transaction_id().to_hex() + numToHex(input.index()))

export const txInCSLToTyphon = (txIn: TransactionInput | TransactionUnspentOutput): TxIn =>
   txIn instanceof LCSL.TransactionInput
      ? { txHash: makeHex(txIn.transaction_id().to_hex()), index: txIn.index() }
      : txInCSLToTyphon(txIn.input())

export const cslExUnits = (cost: ExUnits) => LCSL.ExUnits.new(toBigNum(cost.mem), toBigNum(cost.steps))

// export const cslPlutusV = (v: 1 | 2) => {
//    switch(v) {
//       case 1: return LCSL.Language.new_plutus_v1()
//       case 2: return LCSL.Language.new_plutus_v2()
//    }
// }
export const cslPlutusV1 = () => LCSL.Language.new_plutus_v1()
export const cslPlutusV2 = () => LCSL.Language.new_plutus_v2()
export const gqlLanguage = (ver: 'plutusV1' | 'plutusV2') => ({
   'plutusV1': LCSL.Language.new_plutus_v1(),
   'plutusV2': LCSL.Language.new_plutus_v2()
})[ver] ?? (() => { throw new Error(`Unknown plutus version ${ver}`)})()

export type UTxODatumInfoPlain = {
   datum: {
      hash: Hex
      bytes: Hex
      json: DetailedPlutusDataJson
      // json: string | {
      //    [k: string]: unknown;
      // }
   } | {
      ref: { txHash: Hex, index: number }
      bytes: Hex
      json: DetailedPlutusDataJson
      // json: string | {
      //    [k: string]: unknown;
      // }
   }
   | null
}

export type UTxODatumInfoCSL = {
   // scriptRef?: PlutusScriptSource
   // datum?: {
   //    source: DatumSource
   //    plutus: PlutusData
   //    json: string | {
   //       [k: string]: unknown;
   //    }
   // } & ({hash: Hex} | {ref: TransactionInput})
   scriptRef?: PlutusScriptSource
   datum?: {
      hash: Hex
      source: DatumSource
      plutus: PlutusData
      json: DetailedPlutusDataJson
      // json: string | {
      //    [k: string]: unknown;
      // }
   } | {
      ref: TransactionInput
      source: DatumSource
      plutus: PlutusData
      json: DetailedPlutusDataJson
      // json: string | {
      //    [k: string]: unknown;
      // }
   }
} // & OptionalIntersection<{datumHash: DatumSource} | {datumRef: DatumSource}>

export type GQLUTxOWithDatum = Omit<GQLTransactionOutput, 'datum'> & UTxODatumInfoPlain

export type TransactionUnspentOutputExt = TransactionUnspentOutput & UTxODatumInfoCSL 

export const requireExtDatumSource = (o: TransactionUnspentOutputExt) =>
   o.datum?.source ?? (() => { throw new Error('Datum source is required') })()

export const requireExtDatum = (o: TransactionUnspentOutputExt) =>
   o.datum?.plutus ?? (() => { throw new Error('Plutus datum is required') })()

export const requireExtDatumHash = (o: TransactionUnspentOutputExt) =>
   o.datum && 'hash' in o.datum ? LCSL.DataHash.from_hex(o.datum.hash) : (() => { throw new Error('Plutus datum hash is required') })()

export type UtxoGQLToCSLParam = { inlineDatum: boolean }

export const utxoGQLToCSL = (params?: UtxoGQLToCSLParam) => (o: GQLUTxOWithDatum) => {// (o: GQLTransactionOutput) => {
   const tokens = o.tokens.map(t => ({...t.asset, amount: new BigNumber(t.quantity)}))
   const value = { amount: new BigNumber(o.value), tokens }
   const input = LCSL.TransactionInput.new(LCSL.TransactionHash.from_hex(o.txHash), o.index)
   // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
   const output = LCSL.TransactionOutput.new(LCSL.Address.from_bech32(o.address), valueTyphonToCSL(value)!)
   const utxo: TransactionUnspentOutputExt = LCSL.TransactionUnspentOutput.new(input, output)
   console.log('utxoGQLToCSL', o)
   if (o.script) {
      utxo.scriptRef = LCSL.PlutusScriptSource.new_ref_input_with_lang_ver(
         // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
         LCSL.ScriptHash.from_hex(o.script.hash),
         input,
         // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
         gqlLanguage(o.script.type)
      )
      console.log('utxoGQLToCSL', o.script.hash, input.transaction_id().to_hex(), gqlLanguage(o.script.type).to_json())
   }
   // if (o.datum) {
   //    // TODO: figure out if it is possible to discern inline datum and hash datum only with graphql results
   //    const plutus = LCSL.PlutusData.from_hex(o.datum.bytes)
   //    const json = o.datum.value
   //    utxo.datum = params?.inlineDatum
   //       ? {
   //          ref: input,
   //          source: LCSL.DatumSource.new_ref_input(input),
   //          plutus, json
   //       }
   //       : {
   //          hash: o.datum.hash,
   //          source: LCSL.DatumSource.new(plutus),
   //          plutus, json
   //       }
   // }
   if (o.datum) {
      // TODO: figure out if it is possible to discern inline datum and hash datum only with graphql results
      // const plutus = LCSL.PlutusData.from_hex(o.datum.bytes)
      const plutus = LCSL.PlutusData.from_json(
         JSON.stringify(o.datum.json),
         LCSL.PlutusDatumSchema.DetailedSchema
      )
      const json = o.datum.json
      utxo.datum = 'hash' in o.datum
         ? {
            hash: o.datum.hash,
            source: LCSL.DatumSource.new(plutus),
            plutus, json
         }
         : {
            ref: input,
            source: LCSL.DatumSource.new_ref_input(input),
            plutus, json
         }
      // utxo.datum = params?.inlineDatum
      //    ? {
      //       ref: input,
      //       source: LCSL.DatumSource.new_ref_input(input),
      //       plutus, json
      //    }
      //    : {
      //       hash: o.datum.hash,
      //       source: LCSL.DatumSource.new(plutus),
      //       plutus, json
      //    }
   }
   return utxo
}

export const cslScriptHash = (policyId: Hex) => LCSL.ScriptHash.from_hex(policyId)
export const cslAssetName = (assetName: Hex) => LCSL.AssetName.new(fromHex(assetName))

export const aclTyphonToCSL = (token: TokenClass) => ({
   policyId: LCSL.ScriptHash.from_hex(token.policyId),
   assetName: LCSL.AssetName.new(fromHex(token.assetName)),
})

export const tokenTyphonToCSL = (token: Token) => {
   if (token.amount.isNegative()) throw new Error('tokenTyphonToCSL called on negative amount!')
   return {
      policyId: LCSL.ScriptHash.from_hex(token.policyId),
      assetName: LCSL.AssetName.new(fromHex(token.assetName)),
      amount: toBigNum(token.amount)
   }
}

export const tokenTyphonToCSLExt = (token: Token) => ({
   policyId: LCSL.ScriptHash.from_hex(token.policyId),
   assetName: LCSL.AssetName.new(fromHex(token.assetName)),
   amount: token.amount
})

export const valueTyphonToCSL = (value: TyphonValue) => {
   let result: Value | null = null
   try {
      result = cslValueFromTokens(
         value.tokens.map(tokenTyphonToCSL)
      ).checked_add(LCSL.Value.new(toBigNum(value.amount)))
   } catch { /* empty */ }
   return result
}

const credTyphonToCSL = (cred: Typhon.Credential) =>
   (hash =>
      cred.type === HashType.ADDRESS ? LCSL.StakeCredential.from_keyhash(hash) :
      cred.type === HashType.SCRIPT  ? LCSL.StakeCredential.from_scripthash(hash) :
      (() => { throw new Error('Unknown ')})()
   )
   (LCSL.Ed25519KeyHash.from_hex(cred.hash))

const pointerTyphonToCSL = (p: PointerAddress) => {
   const nums = vlq.decode(toBase64(fromHex(makeHex(p.getHex().slice(2 + 56))))).map(toBigNum)
   if (nums.length !== 3) throw new Error('Invalid pointer address VLQ')
   return LCSL.Pointer.new_pointer(nums[0], nums[1], nums[2])
}

export const addressTyphonToCSL = (ctx: {network: NetworkId}, addr: ShelleyAddress) => {
   if (addr instanceof EnterpriseAddress) {
      return LCSL.EnterpriseAddress.new(ctx.network, credTyphonToCSL(addr.paymentCredential)).to_address()
   } else if (addr instanceof BaseAddress) {
      return LCSL.BaseAddress.new(ctx.network, credTyphonToCSL(addr.paymentCredential), credTyphonToCSL(addr.stakeCredential)).to_address()
   } else if (addr instanceof PointerAddress) {
      return LCSL.PointerAddress.new(ctx.network, credTyphonToCSL(addr.paymentCredential), pointerTyphonToCSL(addr)).to_address()
   } else {
      throw new Error('addressTyphonToCSL: Unknown address type')
   }
}

// Doesn't convert plutus data! Only plutus data hash
export const txoutTyphonToCSL = (out: Omit<Output, 'plutusData'>) => {
   const res = LCSL.TransactionOutput.new(
      // TODO: check if this works, or addressTyphonToCSL needed
      LCSL.Address.from_bytes(out.address.getBytes()),
      valueTyphonToCSL(out) ?? (() => { throw new Error('txoutTyphonToCSL: negative amount') })()
   )
   if (out.plutusDataHash) {
      res.set_data_hash(LCSL.DataHash.from_hex(out.plutusDataHash))
   }
   return res
}

export const txinTyphonToCSL = (out: Omit<Input, 'plutusData'>) =>
   cslTransactionInput(makeHex(out.txId), out.index)

export const cslTransactionInput = (txHash: Hex, index: number) =>
   LCSL.TransactionInput.new(LCSL.TransactionHash.from_hex(txHash), index)

const cslRedeemerTag = (tag: EvaluationTag) =>
   tag === 'spend' ? LCSL.RedeemerTag.new_spend() :
   tag === 'mint' ? LCSL.RedeemerTag.new_mint() :
   tag === 'withdrawal' ? LCSL.RedeemerTag.new_reward() :
   tag === 'certificate' ? LCSL.RedeemerTag.new_cert() :
   (() => { throw new Error('Unknown redeemer tag') })()

export const cslRedeemer = (evaluation: EvaluationCost, tag: EvaluationTag, index: number, redeemer: PlutusData) =>
   LCSL.Redeemer.new(
      cslRedeemerTag(tag),
      toBigNum(index),
      redeemer,
      cslExUnits(evaluation(tag, index))
   )

export const cslDatum = <D>(datum: D, serialise: (d: D) => PlutusData) => ({
   hash: LCSL.hash_plutus_data(serialise(datum)),
   plutus: serialise(datum)
})

export type CompiledScript = {
   hash: Hex
   cbor: Hex
   lang: Language
}

export type CompiledPolicy = {
   policyId: Hex
   cbor: Hex
   lang: Language
}

export type PlutusPolicy = {
   policyName: string,
   policyArgs: Hex[]
}

export const cslPlutusScript = (script: {cbor: Hex, lang: Language}) => LCSL.PlutusScript.from_hex_with_version(script.cbor, script.lang)
