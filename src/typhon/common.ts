import type { Address, TransactionUnspentOutput, Value } from "@emurgo/cardano-serialization-lib-browser";
import { NetworkId } from "src/types/network";
import type { CardanoAddress, ShelleyAddress } from "@stricahq/typhonjs/dist/types.js";
import { getAddressFromBech32, getAddressFromHex } from "@stricahq/typhonjs/dist/utils/utils.js";
import BigNumber from "bignumber.js";
import { cslAssetsTyphonValue, cslValueAssets, fromBigNum } from "src/csl/value";
import type { GQLTransactionOutput } from "src/graphql/types";
import type { Input, TyphonValue } from "src/typhon/api";
import { mapTyphonAmount } from "./value";

const typhonNetworks = {
   'mainnet': NetworkId.MAINNET,
   'testnet': NetworkId.TESTNET,
   'preprod': 2,
   'preview': 3
}

export type Network = keyof typeof typhonNetworks
export const readNetwork = (network: Network): NetworkId => typhonNetworks[network]
export const showNetwork = (network: NetworkId) =>
   (n => n ?? (() => { throw new Error(`Unknown network ${network}`)})() )
   (Object.entries(typhonNetworks).find(t => t[1] == network)?.[0] as Network)

export const valueCSLToTyphon = (value: Value) => cslAssetsTyphonValue(cslValueAssets(value))

export const utxoGQLToTyphon = (address: ShelleyAddress) => (o: GQLTransactionOutput) => {
   return {
      txId: o.txHash,
      index: o.index,
      amount: new BigNumber(o.value),
      tokens: o.tokens.map(t => ({...t.asset, amount: new BigNumber(t.quantity)})),
      address
   } as Input
}

export const requireShelleyAddr = (address: CardanoAddress) => 'paymentCredential' in address
   ? address
   : (() => { throw new Error('requireShelleyAddr: Not a Shelley address!')})()

// Doesn't preserve datums or redeemers
export const utxoCSLtoTyphon = (utxo: TransactionUnspentOutput): Input => ({
   txId: utxo.input().transaction_id().to_hex(),
   index: utxo.input().index(),
   amount: fromBigNum(utxo.output().amount().coin()),
   tokens: cslAssetsTyphonValue(cslValueAssets(utxo.output().amount())).tokens,
   address: addressCSLtoTyphon(utxo.output().address())
})

// export const addressCSLtoTyphon = (addr: Address) => requireShelleyAddr(getAddressFromBech32(addr.to_bech32()))
export const addressCSLtoTyphon = (addr: Address) => requireShelleyAddr(getAddressFromHex(addr.to_hex()))

export const printTyphon = (v: TyphonValue) => mapTyphonAmount((a: BigNumber) => a.toFixed())(v)
