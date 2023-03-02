import type { CardanoMetadata, GetTokenMetadataPayload, TokenMetadataType } from "src/types/metadata"
import type { MetadataCIP25 } from "src/types/metadata/cip25"
import type { MetadataCIP38 } from "src/types/metadata/cip38"
import { deepmerge } from 'deepmerge-ts'
import { toWetHex, type Hex } from "ts-binary-newtypes"
import { maybeHexToUtf8 } from "ts-practical-fp"
import type { TokenClass } from "src/typhon/api"

const emptyTokenMetatadata = (label: string, policyId: Hex, assetName: Hex, version?: string) =>
   <P>(obj: P) => {
      // Cardano token visualization tools have legacy behaviour
      // When hex asset name is a valid UTF8 string - tools expect asset name in metadata to be UTF8 string
      // Otherwise - tools expect a Hex of UTF8 string, prefixed with '0x'
      return {
         [label]: {
            [policyId]: {
               [(label == cip25label ? maybeHexToUtf8(assetName) : null) ?? toWetHex(assetName)]: obj
            },
            ...version !== undefined ? { version } : {}
         }
      } as TokenMetadataType<P>
   }

export const cip25label = '721'
export const initCIP25 = (policyId: Hex, assetName: Hex) => (obj: GetTokenMetadataPayload<MetadataCIP25>, version: string) => {
   const data = emptyTokenMetatadata(cip25label, policyId, assetName, version)(obj)
   return data
}

export const cip38label = '20'
export const initCIP38 = (policyId: Hex, assetName: Hex) => (obj: GetTokenMetadataPayload<MetadataCIP38>, version: string) => {
   const data = emptyTokenMetatadata(cip38label, policyId, assetName, version)(obj)
   return data
}

// Accepts object where key is metadata label and value is metadata itself
export const initTokenMetadata = <T>(customMetadata: Record<number | string, T>, policyId: Hex, assetName: Hex) =>
   Object.entries(customMetadata)
   .map(([label, metadata]) => emptyTokenMetatadata(label, policyId, assetName)(metadata))

export const getTokenMetadata = <T>(label: number, {policyId, assetName}: TokenClass, metadata: TokenMetadataType<T> | null) => {
   const policy = metadata?.[label]?.[policyId]
   if (!policy) return null
   const payload = (utf8 => (utf8 ? policy?.[utf8] : null) ?? policy?.[assetName] ?? policy?.[toWetHex(assetName)] ?? null )(maybeHexToUtf8(assetName))
   // TODO: TEMP WORKAORUND, REMOVE NEXT LINE!
   // if (!payload) payload = Object.entries(policy).find(([name]) => maybeHexToUtf8(assetName)?.includes(name) )?.[1] ?? null
   return payload ?? null
}

// https://stackoverflow.com/questions/27936772/how-to-deep-merge-instead-of-shallow-merge
export const mergeMetadata = <T extends CardanoMetadata[]>(data: [...T]) => deepmerge<T>(...data) // as VariadicProduct<T>
