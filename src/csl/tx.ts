
// import CSL from '@emurgo/cardano-serialization-lib-browser'
// import { Loader } from 'cardano-buoy'
import type { BigNum, TransactionUnspentOutput, Transaction, AssetName, ScriptHash, TransactionBuilder, TransactionOutput, TransactionInput, Address, Value, Language, PlutusData, ExUnits as CSLExUnits, ScriptRef, PlutusScriptSource, PlutusScript, Redeemer, TransactionWitnessSet, Costmdls, PlutusWitnesses, PlutusWitness, Redeemers, PlutusList, TransactionHash, Ed25519KeyHash, Vkeywitness, MintBuilder, MintsAssets } from '@emurgo/cardano-serialization-lib-browser'
import type { ProtocolParams } from 'src/types/network'
import { errorMessage, randomStr, sortOn_, toFraction, tuple, unionOn, uniqueOn_, upsertSortedOnWith_ } from 'ts-practical-fp'
import { ada, checked_add, clamped_add, comparedBigNum, cslClone, cslMax, cslOutputValue, cslUpdateCoin, cslValueWithTokens, fromBigNum, toBigInt, toBigNum, toCSLInt, toCSLTokenExt, uint8ArrayEqual, type CSLToken, type CSLTokenExt, CSLAssetsExt, fromCSLAssetsExt, fromCSLInt, toCSLAssetsExt } from 'src/csl/value'
import { calculateMinUtxoAmount } from "@stricahq/typhonjs/dist/utils/utils.js"
import type { ExUnits } from '@cardano-ogmios/schema';
import BigNumber from 'bignumber.js'
import { makeOgmiosContext } from 'src/utils/ogmios'
import { createTxSubmissionClient } from '@cardano-ogmios/client'
import { compareHex, fromHex, makeHex, numToHex, utf8ToHex, toHex, type Hex } from 'ts-binary-newtypes'
import { dummyEval, evaluated } from 'src/utils/evaluation'
import type { WalletCIP30ApiInstance } from 'src/cip30/api'
import { mapFromHexed, toHexed, fromHexed } from 'ts-binary-newtypes'
import { rejectWith, sleep } from 'ts-practical-fp'
import { createPaginator, paginatedIterator, paginatedLookupMaybeNonNull } from 'ts-practical-fp'
import { callNonNull, nonNull } from 'ts-practical-fp'
import type { EvaluationCost } from 'src/types/evaluation'
import { cslExUnits, cslPlutusScript, cslPlutusV2, cslRedeemer, requireExtDatum, requireExtDatumSource, tokenTyphonToCSL, txOutRefBytes, valueTyphonToCSL, type CompiledPolicy, type CompiledScript, type TransactionUnspentOutputExt } from 'src/csl/common'
import type { NetworkId } from '@stricahq/typhonjs/dist/types.js'
import type { Output, Token, TyphonValue } from 'src/typhon/api'
import { cslScriptEnterpriseAddr, shelleyPaymentCredType } from 'src/csl/address'
import { pickRecursiveIgnore, type PickRecursiveIgnore, type PickRecursiveIgnore_ } from 'ts-practical-fp'
import { plutusEmptyConstructor } from './plutusData'
import { KeyedSet } from 'ts-practical-fp'
import { singleton, unique } from 'ts-practical-fp'
import blakejs from 'blakejs'
import { generateScriptDataHash } from '@stricahq/typhonjs/dist/utils/helpers'
import { encodeWitnesses } from '@stricahq/typhonjs/dist/utils/encoder'
import { typhonAdd } from 'src/typhon/math'
import { valueCSLToTyphon } from 'src/typhon/common'
import { addFrom, appendIterable, cslFilter, foreachIterable, fromCslDictionary, fromCslIterable, mapIterable, toCslIterable } from 'src/csl/iterable'
import { components } from '@blockfrost/openapi'
import { BlockFrostAPI } from '@blockfrost/blockfrost-js'
import { EvaluationResult } from '@cardano-ogmios/client/dist/TxSubmission/index.js'

export function makeTxBuilderCfg({protocolParams}: { protocolParams: ProtocolParams | components['schemas']['epoch_param_content']}) {
   if ('maxTxSize' in protocolParams) {
      return makeTxBuilderCfgGraphql({protocolParams})
   } else if ('max_tx_size' in protocolParams) {
      return makeTxBuilderCfgBlockfrost({protocolParams})
   }
   throw new Error('makeTxBuilderCfg: unknown protocolParams format')
}

export function makeTxBuilderCfgGraphql({protocolParams: protocol}: {protocolParams: ProtocolParams}) {
   const makeInterval = (n: number) => {
      const {numerator, denominator} = toFraction(n)
      return LCSL.UnitInterval.new(toBigNum(numerator), toBigNum(denominator))
   }
   return LCSL.TransactionBuilderConfigBuilder.new()
      .fee_algo(LCSL.LinearFee.new(
         toBigNum(protocol.minFeeA),
         toBigNum(protocol.minFeeB)
      ))
      .pool_deposit(toBigNum(protocol.poolDeposit))
      .key_deposit(toBigNum(protocol.keyDeposit))
      .max_value_size(Number(protocol.maxValSize))
      .max_tx_size(protocol.maxTxSize)
      .coins_per_utxo_byte(toBigNum(protocol.coinsPerUtxoByte))
      .ex_unit_prices(LCSL.ExUnitPrices.new(
         makeInterval(protocol.priceMem),
         makeInterval(protocol.priceStep)
      ))
      .prefer_pure_change(true)
      .build()
}

export function makeTxBuilderCfgBlockfrost({protocolParams: protocol}: {protocolParams: components['schemas']['epoch_param_content']}) {
   const makeInterval = (n: number) => {
      const {numerator, denominator} = toFraction(n)
      return LCSL.UnitInterval.new(toBigNum(numerator), toBigNum(denominator))
   }
   return LCSL.TransactionBuilderConfigBuilder.new()
      .fee_algo(LCSL.LinearFee.new(
         toBigNum(protocol.min_fee_a),
         toBigNum(protocol.min_fee_b)
      ))
      .pool_deposit(toBigNum(protocol.pool_deposit))
      .key_deposit(toBigNum(protocol.key_deposit))
      .max_value_size(Number(protocol.max_val_size))
      .max_tx_size(protocol.max_tx_size)
      .coins_per_utxo_byte(toBigNum(protocol.coins_per_utxo_size ?? 'NaN'))
      .ex_unit_prices(LCSL.ExUnitPrices.new(
         makeInterval(protocol.price_mem ?? -1),
         makeInterval(protocol.price_step ?? -1)
      ))
      .prefer_pure_change(true)
      .build()
}

