import { mapObj } from "ts-practical-fp";
import type { TokenClass } from "src/typhon/api";
import { initCIP38, initTokenMetadata } from "src/utils/metadata";

export const getRegistryMetadata = async (token: TokenClass) => {
   const res = await fetch(`${window.origin}/api/cardano-token-registry/metadata/${token.policyId}${token.assetName}`, {cache: 'force-cache' })
      .catch(e => null)
   if (!res) return null
   const text = await res.text()
   if (text.slice(0, 9) == 'Requested') return null
   const meta = mapObj((f: any) => f.value)(JSON.parse(text))
   meta['desc'] = meta['description']
   delete meta['description']
   meta['icon'] = 'data:image/png;base64,' + meta['logo']
   delete meta['logo']
   return initCIP38(token.policyId, token.assetName)(meta as any, '1.0')
}