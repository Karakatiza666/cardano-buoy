import type { Hex } from "ts-binary-newtypes"

export type GQLTransactionOutput = {
   address: string
   index: number
   txHash: Hex
   tokens: {
      asset: {
         policyId: Hex
         assetName: Hex
      }
      quantity: string
   }[]
   value: string
   script: {
      hash: Hex
      type: 'plutusV1' | 'plutusV2'
   } | null
   datum: {
      hash: Hex
      bytes: Hex
      value: string // | null // metadata json
   } | null
}