export type CSLPipeTxConstraints = {
   amount: BigNumber // amount added to output, can be negative
   fee: BigNum
}

export const noConstraints = () => ({amount: new BigNumber(0), fee: toBigNum(0)})

// Fee is positive, it is subtracted from amount in constraints
export const constraintsWithFee = (c: CSLPipeTxConstraints, fee: BigNum) => {
   console.log('in constraintsWithFee')
   const amount = c.amount.minus(fromBigNum(fee))
   console.log('out constraintsWithFee', amount.toString())
   return {
      ...c, amount: c.amount.minus(fromBigNum(fee)), fee
   }
}

// Used to set fee for transaction with single input and single output
// export const tryMakePipeTxCSL = (
//    pp: ProtocolParams,
//    makeTx: (input: TransactionUnspentOutput, constraints: CSLPipeTxConstraints) => Promise<TransactionBuilder | null>,
//    constraints: CSLPipeTxConstraints, feeOffset = toBigNum(0)) =>
//    async (it: TransactionUnspentOutput): Promise<LCSL.TransactionBuilder | null> => {
//    const res1 = await makeTx(it, constraints)
//    // This is a pipe tx - a single output is expected
//    res1
//    const fee = .calculateFee().plus(feeOffset)
//    const minAda = cslMinUTxOBabbage(pp, it.tokens, new BigNumber(.coinsPerUtxoWord), false)
//    const lovelace = (constraints.amount ?? new BigNumber(0)).minus(fee)
//    if (it.amount.lt(minAda.minus(lovelace))) return undefined
//    let tx = await makeTx(it, {...constraints, amount: lovelace})
//    tx.setFee(fee)
//    return tx
// }

// https://cips.cardano.org/cips/cip55/
export const cslMinUTxOBabbage = (ctx: {protocolParams: ProtocolParams}, out: TransactionOutput) =>
   toBigNum((160 + out.to_bytes().length) * ctx.protocolParams.coinsPerUtxoByte)

export function cslCalculateFee(pp: ProtocolParams, tx: Transaction, cost: ExUnits) {
   const txBytesLength = tx.to_bytes().length
   const overheadBytes = 0 // 15
   return toBigNum(Math.ceil(
      (txBytesLength + overheadBytes) * pp.minFeeA
    + cost.memory * pp.priceMem
    + cost.steps * pp.priceStep
    + pp.minFeeB))
}

export const evaluationTotalAndFee = (protocolParams: ProtocolParams, units: ExUnits[]) => {
   console.log('evaluationTotalAndFee', units)
   const totalExUnits = Object.values(units).reduce((acc, cur) =>
   ({ memory: acc.memory + cur.memory, steps: acc.steps + cur.steps }),
   { memory: 0, steps: 0 })
   const extraBytes = units
      .map(m => (numToHex(m.memory).length + numToHex(m.steps).length) / 2)
      // .reduce((a, b) => a + b, 0)
      .reduce((a, b) => a + b + 1, -1)
   if (extraBytes < 0) {
      console.log('extraBytes < 0 !')
      return { totalExUnits: { memory: 0, steps: 0 } as ExUnits, additionalFee: toBigNum(0) }
   }
   const additionalFee = toBigNum(extraBytes * protocolParams.minFeeA)
   return { totalExUnits, additionalFee }
}

function isSomeA(arg: TransactionInput | TransactionUnspentOutput): arg is TransactionInput {
   return arg instanceof LCSL.TransactionInput;
 }

export const eqTransactionInput = <T extends TransactionInput | TransactionUnspentOutput>(a: T, b: T): boolean => {
   if (a instanceof LCSL.TransactionInput) {
      const _b = b as TransactionInput
      return uint8ArrayEqual(a.transaction_id().to_bytes(), _b.transaction_id().to_bytes()) && a.index() === _b.index()
   } else {
      const _b = b as TransactionUnspentOutput
      return eqTransactionInput(a.input(), _b.input())
   }
}

//       ? uint8ArrayEqual(a.transaction_id().to_bytes(), b.transaction_id().to_bytes()) && a.index() === b.index()
//       : eqTransactionInput(a.input(), b.)

export const addInputFromUTxO =
   <T extends {add_input(address: Address, input: TransactionInput, amount: Value): void}>
   (obj: T, input: TransactionUnspentOutput) =>
   obj.add_input(input.output().address(), input.input(), input.output().amount())

export const addScriptInputFromUTxO =
   (builder: TransactionBuilder, input: TransactionUnspentOutput, script: PlutusScript | PlutusScriptSource, datum: PlutusData, redeemer: Redeemer) =>
   builder.add_plutus_script_input(
      script instanceof LCSL.PlutusScript
         ? LCSL.PlutusWitness.new(script, datum, redeemer)
         : LCSL.PlutusWitness.new_with_ref(script, datum, redeemer),
      input.input(),
      input.output().amount()
   )

export const addScriptInputFromUTxOExt =
   (builder: TransactionBuilder /*, witnesses: TransactionWitnessSet*/, input: TransactionUnspentOutputExt, script: PlutusScript | PlutusScriptSource, redeemer: Redeemer) => {
   // console.log('input.datum', input.datum)
   const witness = script instanceof LCSL.PlutusScript
      // TODO: remove temp solution plutusEmptyConstructor() !!
      ? (input.datum ? LCSL.PlutusWitness.new(script, requireExtDatum(input), redeemer) : LCSL.PlutusWitness.new_without_datum(script, redeemer))
      // TODO: remove temp solution LCSL.DatumSource.new(plutusEmptyConstructor()) !!
      : (input.datum ? LCSL.PlutusWitness.new_with_ref(
         script,
         requireExtDatumSource(input),
         redeemer) : LCSL.PlutusWitness.new_with_ref_without_datum(script, redeemer))
   // builder.add_script_input(LCSL.ScriptHash.from_hex(hash), input.input(), input.output().amount())
   builder.add_plutus_script_input(witness,
      input.input(),
      input.output().amount()
   )
   // const x = LCSL.PlutusWitnesses.new()
   // x.add(witness)
   // builder.add_required_plutus_input_scripts(x)
   // const rdmrs = witnesses.redeemers() ?? LCSL.Redeemers.new()
   // rdmrs.add(redeemer)
   // witnesses.set_redeemers(rdmrs)
}

export function setCollateral(txBuilder: TransactionBuilder, utxos: TransactionUnspentOutput[]) {
   const inputBuilder = LCSL.TxInputsBuilder.new()
   utxos.forEach(utxo => {
     addInputFromUTxO(inputBuilder, utxo)
   })
   txBuilder.set_collateral(inputBuilder)
}

