import type { BlockFrostAPI } from "@blockfrost/blockfrost-js";
import { CardanoTokenMetadata } from "src/types/metadata";
import { TokenClass } from "src/typhon/api";
import { mergeMetadata } from "src/utils/metadata";
import { tuple } from "ts-practical-fp";

export const blockfrostTokenMetadata = (api: BlockFrostAPI) => async (token: TokenClass) => {
   const history = await api.assetsHistoryAll(token.policyId + token.assetName, { order: 'asc' })
   const trxHashes = history.map(h => h.tx_hash)
   if (!trxHashes.length) return null

   const getHashMetadata = async (trxHash: string) => {
      const metadata: Record<number, unknown> = Object.fromEntries(
         (await api.txsMetadata(trxHash)).map(m => tuple(m.label, m.json_metadata))
      )
      return metadata as CardanoTokenMetadata
   }
   const metadatas = await Promise.all(trxHashes.map(getHashMetadata))
   return mergeMetadata(metadatas) as CardanoTokenMetadata
}