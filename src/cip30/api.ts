import type { Hexed } from 'ts-binary-newtypes'
import type { Address, Value, TransactionUnspentOutput, TransactionWitnessSet, Transaction } from '@emurgo/cardano-serialization-lib-browser'

export type WalletCIP30Api = {
   walletType: 'cip30'
   enable(): Promise<WalletCIP30ApiInstance>
   isEnabled() : Promise<boolean>
   apiVersion(): string
   name: string
   icon: string
   // instance?: WalletCIP30ApiInstance
}

export type Bytes = Uint8Array
export type COSE_Sign1 = unknown
export type COSE_Key = unknown
export type DataSignature = {
   signature:Hexed<COSE_Sign1>
   key: Hexed<COSE_Key>
}

export type Paginate = {
   page: number
   limit: number
}
export type hash32 = string
export type WalletCIP30ApiInstance = {
   getNetworkId(): Promise<number>
   getUtxos(amount?: Hexed<Value>, paginate?: Paginate): Promise<Hexed<TransactionUnspentOutput>[] /*| undefined*/>
   getCollateral(params?: {amount: string /*Hexed<Value>*/}): Promise<Hexed<TransactionUnspentOutput>[] | undefined | null>
   getBalance() : Promise<Hexed<Value>>
   getUsedAddresses(paginate?: Paginate): Promise<Hexed<Address>[]>
   getUnusedAddresses(): Promise<Hexed<Address>[]>
   getChangeAddress(): Promise<Hexed<Address>>
   getRewardAddresses(): Promise<Hexed<Address>[]>
   signTx(tx: Hexed<Transaction>, partialSign?: boolean): Promise<Hexed<TransactionWitnessSet>>
   signData(addr: Address, payload: Bytes): Promise<Hexed<DataSignature>>
   submitTx(tx: Hexed<Transaction>): Promise<hash32>
}