// export type InlineScriptRef = {
//    ref: ScriptRef
//    input: TransactionInput
// }

export type MintDetails = {
   source: PlutusScriptSource,
   redeemer: PlutusData
}

export type RawMintDetails = MintDetails | {
   cbor: Hex,
   lang: Language,
   redeemer: PlutusData
}

export const mintDetails = (
   cbor: Hex,
   lang: Language,
   redeemer: PlutusData) =>
   cookMintDetails({cbor, lang, redeemer})

export const cookMintDetails = (raw: RawMintDetails) =>
   'cbor' in raw
      ? ({ source: LCSL.PlutusScriptSource.new(cslPlutusScript(raw)), redeemer: raw.redeemer })
      : raw

const mintDetailsToWitness = (evaluation: EvaluationCost, d: MintDetails) => (index: number) =>
   LCSL.PlutusWitness.new_with_ref_without_datum(d.source, cslRedeemer(evaluation, 'mint', index, d.redeemer))

// Returns plutus mints sorted by policyId
// TODO: add handling of native script witnesses
const unpackMintBuilder = (mintBuilder: MintBuilder) => {
   const witnesses = fromCslIterable(mintBuilder.get_plutus_witnesses())
   const built = mintBuilder.build()
   const policies = sortOn_(compareHex, a => makeHex(a.to_hex()), fromCslIterable(built.keys())) // Check if keys are returned sorted or not
   const mintAssets = policies.map(p => tuple(p, built.get_all(p)!))
   // We assume that only one redeemer per policyId is possible, so we can accumulate MintsAssets into one MintAssets
   return mintAssets.map(([hash, mintsAssets]) => {
      const witness = witnesses.find(w => w.script()!.hash().to_hex() == hash.to_hex())!
      const assets = fromCslIterable(mintsAssets).flatMap(x => fromCslDictionary(x)).map(a => ({assetName: a[0], amount: fromCSLInt(a[1])}))
      return tuple ({policyId: hash, assets}, (i: number) => witness.clone_with_redeemer_index(toBigNum(i)))
   })
}

const packMintBuilder = (mints: [CSLAssetsExt, (i: number) => PlutusWitness][]) => {
   const mint = LCSL.MintBuilder.new()
   for (const [i, [tokens, details]] of mints.entries()) {
      const wtns = details(i)
      for (const token of fromCSLAssetsExt(tokens)) {
         const witness = LCSL.MintWitness.new_from_plutus_witness(wtns) // LCSL.MintWitness.new_plutus_script(source, rdmr)
         mint.set_asset(
            witness,
            token.assetName,
            toCSLInt(token.amount)
         )
      }
   }
   return mint
}

const prepareMintData = (evaluation: EvaluationCost) => ([a, b]: [CSLTokenExt | CSLAssetsExt, RawMintDetails]) =>
   tuple(toCSLAssetsExt(a), mintDetailsToWitness(evaluation, cookMintDetails(b)))

/**
 * Adds mint tokens, drops previouly added mints
 * The following error can occur if tokens in `mints` are not sorted by policyId:
 * ===
 * ValidatorFailedError: {"error":"An error has occurred: User error:\nThe machine terminated because of an error,
 * either from a built-in function or from an explicit use of 'error'.\nCaused by:
 * [ (force (builtin headList)) (con list (data) []) ]","traces":[]}
 * ===
 * This happens because if order of tokens in `mints` argument happens to not match their order by policyId value -
 * there will be a mismatch between declared mint index and the position of corresponding mint and redeemer elements in submitted transaction
 * So we are sorting argument `mints` by policyId
 * TODO: solve the case when `setMintBuilder` is called multiple times during tx creation -
 * that means sorting needs to take already added mints into account
 * @param builder 
 * @param evaluation 
 * @param mints 
 */
export const setMintBuilder = (builder: TransactionBuilder, evaluation: EvaluationCost, mints: [CSLTokenExt | CSLAssetsExt, RawMintDetails][]) => {
   // Sort by policyId to match indexes with mint redeemer order in a built transaction
   sortOn_(compareHex, a => makeHex(a[0].policyId.to_hex()), mints)
   const mints_ = mints.map(prepareMintData(evaluation))
   const mint = packMintBuilder(mints_)
   builder.set_mint_builder(mint)
}

const combineMints = (next: [CSLAssetsExt, (i: number) => PlutusWitness], old: [CSLAssetsExt, (i: number) => PlutusWitness]) => {
   next[1](0).free() // Free unneeded memory
   const assets = unionOn(a => a.assetName.to_hex(), (next, old) => ({ assetName: old.assetName, amount: next.amount /*.plus(old.amount)*/ }),
      next[0].assets, old[0].assets)
   return tuple({policyId: old[0].policyId, assets}, old[1])
}

// Add mints to the builder in the order of their policyId, accounting for previously added mints
// Overwrites quantity of previously added mints
export const updateMintBuilder = (builder: TransactionBuilder, evaluation: EvaluationCost, mints: [CSLTokenExt | CSLAssetsExt, RawMintDetails][]) => {
   const mintBuilder = builder.get_mint_builder() ?? LCSL.MintBuilder.new()
   // `unpacked` is sorted by policyId to match indexes with mint redeemer order in a built transaction
   const unpacked = unpackMintBuilder(mintBuilder)
   const mints_ = mints.map(prepareMintData(evaluation))
   const newMints = upsertSortedOnWith_(compareHex, a => makeHex(a[0].policyId.to_hex()), combineMints, mints_, unpacked)
   builder.set_mint_builder(packMintBuilder(newMints))
}

export const logRet = <T>(str: string, t: T, f: (arg0: T) => string) => (console.log(str, f(t)), t)

export const setMetadata = (builder: TransactionBuilder, metadata: Record<string, unknown>) => {
   // const auxiliaryData = LCSL.AuxiliaryData.new()
   // const txMetadata = LCSL.GeneralTransactionMetadata.new()
   // Object.entries(metadata).forEach(([key, val]) =>
   //    txMetadata.insert(
   //       LCSL.BigNum.from_str(key),
   //       LCSL.encode_json_str_to_metadatum(JSON.stringify(val), MetadataJsonSchema.BasicConversions)
   //    ))

   // auxiliaryData.set_metadata(txMetadata)
   // builder.set_auxiliary_data(auxiliaryData)
   const txMetadata = LCSL.GeneralTransactionMetadata.new()
   Object.entries(metadata).forEach(([key, val]) =>
      txMetadata.insert(
         LCSL.BigNum.from_str(key),
         LCSL.encode_json_str_to_metadatum(JSON.stringify(val), LCSL.MetadataJsonSchema.BasicConversions)
      ))
   builder.set_metadata(txMetadata)
}


