import { createStateQueryClient } from "@cardano-ogmios/client"
import { makeOgmiosContext, ogmiosFetchDatum } from "src/utils/ogmios"
import { DetailedPlutusDataJson, gqlLanguage, PlutusLangVer, TransactionUnspentOutputExt, UTxODatumInfoPlain, UtxoGQLToCSLParam, valueTyphonToCSL } from "./common"
import type { Hex } from 'ts-binary-newtypes'
import { nonNull } from "ts-practical-fp"
import type { BlockFrostAPI } from '@blockfrost/blockfrost-js'
import { PlutusData, TransactionUnspentOutput } from "@emurgo/cardano-serialization-lib-browser"
import { map } from "fp-ts/lib/Array.js"
import BigNumber from "bignumber.js"
import { components } from "@blockfrost/openapi"
import { GQLTransactionOutput } from "src/graphql/types"
import { valueBlockfrostToCSL } from "./value"
import * as cbors from '@stricahq/cbors'
import { makeHex } from 'ts-binary-newtypes'
import { unsafeFromHexed } from 'ts-binary-newtypes'

export type GQLUTxOWithDatum = Omit<GQLTransactionOutput, 'datum'> & UTxODatumInfoPlain

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

// Fetch datum hashes only
const batchFetchGQLDatum = (ctx: {ogmiosEndpoint: string}) => async (utxos: GQLUTxOWithDatum[]): Promise<GQLUTxOWithDatum[]> => {
   const ogmios = await makeOgmiosContext(ctx).then(createStateQueryClient)
   // Only fetch from ogmios utxos which we don't know datums of
   const datums = await ogmiosFetchDatum(ogmios, utxos.filter(u => !u.datum))
   console.log('batchFetchGQLDatum datums', datums)
   // return zipWith(utxos, datums, (u, d) => ({...d, ...u}))
   return utxos.map(u => u.datum ? u : ({
      ...u,
      // datum: (d => d?.datumHash ? ({ hash: d.datumHash }) : d?.datum ? ({ json: d.datum }) : null)
      // Inject only fetched datum hashes
      datum: (d => d?.datumHash ? ({
         hash: d.datumHash,
         bytes: undefined as unknown as Hex,
         json: undefined as unknown as DetailedPlutusDataJson
      }) : null)
         (datums.find(d => d.txHash == u.txHash && d.index == u.index))
   }) )
}

// For UTxOs where only datum hash is known - fetch datum value
const batchFetchGQLDatumHashValue = (ctx: {blockfrostApi: BlockFrostAPI}) => async (utxos: GQLUTxOWithDatum[]): Promise<GQLUTxOWithDatum[]> => {
   const datums = await Promise.all(utxos
      .map((u) => u.datum && 'hash' in u.datum ? u.datum.hash : null)
      .filter(nonNull)
      .map(h => (console.log('looking for', h), h))
      .map(hash => ctx.blockfrostApi.scriptsDatum(hash).then(json => {
            console.log('blockfrost fetched datum', json)
            return ({hash, json: json.json_value as DetailedPlutusDataJson })
         })
      )
   )
   console.log('batchFetchGQLDatumHashValue datums', datums)
   return utxos.map(u => ({
      ...u,
      // Inject only fetched datum values
      datum: u.datum && 'hash' in u.datum ?
         (hash =>
            (json => json ? ({
               hash: u.datum.hash,
               bytes: undefined as unknown as Hex,
               json: json.json
            }) : u.datum)
            (datums.find(d => d.hash == hash)))
         (u.datum.hash)
         : u.datum
   }) )
}

export const batchUTxOGQLtoCSL = (ctx: {
   ogmiosEndpoint: string
   blockfrostApi: BlockFrostAPI
}, param?: UtxoGQLToCSLParam) => <T extends TransactionUnspentOutput | TransactionUnspentOutputExt>(utxos: GQLUTxOWithDatum[]) =>
   Promise.resolve(utxos)
   .then(us => (console.log('cslFetchInputsImpl ready', us), us))
   .then(utxos => param && utxos.length > 0 // Without utxos.length > 0 ogmiosFetchDatum() hangs
      ? Promise.resolve(utxos)
         .then(batchFetchGQLDatum(ctx)) // fetch datum hash for utxos that do not yet have datum associated
         .then(batchFetchGQLDatumHashValue(ctx)) // fetch actual values for found datum hashes
      : utxos
   )
   .then(us => (console.log('cslFetchInputsImpl snd done', us), us))
   .then(map(utxoGQLToCSL(param))).then(utxo => utxo as T[])

// ========================

const utxoBlockfrostToCSL = (expectedScriptLang?: PlutusLangVer) => (
   _utxo: components['schemas']['address_utxo_content'][number]
 & { data_json: DetailedPlutusDataJson | null } ) => {
   const input = LCSL.TransactionInput.new(LCSL.TransactionHash.from_hex(_utxo.tx_hash), _utxo.output_index)
   const output = LCSL.TransactionOutput.new(LCSL.Address.from_bech32((_utxo as any).address), valueBlockfrostToCSL(_utxo.amount))
   const utxo: TransactionUnspentOutputExt = LCSL.TransactionUnspentOutput.new(input, output)
   if (_utxo.reference_script_hash) {
      if (!expectedScriptLang) {
         throw new Error(`utxoBlockfrostToCSL: got reference_script_hash ${_utxo.reference_script_hash}, but expectedScriptLang not specified`)
      }
      utxo.scriptRef = LCSL.PlutusScriptSource.new_ref_input_with_lang_ver(
         LCSL.ScriptHash.from_hex(_utxo.reference_script_hash),
         input,
         gqlLanguage(expectedScriptLang)
      )
      console.log('utxoBlockfrostToCSL', _utxo.reference_script_hash, input.transaction_id().to_hex(), gqlLanguage(expectedScriptLang).to_json())
   }
   if (_utxo.data_json) {
      const plutus = LCSL.PlutusData.from_json(
         JSON.stringify(_utxo.data_json),
         LCSL.PlutusDatumSchema.DetailedSchema
      )
      const json = _utxo.data_json
      utxo.datum = _utxo.data_hash
         ? {
            hash: makeHex(_utxo.data_hash),
            source: LCSL.DatumSource.new(plutus),
            plutus, json
         }
         : {
            ref: input,
            source: LCSL.DatumSource.new_ref_input(input),
            plutus, json
         }
   }
   return utxo
}

const cslCborToDatumJSON = (cbor: string) =>
   JSON.parse(
      unsafeFromHexed(LCSL.PlutusData)(cbor).to_json(LCSL.PlutusDatumSchema.DetailedSchema)
   ) as DetailedPlutusDataJson

const batchFetchBlockfrostDatum = (ctx: {blockfrostApi: BlockFrostAPI}) => (utxos: components['schemas']['address_utxo_content']) =>
   Promise.all(utxos.map(async u =>
      (data_json => ({...u, data_json}))
      (
         u.data_hash ? await ctx.blockfrostApi.scriptsDatum(u.data_hash).then(json => json.json_value as DetailedPlutusDataJson)
       : u.inline_datum ? cslCborToDatumJSON(u.inline_datum)
       :                  null)
   ))

export const batchUTxOBlockfrostToCSL = (ctx: {blockfrostApi: BlockFrostAPI}, expectedScriptLang?: PlutusLangVer) => (utxos: components['schemas']['address_utxo_content']) =>
   Promise.resolve(utxos)
   .then(batchFetchBlockfrostDatum(ctx))
   .then(map(utxoBlockfrostToCSL(expectedScriptLang)))