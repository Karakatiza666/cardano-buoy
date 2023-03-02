import type { AssetName, PlutusDatumSchema, ScriptHash, TransactionInput, PlutusData, TransactionUnspentOutput, TransactionOutput, BigNum } from '@emurgo/cardano-serialization-lib-browser'
import type BigNumber from 'bignumber.js'
import { comp, lazy } from 'ts-practical-fp'
import { fromHex, type Hex } from 'ts-binary-newtypes'
import { parseDetailedPlutusDataJson, type DetailedPlutusDataJson, type TransactionUnspentOutputExt } from 'src/csl/common'
// import CSL from '@emurgo/cardano-serialization-lib-browser'
// import { Loader } from 'cardano-buoy'
import { toBigInt, toBigNum } from "./value"

export const plutusConstructor = (i: number) => (...data: PlutusData[]) => {
   if (data.length === 0) {
      return LCSL.PlutusData.new_empty_constr_plutus_data(toBigNum(i))
   }
   const list = LCSL.PlutusList.new()
   for (const elem of data) {
      list.add(elem)
   }
   return LCSL.PlutusData.new_constr_plutus_data(LCSL.ConstrPlutusData.new(toBigNum(i), list))
}

// https://playground.plutus.iohkdev.io/doc/haddock/plutus-tx/html/src/PlutusTx.IsData.Instances.html
// makeIsDataIndexed ''Bool [('False,0),('True,1)]
// makeIsDataIndexed ''Maybe [('Just,0),('Nothing,1)]
// makeIsDataIndexed ''Either [('Left,0),('Right,1)]
export const plutusGenericConstructor = plutusConstructor(0)
export const plutusEmptyConstructor = () => LCSL.PlutusData.new_empty_constr_plutus_data(toBigNum(0))
export const plutusBoolConstructor = (data: boolean) => plutusConstructor(data ? 1 : 0)()
export const plutusNothingConstructor = () => plutusConstructor(1)()
export const plutusJustConstructor = (data: PlutusData) => plutusConstructor(0)(data)
export const plutusLeftConstructor = (data: PlutusData) => plutusConstructor(0)(data)
export const plutusRightConstructor = (data: PlutusData) => plutusConstructor(1)(data)
// More complex PlutusTx data types
export const plutusTxId = (txRef: TransactionInput) => plutusGenericConstructor(LCSL.PlutusData.new_bytes(txRef.transaction_id().to_bytes()))
export const plutusTxOutRef = (txRef: TransactionInput) => plutusGenericConstructor(
   plutusTxId(txRef),
   plutusInteger(txRef.index())
)
export const plutusCurrencySymbol = (acl: {policyId: Hex | ScriptHash}) =>
   LCSL.PlutusData.new_bytes(typeof acl.policyId == 'string' ? fromHex(acl.policyId) : acl.policyId.to_bytes())
export const plutusTokenName = (acl: {assetName: Hex | AssetName}) =>
   LCSL.PlutusData.new_bytes(typeof acl.assetName == 'string' ? fromHex(acl.assetName) : acl.assetName.name()) // .to_bytes() returns cbor hex, .name() returns plain hex bytes; see https://github.com/Emurgo/cardano-serialization-lib/issues/397
export const plutusAssetClass = (acl: {policyId: ScriptHash, assetName: AssetName}) => plutusGenericConstructor(
   plutusCurrencySymbol(acl),
   plutusTokenName(acl)
)
export const plutusInteger = lazy(() => comp(toBigInt, LCSL.PlutusData.new_integer))

export const cslRetrieveNativeDatum = async <T>(
   retrieve: (hash: string) => Promise<string | DetailedPlutusDataJson>,
   parse: (json: DetailedPlutusDataJson) => T,
   utxo: {output: () => TransactionOutput} | TransactionOutput) => {
   const out = 'output' in utxo ? utxo.output() : utxo
   const plutus = out.plutus_data()
   const json = 
      /// * wallet: https://github.com/input-output-hk/cardano-wallet/blob/master/specifications/api/swagger.yaml
      /// * node: https://github.com/input-output-hk/cardano-node/blob/master/doc/reference/simple-scripts.md
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
         out.has_plutus_data() ? parseDetailedPlutusDataJson(out.plutus_data()!.to_json(LCSL.PlutusDatumSchema.DetailedSchema))
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
       : out.has_data_hash() ? parseDetailedPlutusDataJson(await retrieve(out.data_hash()!.to_hex()))
       : null
   console.log('cslRetrieveDatum', await retrieve(out.data_hash()!.to_hex()))
   if (!json) return null
   return {
      parsed: parse(json),
      plutus: plutus ?? LCSL.PlutusData.from_json(JSON.stringify(json), LCSL.PlutusDatumSchema.DetailedSchema),
      json
   }
}

export const cslRequireNativeDatum = async <T>(
   retrieve: (hash: string) => Promise<string | DetailedPlutusDataJson>,
   parse: (json: DetailedPlutusDataJson) => T,
   utxo: {output: () => TransactionOutput} | TransactionOutput,
   msg: string) =>
   (await cslRetrieveNativeDatum(retrieve, parse, utxo)) ?? (() => { throw new Error(msg)})()

export const cslRetrieveDatum = async <T>(
   parse: (json: DetailedPlutusDataJson) => T,
   utxo: TransactionUnspentOutputExt) => {
   if (!utxo.datum) return null
   return {
      parsed: parse(utxo.datum.json),
      plutus: utxo.datum.plutus,
      json: utxo.datum.json
   }
}

export const cslRequireDatum = async <T>(
   parse: (json: DetailedPlutusDataJson) => T,
   utxo: TransactionUnspentOutputExt,
   msg: string) =>
   (await cslRetrieveDatum(parse, utxo)) ?? (() => { throw new Error(msg)})()