// holder - contract that can be used to store inline script and secured by witness token
// witness - witness token that can be minted in this tx and confirms authenticity of UTxO
// returns minAda required for new UTxO
export const mintInlineScript = (
   ctx: {network: NetworkId, protocolParams: ProtocolParams},
   builder: TransactionBuilder,
   evaluation: EvaluationCost,
   holder: {cbor: Hex, hash: Hex},
   witnessMint: Token & RawMintDetails, //{cbor: Hex, policyId: Hex, assetName: Hex, lang: Language, redeemer: PlutusData, amount: BigNumber},
   inline: CompiledScript | CompiledPolicy ) => { // {cbor: Hex, /* hash: Hex,*/ lang: Language}) => {
   const witnessToken = tokenTyphonToCSL(witnessMint)
   const mkHolderUTxO = (minAda: BigNum) => {
      const {value} = cslValueWithTokens(
         LCSL.Value.new(minAda),
         [ witnessToken ]
      )
      const utxo = LCSL.TransactionOutput.new(cslScriptEnterpriseAddr(ctx, holder.hash), value)
      utxo.set_script_ref(LCSL.ScriptRef.new_plutus_script(cslPlutusScript(inline)))
      utxo.set_data_hash(LCSL.hash_plutus_data(plutusEmptyConstructor()))
      return utxo
   }
   // const minAda = maybeAddOutput(builder, mkHolderUTxO)
   // if (!minAda) return null
   const {minAda} = requireAddOutput(ctx, builder, mkHolderUTxO)
   console.log('mintInlineScript out set', minAda.to_str())
   updateMintBuilder(builder, evaluation, [
      [ toCSLTokenExt(witnessToken), witnessMint ]
   ])
   return minAda
}


// Returns null if UTxO doesn't have enough for minAda
// Delta is a positive amount that needs to be added to original ada to reach minAda
export const maybeAddOutput = (
   ctx: {protocolParams: ProtocolParams},
   builder: TransactionBuilder | null,
   mkUTxO: (minAda: BigNum) => TransactionOutput | null) => {
   const zeroutxo = mkUTxO(toBigNum(0))
   if (!zeroutxo) return null
   const originalCoin = zeroutxo.amount().coin()
   // console.log('originalCoin', originalCoin.to_str())
   // console.log('requireAddOutput zeroutxo', zeroutxo.amount().coin().to_str())
   // const minAda = builder.fee_for_output(cslUpdateCoin(() => toBigNum(16777215 /* 0xFFFFFF */))(zeroutxo))
   const minAda = cslMinUTxOBabbage(ctx, cslUpdateCoin(c => cslMax(c, toBigNum(16777215 /* 0xFFFFFF */)))(zeroutxo))
   // console.log('requireAddOutput b', minAda.to_str())
   const utxo = mkUTxO(minAda)
   // console.log('maybeAddOutput utxo', utxo?.amount().coin().to_str())
   if (!utxo) return null
   // console.log('maybeAddOutput minAda', minAda.to_str())
   // console.log('utxo', utxo.amount().coin().to_str())
   if (comparedBigNum('LT', utxo.amount().coin(), minAda)) return null
   console.log('maybeAddOutput adding', utxo.amount().coin().to_str())
   builder?.add_output(utxo)
   // const delta = minAda.clamped_sub(zeroutxo.amount().coin())
   const minAdaDelta = minAda.clamped_sub(originalCoin)
   // console.log('requireAddOutput f')
   return { minAda, minAdaDelta, coin: utxo.amount().coin(), amount: utxo.amount() }
}

export const requireAddOutput = (
   ctx: {protocolParams: ProtocolParams},
   builder: TransactionBuilder | null,
   mkUTxO: (minAda: BigNum) => TransactionOutput | null) => {
   const result = maybeAddOutput(ctx, builder, mkUTxO)
   if (!result) throw new Error('requireAddOutput: unexpected not enough Ada')
   return result
}

// const checkedAddOutput = (builder: TransactionBuilder, utxo: TransactionOutput) => {
//    const minAda = builder.fee_for_output(utxo)
//    if (comparedBigNum('LT', utxo.amount().coin(), minAda)) {
//       // throw new Error()
//       return null
//    }
//    builder.add_output(utxo)
//    return minAda
// }

export const addDatumWitness = (witnesses: TransactionWitnessSet, datum: PlutusData) => {
   const datums = witnesses.plutus_data() ?? LCSL.PlutusList.new()
   datums.add(datum)
   witnesses.set_plutus_data(datums)
}

// // Mutates builder
// export const calcScriptDataHash0 = (costmdls: Costmdls, builder: TransactionBuilder, witnesses?: TransactionWitnessSet) => {
//    if (!witnesses?.plutus_data()) {
//       builder.calc_script_data_hash(LCSL.TxBuilderConstants.plutus_vasil_cost_models())
//    }
//    // calc_script_data_hash doesn't calculate hash when plutus_data was added to witnesses only
//    // So we need to calculate hash manually
//    // if (!builder.build().script_data_hash()) {
//    else {
//       const redeemers = LCSL.Redeemers.new()
//       const datums = LCSL.PlutusList.new();
//       (w => {
//          if (w) addFrom(datums, w)
//       })
//       (witnesses?.plutus_data())
//       const scripts = builder.get_plutus_input_scripts()
//       console.log('scripts.len()', scripts?.len())
//       if (scripts) for (let i = 0; i < scripts.len(); ++i) {
//          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
//          const rdmr = builder.get_plutus_input_scripts()!.get(i).redeemer()
//          redeemers.add(rdmr)
//          datums.add(rdmr.data())
//       }
//       // const plutusWitnessHash = LCSL.hash_script_data(redeemers, costmdls, witnesses.plutus_data())
//       const plutusWitnessHash = LCSL.hash_script_data(redeemers, costmdls, datums)
//       builder.set_script_data_hash(plutusWitnessHash)
//    }
// }

