// https://docs.typhonwallet.io/api/types.html#paymenttransaction
import type {NativeScript, PlutusScriptType, PlutusScript, Redeemer, /* Token,*/ Asset, NetworkId, ShelleyAddress, PlutusData, CardanoAddress} from '@stricahq/typhonjs/dist/types.js'
import type BigNumber from 'bignumber.js'
import type { Hex } from 'ts-binary-newtypes'

export type WalletTyphonApi = {
   walletType: 'typhon'
   name: string
   icon: string
   version: string
   isEnabled(): Promise<APIResponse<boolean>>
   enable():Promise<APIResponse<boolean>>
   getNetworkId():Promise<APIResponse<NetworkId>>
   getBalance():Promise<APIResponse<Balance>>
   getAddress():Promise<APIResponse<AddressBECH32>>
   getRewardAddress():Promise<APIResponse<AddressBECH32>>
   getTransactionStatus(request: GetTransactionStatus): Promise<APIResponse<Record<TransactionId, TransactionStatus>>>
   paymentTransaction(request: PaymentTransaction): Promise<APIResponse<{ transactionId: TransactionId } | { cbor: CBOR}>>
   delegationTransaction(request: DelegationTransaction): Promise<APIResponse<{ transactionId: TransactionId }>>
   plutusTransaction(request: PlutusTransaction): Promise<APIResponse<{ transactionId: TransactionId } | { cbor: CBOR}>>
   transaction(request: Transaction): Promise<APIResponse<{ transactionId: TransactionId } | { cbor: CBOR}>>
   signData(request: SignData): Promise<APIResponse<CBORCoseSign1, SignDataError>>
}

export enum Reason {ABORT, REJECT, ERROR}
// ABORT	When transaction notification is closed by user or any action taken by System.
// REJECT	When request is Unauthorized or user rejects the request.
// ERROR	When API could not be processed due to an error, Error will be available in error property.

export type APIResponse<T, E = unknown> = {
   status: boolean
   reason?: Reason
   error?: E
   data?: T
}

// === Replace original types to enforce Hex fields ===

export type Token = {
   policyId: Hex // hex PolicyId of token
   assetName: Hex // hex AssetName of token
   amount: BigNumber // Token Balance
}

export type TokenLike<T> = {
   policyId: Hex // hex PolicyId of token
   assetName: Hex // hex AssetName of token
   amount: T // Token Balance
}

export type Balance = {
   ada: string // Total ADA balance in Lovelace
	tokens: Token[]
}

export type TyphonValue = {
  amount: BigNumber
  tokens: Token[]
}

export type TyphonValueLike<T> = {
  amount: T
  tokens: TokenLike<T>[]
}

export type TokenClass = {
   policyId: Hex
   assetName: Hex
}

export type AssetClass = 'lovelace' | TokenClass

export type Input = {
   txId: string
   index: number
   amount: BigNumber
   tokens: Array<Token>
   address: ShelleyAddress
   plutusData?: PlutusData
   redeemer?: Redeemer
}

export type Output = {
   amount: BigNumber;
   address: CardanoAddress;
   tokens: Array<Token>;
   plutusData?: PlutusData;
   plutusDataHash?: string;
}

export type TxIn = {
   txHash: Hex
   index: number
}

// ===  ===

export type AddressBECH32 = string

export type GetTransactionStatus = Array<TransactionId> // Array of TransactionId

export enum TransactionStatus {PENDING, SUCCESS, FAILED}

export type TransactionId = string // hex string

export type CBOR = string // cbor hex string

export type CBORCoseSign1 = string // cbor string of CoseSign1 message structure

export type PaymentTransaction = {
   outputs: Array<TransactionOutput>
   auxiliaryDataCbor?: string // cbor hex string
   submit?: boolean
}

export type DelegationTransaction = {
  poolId: string // hex or bech32
}

export type PlutusTransaction = {
  inputs: Array<PlutusScriptInput>
  outputs?: Array<TransactionOutput>
  requiredSigners?: [string] // hex string
  auxiliaryDataCbor?: string // cbor hex string
  submit?: boolean
}

export type Transaction = {
  inputs?: Array<TransactionInput>
  plutusInputs?: Array<PlutusScriptInput>
  outputs?: Array<TransactionOutput>
  mints?: Array<Mint>
  requiredSigners?: Array<string>
  submit?: boolean
  auxiliaryDataCbor?: string
}

export type SignData = {
  address: string // bech32
  data: string // hex data
}

export type SignDataError = {
   code: SignDataErrorCode
   message: string // error message
}

export enum SignDataErrorCode {
   InvalidAddress = "InvalidAddress",
   InvalidData = "InvalidData"
}

export type TransactionOutput = {
   address: string // bech32
   amount?: string // Lovelace string
   tokens?: Array<Token>
   plutusDataCbor?: string // cbor hex string
   plutusDataHash?: string // hex string
}

export type TransactionInput = {
   txId: string
   index: number
}


export type Mint = {
   policyId: string // hex value
   assets: Array<Asset>
   nativeScript?: NativeScript
   plutusScript?: PlutusScript
   redeemer?: Redeemer
}

//  enum PlutusScriptType {
//    PlutusScriptV1 = "PlutusScriptV1",
//  }

export type PlutusScriptInput = {
  txId: string
  index: number
  plutusDataCbor: string // cbor hex string
  redeemer: Redeemer
  paymentScript: {
    cborHex: string // cbor hex string
    type: PlutusScriptType
  }
  stakeScript?: {
    cborHex: string // cbor hex string
    type: PlutusScriptType
  }
}
//  type NativeScript =
//   | NativeScriptPubKeyHash
//   | NativeScriptInvalidBefore
//   | NativeScriptNOfK
//   | NativeScriptInvalidAfter
//   | NativeScriptAll
//   | NativeScriptAny
