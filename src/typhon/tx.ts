import type { ProtocolParams } from "src/types/network"
import { BigNumber } from 'bignumber.js'
import { HashType, NetworkId, PlutusScriptType, type BipPath, type Input, type ShelleyAddress, type Token  } from '@stricahq/typhonjs/dist/types.js'
import type { Transaction } from "@stricahq/typhonjs"
import { calculateMinUtxoAmount, getAddressFromBech32, getAddressFromHex } from "@stricahq/typhonjs/dist/utils/utils.js"
import type ShelleyTypeAddress from "@stricahq/typhonjs/dist/address/ShelleyTypeAddress.js"
import { toHex, type Hex } from "ts-binary-newtypes"
import { EnterpriseAddress } from "@stricahq/typhonjs/dist/address/index.js"
import { partition } from "ts-practical-fp"
import type { GQLTransactionOutput } from "src/graphql/types"
// const calculateMinUtxoAmount = (...args: any) => undefined as unknown as BigNumber

type TyphonPipeTxConstraints = {
   amount?: BigNumber // amount added to output, can be negative
}

// Used to set fee for transaction with single input and single output
export const tryMakePipeTxTyphon = (
   pp: ProtocolParams,
   makeTx: (input: Input, constraints: TyphonPipeTxConstraints) => Transaction,
   constraints: TyphonPipeTxConstraints = {}, feeOffset = new BigNumber(0)) =>
   (it: Input) => {
   const minAda = calculateMinUtxoAmount(it.tokens, new BigNumber(pp.coinsPerUtxoByte * 8), false)
   const fee = makeTx(it, constraints).calculateFee().plus(feeOffset)
   const lovelace = (constraints.amount ?? new BigNumber(0)).minus(fee)
   if (it.amount.lt(minAda.minus(lovelace))) return undefined
   const tx = makeTx(it, {...constraints, amount: lovelace})
   tx.setFee(fee)
   return tx
}

export const addressCred = (hash: string, bipPath?: BipPath) => ({
   type: HashType.ADDRESS,
   hash,
   bipPath
})

export const bytesAddress = (hash: Uint8Array) => getAddressFromHex(toHex(hash)) as ShelleyAddress
export const bech32Address = (bech32: string) => getAddressFromBech32(bech32) as ShelleyAddress
export const scriptEnterpriseAddr = (ctx: {network: NetworkId}, {hash, cbor}: {hash: Uint8Array | Hex, cbor?: Uint8Array | Hex}) => {
   const cred = {
      hash: typeof hash == 'string' ? hash : toHex(hash),
      type: HashType.SCRIPT,
      plutusScript: cbor ? plutusScript(cbor) : undefined
   }
   // return new BaseAddress(
   //   typhonNetwork(network),
   //   cred,
   //   undefined
   // )
   return new EnterpriseAddress(ctx.network, cred)
}
export const plutusScript = (cbor: Uint8Array | Hex) => ({
   cborHex: typeof cbor == 'string' ? cbor : toHex(cbor),
   type: PlutusScriptType.PlutusScriptV1
})

// export const stripScript = (address: BaseAddress) => ({hash: address.hash, type: address.type}) as ScriptCredential

export const tokenBlockfrostToTyphon = ({unit, quantity}: {unit: string, quantity: string}) => {
   return {
      policyId: unit.slice(0, 56),
      assetName: unit.slice(56),
      amount: new BigNumber(quantity)
   } as Token
}

export const assetsBlockfrostToTyphon = (allTokens: { unit: string, quantity: string}[]) => {
   const assets = allTokens.map(tokenBlockfrostToTyphon)
   const [lovelace, tokens] = partition(assets, (t: Token) => t.policyId === 'lovelace')
   return {
      amount: lovelace[0].amount,
      tokens
   }
}

export const typhonProtocolParams = (protocolParams: ProtocolParams) => ({
   minFeeA: new BigNumber(protocolParams.minFeeA),
   minFeeB: new BigNumber(protocolParams.minFeeB),
   stakeKeyDeposit: new BigNumber(protocolParams.keyDeposit), // new BigNumber(0),
   lovelacePerUtxoWord: new BigNumber(protocolParams.coinsPerUtxoByte * 8),
   collateralPercent: new BigNumber(protocolParams.collateralPercent),
   priceSteps: new BigNumber(protocolParams.priceStep),
   priceMem: new BigNumber(protocolParams.priceMem),
   languageView: { PlutusScriptV1: protocolParams.costModels.PlutusV1 },
})

export const addressScript = (address: ShelleyTypeAddress) => {
   console.log('address.paymentCredential', address.paymentCredential)
   return address.paymentCredential.type === HashType.SCRIPT
   ? address.paymentCredential.plutusScript
   : undefined
}

// TODO: add signing code
// export const addStakeWitness = (stakeKey: Uint8Array) => (transaction: Transaction) => {
//    const txHash = transaction.getTransactionHash()
//    const pubKey = stakeKey
//    const witness = {
//       publicKey: Buffer.from(pubKey),
//       signature: Buffer.from(stakeKey.sign(txHash).to_bytes())
//    }
//    transaction.addWitness(witness)
// }