// Mutates builder
export const updateScriptDataHash = (costmdls: Costmdls, builder: TransactionBuilder, witnesses?: TransactionWitnessSet) => {
   if (!witnesses?.plutus_data()) {
      builder.calc_script_data_hash(costmdls)
   }
   // calc_script_data_hash doesn't calculate hash when plutus_data was added to witnesses only
   // So we need to calculate hash manually
   else {
      builder.set_script_data_hash(LCSL.ScriptDataHash.from_hex('0024cdcde8506abe9838047ec4167a910eef7f3c4615da4ebefc30bab21deef9'))
      const built = builder.build_tx()
      console.log('aa')
      const finalWitnesses = mergeWitnesses([built.witness_set(), witnesses])
      console.log('bb')
      const redeemers = LCSL.Redeemers.new()
      const datums = LCSL.PlutusList.new();
      (w => {
         if (w) addFrom(datums, w)
      })
      (witnesses?.plutus_data())
      const scripts = builder.get_plutus_input_scripts()
      console.log('scripts.len()', scripts?.len())
      if (scripts) for (let i = 0; i < scripts.len(); ++i) {
         // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
         const rdmr = builder.get_plutus_input_scripts()!.get(i).redeemer()
         redeemers.add(rdmr)
         datums.add(rdmr.data())
      }
      console.log('cc')
      // const plutusWitnessHash = LCSL.hash_script_data(redeemers, costmdls, witnesses.plutus_data())
      const rs = finalWitnesses.redeemers() ?? LCSL.Redeemers.new()
      const ds = finalWitnesses.plutus_data()
      // const plutusWitnessHash = LCSL.hash_script_data(redeemers, costmdls, datums)
      console.log('dd')
      const plutusWitnessHash = LCSL.hash_script_data(rs, costmdls, ds ? cslClone(LCSL.PlutusList, ds) : undefined)
      console.log('ee')
      builder.set_script_data_hash(plutusWitnessHash)
   }
}

const witnessLanguage = (w: PlutusWitness) => w.script()?.language_version().to_hex()
const usedLangs = (w: PlutusWitnesses) => {
   // const used_langs = new KeyedSet(witnessLanguage)
   // // for (let i = 0; i < w.)
   // addFrom(used_langs, cslFilter(LCSL.PlutusWitnesses.new(), x => !!x.script(), w))
   // return Array.from(used_langs).map(witnessLanguage)
   return unique(fromCslIterable(w).map(witnessLanguage)).filter(nonNull)
}

export const calcScriptDataHash2 = (cost_models: Costmdls, builder: TransactionBuilder, witnesses?: TransactionWitnessSet) => {
   // if (!witnesses?.plutus_data()) {
   //    return builder.calc_script_data_hash(LCSL.TxBuilderConstants.plutus_vasil_cost_models())
   // }
   
   const used_langs = new Set<string>()
   const retained_cost_models = LCSL.Costmdls.new();
   const plutus_witnesses = LCSL.PlutusWitnesses.new();
   const otherDatums: PlutusData[] = [];
   const otherRedeemers: Redeemer[] = [];
   (ws => { if (ws) {
      usedLangs(ws).forEach(l => used_langs.add(l))
      addFrom(plutus_witnesses, ws)
   }})(builder.get_plutus_input_scripts());
      //   if let Some(mut collateral_plutus) = self.collateral.get_plutus_input_scripts() {
      //       used_langs.append(&mut self.collateral.get_used_plutus_lang_versions());
      //       plutus_witnesses.0.append(&mut collateral_plutus.0)
      //   }
   (ws => { if (ws) {
      usedLangs(ws).forEach(l => used_langs.add(l))
      addFrom(plutus_witnesses, ws)
   }})(builder.get_mint_builder()?.get_plutus_witnesses());

   (d => { if (d) {
      otherDatums.push(...fromCslIterable(d))
   }})(witnesses?.plutus_data())

   if (plutus_witnesses.len() > 0) {
      const datums_ = mapIterable(plutus_witnesses, w => w.datum()).filter(nonNull)
      const redeemers_ = mapIterable(plutus_witnesses, w => w.redeemer()).filter(nonNull)
      // const scripts = mapIterable(plutus_witnesses, w => w.script()).filter(nonNull)
      for (const langHex of used_langs) {
         const lang = LCSL.Language.from_hex(langHex)
         const mdl = cost_models.get(lang)
         if (!mdl) throw new Error(`Missing cost model for language version: ${lang.to_json()}`)
         retained_cost_models.insert(lang, mdl)
      }
      const redeemers = toCslIterable(LCSL.Redeemers.new(), redeemers_ /*.concat(otherRedeemers)*/ )
      const redDatums = mapIterable(redeemers, r => r.data())
      const datums = cslClone(LCSL.PlutusList, toCslIterable(LCSL.PlutusList.new(), [...otherDatums, ...datums_, ...redDatums]))
      console.log('hashScriptData params')
      foreachIterable(redeemers, d => console.log(d.to_json()))
      if (datums) foreachIterable(datums, d => console.log(d.to_json(LCSL.PlutusDatumSchema.DetailedSchema)))
      console.log('/hashScriptData')
      builder.set_script_data_hash(LCSL.hash_script_data(
         redeemers,
         cost_models,
         datums
      ))
   }
}

// https://github.com/Emurgo/cardano-serialization-lib/blob/master/rust/src/utils.rs
const hashScriptData = (redeemers: Redeemers, cost_models: Costmdls, datums?: PlutusList | undefined) => {
   const scriptData: string[] = []
   if (redeemers.len() == 0 && datums && datums.len() > 0) {
      scriptData.push('80')
      // foreachIterable(datums, d => scriptData.push(d.to_hex()))
      scriptData.push(datums.to_hex())
      scriptData.push('A0')
   } else {
      console.log('hashScriptData params')
      foreachIterable(redeemers, d => console.log(d.to_json()))
      if (datums) foreachIterable(datums, d => console.log(d.to_json(LCSL.PlutusDatumSchema.DetailedSchema)))
      console.log('/hashScriptData')
      scriptData.push(redeemers.to_hex())
      if (datums && datums.len() > 0) {
         // foreachIterable(datums, d => scriptData.push(d.to_hex()))
         scriptData.push(datums.to_hex())
      }
      scriptData.push(cost_models.to_hex());
   }
   return LCSL.ScriptDataHash.from_bytes(blakejs.blake2b(fromHex(makeHex(scriptData.join(''))), undefined, 32))
}

// Positive value to be subtracted from wallet
export function pickAnotherInputFor<Result>(ctx: { protocolParams: ProtocolParams }, builder: TransactionBuilder, delta: TyphonValue, finishTx: (inputPicker: PickRecursiveIgnore<TransactionUnspentOutput, Result | Error>) => Promise<Result | Error | null>): PickRecursiveIgnore_<TransactionUnspentOutput, Result | Error> {
   return async (input, inputPicker) => {
      const mkUTxO = () => {
         const value = valueTyphonToCSL(typhonAdd(valueCSLToTyphon(cslOutputValue(input)), delta))
         if (!value) return null
         return LCSL.TransactionOutput.new(input.output().address(), value)
      }
      if(!maybeAddOutput(ctx, builder, mkUTxO)) return null
      addInputFromUTxO(builder, input)
      return finishTx(inputPicker)
   }
}

