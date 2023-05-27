import { createStateQueryClient } from "@cardano-ogmios/client"
import { makeOgmiosContext, ogmiosFetchDatum } from "src/utils/ogmios"
import { cslPlutusSourceRef, DetailedPlutusDataJson, gqlLanguage, PlutusLangVer, TransactionUnspentOutputExt, UTxOExtraCSL, UTxODatumInfoPlain, UtxoGQLToCSLParam, valueTyphonToCSL } from "src/csl/common"
import type { Hex } from 'ts-binary-newtypes'
import { limitOffsetToPageCount, nonNull, paginatedLookupAll } from "ts-practical-fp"
import type { BlockFrostAPI } from '@blockfrost/blockfrost-js'
import { Address, PlutusData, TransactionUnspentOutput } from "@emurgo/cardano-serialization-lib-browser"
import { map } from "fp-ts/lib/Array.js"
import BigNumber from "bignumber.js"
import { components } from "@blockfrost/openapi"
import { GQLTransactionOutput } from "src/graphql/types"
import { toBigNum, valueBlockfrostToCSL } from "./value"
import { makeHex } from 'ts-binary-newtypes'
import { unsafeFromHexed } from 'ts-binary-newtypes'
import { TokenClass } from "src/typhon/api"
import { cslScriptEnterpriseAddr } from "./address"
import { NetworkId } from "@stricahq/typhonjs/dist/types"
import { assetClassUnit } from "src/utils/token"
import { networkAddressPrefix } from "src/utils/address"

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
      utxo.script = {
         hash: LCSL.ScriptHash.from_hex(o.script.hash),
         ref: cslPlutusSourceRef(
            input,
            o.script.hash,
            gqlLanguage(o.script.type)
         )
      }
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

type BlockFrostCtx = {blockfrostApi: BlockFrostAPI}
type OgmiosCtx = {ogmiosEndpoint: string}

// For UTxOs where only datum hash is known - fetch datum value
const batchFetchGQLDatumHashValue = (ctx: BlockFrostCtx) => async (utxos: GQLUTxOWithDatum[]): Promise<GQLUTxOWithDatum[]> => {
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

export const batchUTxOGQLtoCSL = (ctx: BlockFrostCtx & OgmiosCtx, param?: UtxoGQLToCSLParam) => <T extends TransactionUnspentOutput | TransactionUnspentOutputExt>(utxos: GQLUTxOWithDatum[]) =>
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

// ====================================================================

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
      const hash = makeHex(_utxo.reference_script_hash)
      utxo.script = {
         hash: LCSL.ScriptHash.from_hex(hash),
         ref: cslPlutusSourceRef(
            input,
            hash,
            gqlLanguage(expectedScriptLang)
         ),
      }
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

const batchFetchBlockfrostDatum = (ctx: BlockFrostCtx) => (utxos: components['schemas']['address_utxo_content']) =>
   Promise.all(utxos.map(async u =>
      (data_json => ({...u, data_json}))
      (
         u.data_hash ? await ctx.blockfrostApi.scriptsDatum(u.data_hash).then(json => json.json_value as DetailedPlutusDataJson)
       : u.inline_datum ? cslCborToDatumJSON(u.inline_datum)
       :                  null)
   ))

export const batchUTxOBlockfrostToCSL = (ctx: BlockFrostCtx, expectedScriptLang?: PlutusLangVer) => (utxos: components['schemas']['address_utxo_content']) =>
   Promise.resolve(utxos)
   .then(batchFetchBlockfrostDatum(ctx))
   .then(map(utxoBlockfrostToCSL(expectedScriptLang)))

// ================================================

const cslFetchInputsImpl = (param?: UtxoGQLToCSLParam) => async <T extends TransactionUnspentOutput | TransactionUnspentOutputExt>
   (ctx: BlockFrostCtx & {network: NetworkId}, ownerAddress: Address, limit = 30, offset = 0,
   assets: TokenClass[] = []) =>
   // runGraphql(gqlAddressUTxOs, ctx.graphqlApi)(
   //    ownerAddress.to_bech32(networkAddressPrefix(ctx.network)), !!param,
   //    limit, offset,
   //    asset
   // )
   // .then(batchUTxOGQLtoCSL(ctx, param))
   (p => assets?.length
      ? Promise.all(
         assets.map(asset =>
            ctx.blockfrostApi.addressesUtxosAsset(p.address, assetClassUnit(asset), p)
         )
      )
      : Promise.all([ctx.blockfrostApi.addressesUtxos(p.address, p)]))
   ({
      address: ownerAddress.to_bech32(networkAddressPrefix(ctx.network)),
      ...limitOffsetToPageCount(limit, offset),
      order: 'asc' as const
   })
   .then(inputs => inputs.flat())
   .then(batchUTxOBlockfrostToCSL(ctx, 'plutusV2'))


export const cslFetchInputsExt = (param: UtxoGQLToCSLParam) => cslFetchInputsImpl(param)<TransactionUnspentOutputExt>
export const cslFetchInputs = cslFetchInputsImpl()<TransactionUnspentOutput>

const cslFetchAllInputsImpl = (param?: UtxoGQLToCSLParam) =>
   <T extends TransactionUnspentOutput | TransactionUnspentOutputExt>
   (ctx: BlockFrostCtx & {network: NetworkId}, ownerAddress: Address, assets: TokenClass[] = []) =>
   paginatedLookupAll({
      pageSize: 50, startPage: 0,
      getBatch: ({page}) => cslFetchInputsImpl(param)(ctx, ownerAddress, 50, page * 50, assets),
      pred: () => true
   }).then(utxo => utxo as T[])

export const cslFetchAllInputsExt = (param: UtxoGQLToCSLParam) => cslFetchAllInputsImpl(param)<TransactionUnspentOutputExt>
export const cslFetchAllInputs = cslFetchAllInputsImpl()<TransactionUnspentOutput>

export const fetchReferenceScript = async (ctx: BlockFrostCtx & {network: NetworkId}, holder: {hash: Hex}, witness: TokenClass) => {
   const [utxo] = await cslFetchInputsExt({inlineDatum: false})(ctx, cslScriptEnterpriseAddr(ctx, holder.hash), 1, 0, [witness])
   if (!utxo) return null
   if (!utxo.script) throw new Error('Failed to retreive inline script reference')
   return utxo.script.ref
}

export const fetchReferenceScriptUTxO = async (ctx: BlockFrostCtx & {network: NetworkId}, holder: {hash: Hex}, witness: TokenClass) => {
   const [utxo] = await cslFetchInputsExt({inlineDatum: false})(ctx, cslScriptEnterpriseAddr(ctx, holder.hash), 1, 0, [witness])
   if (!utxo) return null
   if (!utxo.script) throw new Error('Failed to retreive inline script reference')
   return utxo
}

// // Retrieve datum hash if present, and inject it in utxo; mutates utxo
// export const cslFetchDatum = async (ctx: AppContext, txout: TransactionOutput) => {
//    const datum = await cslRetrieveDatum(
//       (hash: string) => ctx.blockfrostApi.scriptsDatum(hash),
//       j => j,
//       txout)
//    return { txout, datum }
// }