// Allows to pick input to deposit Ada to, or withdraw Ada from
// Negative value means Ada is subtracted from wallet
export function pickAnotherInputForAda<Result>(
   ctx: { protocolParams: ProtocolParams },
   builder: TransactionBuilder,
   delta: BigNumber,
   finishTx: (inputPicker: PickRecursiveIgnore<TransactionUnspentOutput, Result | Error>, selectedInput: TransactionUnspentOutput) => Promise<Result | Error | null>,
   message?: string): PickRecursiveIgnore_<TransactionUnspentOutput, Result | Error> {
   return async (input, inputPicker) => {
      const mkUTxO = () => {
         const value = cslUpdateCoin(c => clamped_add(c, delta))(cslOutputValue(input))
         return LCSL.TransactionOutput.new(input.output().address(), value)
      }
      if(!maybeAddOutput(ctx, builder, mkUTxO)) return message ? new Error(message) : null
      addInputFromUTxO(builder, input)
      return finishTx(inputPicker, input)
   }
}

// ========= Transaction building =========

export type BuilderResult = TransactionBuilder | { builder: TransactionBuilder, witnesses: TransactionWitnessSet }


const reduceWitnesses = (acc: TransactionWitnessSet, a: TransactionWitnessSet) => {
   appendIterable(acc, a, a.bootstraps,     acc.set_bootstraps)
   appendIterable(acc, a, a.native_scripts, acc.set_native_scripts)
   appendIterable(acc, a, a.plutus_data,    acc.set_plutus_data)
   appendIterable(acc, a, a.plutus_scripts, acc.set_plutus_scripts)
   appendIterable(acc, a, a.redeemers,      acc.set_redeemers)
   appendIterable(acc, a, a.vkeys,          acc.set_vkeys)
   return acc
}

const mergeWitnesses = (witnessSets: TransactionWitnessSet[]) =>
   witnessSets.reduce(reduceWitnesses, LCSL.TransactionWitnessSet.new())

const processScriptDataHash = (costmdls: Costmdls, result: BuilderResult) => {
   if ('builder' in result) {
      updateScriptDataHash(costmdls, result.builder, result.witnesses)
   } else {
      updateScriptDataHash(costmdls, result)
   }
}

const jsonToCostModel = (numbers: number[]) => {
   const mdl = LCSL.CostModel.new()
   numbers.forEach((num, i) => mdl.set(i, LCSL.Int.new_i32(num)))
   return mdl
}

const fetchCostmdls = (ctx: {protocolParams: ProtocolParams}) => {
   const costmdls = LCSL.Costmdls.new()
   costmdls.insert(LCSL.Language.new_plutus_v2(), jsonToCostModel(ctx.protocolParams.costModel.PlutusV2))
   // return LCSL.TxBuilderConstants.plutus_vasil_cost_models()
   return costmdls
}

const completeDummy = async (
   ctx: {ogmiosEndpoint: string, blockfrostApi: BlockFrostAPI, protocolParams: ProtocolParams},
   dummyTx: Transaction, expectedSignatures: Ed25519KeyHash[]) =>  {
   const signedDummyTx = await dummySignTx(dummyTx, expectedSignatures)
   console.log('dummy tx', signedDummyTx.to_json())
   // const { rawEval, cost } = await cslEvalTxOgmios(ctx)(signedDummyTx)
   const { rawEval, cost } = await cslEvalTxBlockfrost(ctx)(signedDummyTx)
   const { totalExUnits, additionalFee } = evaluationTotalAndFee(ctx.protocolParams, rawEval)
   const fee = cslCalculateFee(ctx.protocolParams, signedDummyTx, totalExUnits).checked_add(additionalFee)
   return { cost, fee }
}

const buildResult = (costmdls: Costmdls) => (result: BuilderResult) => {
   processScriptDataHash(costmdls, result)
   return 'builder' in result
   ? (built => LCSL.Transaction.new(built.body(), mergeWitnesses([built.witness_set(), result.witnesses]), built.auxiliary_data()))
      (result.builder.build_tx())
   : result.build_tx()
}

export type SimpleTxStrategy = {simple: (
   evaluation: EvaluationCost,
   constraints: CSLPipeTxConstraints,
   input: TransactionUnspentOutput
) => Promise<BuilderResult | Error | null>}

export const simpleTx = (simple: SimpleTxStrategy['simple']) => ({simple})

export type ComplexTxStrategy = {complex: <Result>(
   evaluation: EvaluationCost,
   constraints: CSLPipeTxConstraints,
   inputPicker: PickRecursiveIgnore<TransactionUnspentOutput, Result | Error>,
   complete: (builder: BuilderResult) => Result | null | Promise<Result | null>
) => Promise<Result | Error | null>}

export const complexTx = (complex: ComplexTxStrategy['complex']) => ({complex})

const isValidResult = <R>(r: R | Error | null): r is R => nonNull(r) && !(r instanceof Error)
// const isValidResult = <R>(r: R | Error | null): r is R => {
//    if (r instanceof Error) {
//      return false;
//    }
//    return r !== null;
// };

// const processSimpleResult = (
//    ctx: {ogmiosEndpoint: string, protocolParams: ProtocolParams},
//    api: WalletCIP30ApiInstance,
//    cost: EvaluationCost,
//    fee: BigNum,
//    func: ) => async (input: TransactionUnspentOutput) => {
   
// }

const processDummy = (
   ctx: {ogmiosEndpoint: string, blockfrostApi: BlockFrostAPI, protocolParams: ProtocolParams},
   costmdls: Costmdls,
   getSignatures: (tx: Transaction) => Promise<Ed25519KeyHash[]>) =>
   async (result: BuilderResult) => {
   const tx = buildResult(costmdls)(result)
   const expectedSignatures = await getSignatures(tx)
   return completeDummy(ctx, tx, expectedSignatures)
}

const processReal = (
   api: WalletCIP30ApiInstance,
   costmdls: Costmdls) =>
   async (result: BuilderResult) => {
   const tx = buildResult(costmdls)(result)
   return signTx(api, tx)
}

const simpleTxIteration = (
   ctx: {ogmiosEndpoint: string, blockfrostApi: BlockFrostAPI, protocolParams: ProtocolParams},
   api: WalletCIP30ApiInstance,
   strategy: SimpleTxStrategy,
   constraints: CSLPipeTxConstraints,
   dummyFee: BigNum,
   costmdls: Costmdls,
   pagination: () => () => Promise<TransactionUnspentOutput | null>) =>
   async (input: TransactionUnspentOutput) => {

   const getSignatures = getExpectedWalletSignatures(pagination)

   const dummyBuilder = await strategy.simple(dummyEval, constraintsWithFee(constraints, dummyFee), input)
   if (!isValidResult(dummyBuilder)) return dummyBuilder
   const {cost, fee} = await processDummy(ctx, costmdls, getSignatures)(dummyBuilder)

   const realBuilder = await strategy.simple(cost, constraintsWithFee(constraints, fee), input)
   if (!isValidResult(realBuilder)) return realBuilder
   return processReal(api, costmdls)(realBuilder)
}

const trySimpleTxStrategy = async (
   ctx: {ogmiosEndpoint: string, blockfrostApi: BlockFrostAPI, protocolParams: ProtocolParams},
   api: WalletCIP30ApiInstance,
   strategy: SimpleTxStrategy,
   constraints: CSLPipeTxConstraints,
   dummyFee: BigNum,
   costmdls: Costmdls,
   pagination: () => () => Promise<TransactionUnspentOutput | null>) => {
   // ({result} = await paginatedLookupMaybeNonNull({
   //    pageSize,
   //    getBatch: getUTxOPage(api, 50),
   //    func: simpleTxIteration(ctx, strategy, constraints, dummyFee, costmdls, pagination),
   // }))
   let result: Transaction | Error | null = null
   const iterator = pagination()
   let next : TransactionUnspentOutput | null = null
   while (!isValidResult(result) && (next = await iterator())) {
      result = await simpleTxIteration(ctx, api, strategy, constraints, dummyFee, costmdls, pagination)(next)
   }
   return result
}

// Recursive strategy:
// With each recursion the input should be easier to fail
// Failed step of ComplexTxStrategy should not have mutated builder state
// TODO: implement: When the check of built tx fails - the last step of the build is removed and other inputs are considered
const tryComplexTxStrategy = async (
   ctx: {ogmiosEndpoint: string, blockfrostApi: BlockFrostAPI, protocolParams: ProtocolParams},
   api: WalletCIP30ApiInstance,
   strategy: ComplexTxStrategy,
   constraints: CSLPipeTxConstraints,
   dummyFee: BigNum,
   costmdls: Costmdls,
   pagination: () => () => Promise<TransactionUnspentOutput | null>) => {
   console.log('tryComplexTxStrategy')
   const utxoKey = (u: TransactionUnspentOutput) => txOutRefBytes(u.input())
   const getSignatures = getExpectedWalletSignatures(pagination)
   const evaluated = await strategy.complex(
      dummyEval,
      constraintsWithFee(constraints, dummyFee),
      pickRecursiveIgnore(pagination, utxoKey),
      processDummy(ctx, costmdls, getSignatures)
   )
   console.log('tryComplexTxStrategy dummy done')
   if (!isValidResult(evaluated)) return evaluated
   // TODO: work on case when dummy TX is successful but completed tx is not
   const real = await strategy.complex(
      evaluated.cost,
      constraintsWithFee(constraints, evaluated.fee),
      pickRecursiveIgnore(pagination, utxoKey),
      processReal(api, costmdls)
   )
   console.log('tryComplexTxStrategy real done')
   return real
}

const minExpectedAda = 2 // Convenient, not too small amount

const getUTxOPage = (api: WalletCIP30ApiInstance, limit: number) => (param: {page: number}) => api
   // TODO: give the option to specify minimum value for UTxOs:
   // .getUtxos(toHexed(LCSL.Value.new(ada(minExpectedAda)), v => v.to_bytes()), {...param, limit})
   .getUtxos(undefined, {...param, limit})
   .then(mapFromHexed(LCSL.TransactionUnspentOutput))
   // .then(us => ((us ?? []).forEach(u => console.log('getUTxOPage', u.to_json())), us))

export const runStrategies = async (
   ctx: {ogmiosEndpoint: string, blockfrostApi: BlockFrostAPI, protocolParams: ProtocolParams, ttlSeconds: number},
   api: WalletCIP30ApiInstance,
   constraints: CSLPipeTxConstraints,
   dummyFee: BigNum,
   strategies: (SimpleTxStrategy | ComplexTxStrategy | Error)[]) => {
   console.log('in runStrategies', strategies)

   let result: Transaction | Error | null = null
   const costmdls = await fetchCostmdls(ctx)
   const pageSize = 50
   const pagination = paginatedIterator(pageSize, createPaginator(pageSize, getUTxOPage(api, pageSize)))
   for (const strategy of strategies) {
      if ('simple' in strategy) {
         result = await trySimpleTxStrategy(ctx, api, strategy, constraints, dummyFee, costmdls, pagination)
      } else if ('complex' in strategy) {
         result = await tryComplexTxStrategy(ctx, api, strategy, constraints, dummyFee, costmdls, pagination)
      } else {
         result = strategy
      }
      if (isValidResult(result)) break
   }

   if (!result) throw new Error('Couldn\'t find UTxO suitable for transaction!')
   if (result instanceof Error) throw result
   // const signed = await signTx(api, result)
   console.log('FINAL tx', result.to_json())
   const doSubmit = (tx: Transaction) => api.submitTx(toHexed(tx))
   let submit = doSubmit(result);

   (result => {
      // TODO: temporary workaround until https://github.com/Emurgo/cardano-serialization-lib/issues/572 is fixed
      submit = submit.catch((e: Error) => {
         console.log('Caugh on submit:', e)
         const tests = [
            /PPViewHashesDontMatch (?:(?:SNothing)|(?:\(SJust.+\))) \(SJust \(SafeHash \\?"([a-f0-9]{64})/,
            /(?:inferredFromParameters":")([a-f0-9]{64})/
         ]
         let validHash: string | undefined
         for (const test of tests) {
            validHash = test.exec(e.message)?.[1]
            if (validHash) break
         }
         if(!validHash) {
            throw e
         }
         const newBody = result.body()
         newBody.set_script_data_hash(LCSL.ScriptDataHash.from_hex(validHash))
         return signTx(api, LCSL.Transaction.new(newBody, result.witness_set(), result.auxiliary_data()))
      }).then(next => typeof next == 'string' ? next :
         api.submitTx(toHexed(next))
      )
   })(result)

   { // Resubmitting the same transaction multiple times
      // const cooldownSeconds = 20
      // const delaySeconds = 10
      // const repeatCount = Math.max(0, Math.floor((ctx.ttlSeconds - cooldownSeconds) / delaySeconds))
      // const repeatPromise = <T>(count: number, p: () => Promise<T>): () => Promise<void> => () =>
      //    count <= 0
      //    ? Promise.resolve()
      //    : p().catch((e) => { console.log('repeat fail, ', e)}).then(repeatPromise(count - 1, p))

      // submit.then(repeatPromise(repeatCount, 
      //    () => sleep(delaySeconds * 1000).then(() => doSubmit())
      // ))
   }
   // Send tx through ogmios to increase chances of success
   // const submitOgmios = ((result) =>
   //    makeOgmiosContext(ctx)
   //       .then(createTxSubmissionClient)
   //       .then(ogmios => {
   //          const submitOgmios = ogmios.submitTx(toHexed(result))
   //          submitOgmios.then(() => ogmios.shutdown(), () => ogmios.shutdown())
   //          return submitOgmios
   //       })
   //       .catch(e => { throw new Error(e.message ?? 'Unknown Ogmios submission error') })
   // )(result)

   // const ogmios = await makeOgmiosContext(ctx).then(createTxSubmissionClient)
   // const submit = ogmios.submitTx(toHexed(signed))
   // return makeHex(await Promise.any([submit, submitOgmios]))
   return Promise.any([submit /*, submitOgmios*/]).then(makeHex, (e: AggregateError) => {
      throw new Error(e.errors.map(errorMessage).join(';'))
   })
}

const mkdDummyWitness = (hash: TransactionHash) => {
   // const dummyKey = LCSL.PrivateKey.generate_ed25519()
   const dummyKey = LCSL.PrivateKey.from_hex(randomStr(64)('0123456789abcdef'))
   return LCSL.make_vkey_witness(hash, dummyKey)
}

export const dummySignTx = async (tx: Transaction, expectedSignatures: Ed25519KeyHash[]) => {
   const hash = LCSL.hash_transaction(tx.body())
   const witnessSet = tx.witness_set()
   const vkeys = witnessSet.vkeys() ?? LCSL.Vkeywitnesses.new()
   for (let i = 0; i < expectedSignatures.length; ++i) {
      vkeys.add(mkdDummyWitness(hash))
   }
   witnessSet.set_vkeys(vkeys)

   return LCSL.Transaction.new(
      tx.body(),
      witnessSet,
      tx.auxiliary_data()
   )
}

// Find UTxO from iterator matching target TransactionInput
// TODO: refactor using generic iteratorLookup
const requireInputUTxO = (pagination: () => () => Promise<TransactionUnspentOutput | null>) => async (target: TransactionInput) => {
   const iterator = pagination()
   let utxo : TransactionUnspentOutput | null = null
   while (utxo = await iterator()) {
      if(eqTransactionInput(utxo.input(), target)) break
   }
   return utxo
}

const getExpectedWalletSignatures = (pagination: () => () => Promise<TransactionUnspentOutput | null>) => async (tx: Transaction) => {
   const inputs = [...fromCslIterable(tx.body().inputs()), ...fromCslIterable(tx.body().collateral() ?? LCSL.TransactionInputs.new())]
   const utxos = await Promise.all(inputs.map(requireInputUTxO(pagination)))
   return uniqueOn_(x => x.to_hex(),
      [
         ...utxos
            .filter(nonNull)
            .map(u => u.output().address())
            .filter(a => shelleyPaymentCredType(a) == 'PaymentKeyHash')
            .map(a => (LCSL.BaseAddress.from_address(a) ?? LCSL.EnterpriseAddress.from_address(a))!.payment_cred().to_keyhash())
            .filter(nonNull),
         ...fromCslIterable(tx.body().required_signers() ?? LCSL.Ed25519KeyHashes.new())
      ]
   )
}

export async function signTx(wallet: WalletCIP30ApiInstance, tx: Transaction) {
   const witnessSet = tx.witness_set()
   const txVkeyWitnessSet = fromHexed(LCSL.TransactionWitnessSet)
      (await wallet.signTx(toHexed(tx), true)
      .catch(rejectWith))
   const vkeys = txVkeyWitnessSet.vkeys()
   if (!vkeys) {
      throw new Error('Failed to sign transaction')
   }
   witnessSet.set_vkeys(vkeys)
   const signedTx = LCSL.Transaction.new(
      tx.body(), // txBody
      witnessSet,
      tx.auxiliary_data()
   )
   return signedTx
}

export async function signTxExpected(wallet: WalletCIP30ApiInstance, tx: Transaction, expected: Ed25519KeyHash[]) {
   const witnessSet = tx.witness_set()
   const txVkeyWitnessSet = fromHexed(LCSL.TransactionWitnessSet)
      (await wallet.signTx(toHexed(tx), true)
      .catch(rejectWith))
   const vkeys = txVkeyWitnessSet.vkeys()
   if (!vkeys) {
      throw new Error('Failed to sign transaction')
   }

   const expectedSet = new Set(expected.map(h => h.to_hex()))
   const isExpected = (key: Vkeywitness) => expectedSet.has(key.vkey().public_key().hash().to_hex())
   const expectedVkeys = cslFilter(LCSL.Vkeywitnesses.new(), isExpected, vkeys)

   witnessSet.set_vkeys(expectedVkeys)
   const signedTx = LCSL.Transaction.new(
      tx.body(), // txBody
      witnessSet,
      tx.auxiliary_data()
   )
   return signedTx
}

export const cslEvalTxOgmios = (ctx: {ogmiosEndpoint: string}) => async (tx: Transaction) => {
   console.log('in cslEvalTxOgmios', toHex(tx.to_bytes()))
   const ogmios = await makeOgmiosContext(ctx).then(createTxSubmissionClient)
   const res = await ogmios.evaluateTx(tx.to_hex())
   ogmios.shutdown()
   console.log('raw ogmios eval', res)
   const cost = evaluated(res)
   return { rawEval: Object.values(res), cost }
}

export const cslEvalTxBlockfrost = (ctx: {blockfrostApi: BlockFrostAPI}) => async (tx: Transaction) => {
   console.log('in cslEvalTxBlockfrost', toHex(tx.to_bytes()))
   const res = (await (ctx.blockfrostApi as any).utilsTxsEvaluate(tx.to_hex())).result.EvaluationResult as EvaluationResult
   console.log('raw blockfrost eval', res)
   const cost = evaluated(res)
   return { rawEval: Object.values(res), cost }
}

// ========= =========