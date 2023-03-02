import type { WalletCandidate } from "src/global";
import type { WalletCIP30Api, WalletCIP30ApiInstance } from "src/cip30/api";
import { mapFromHexed, fromHexed } from "ts-binary-newtypes";
import { paginatedLookupAll } from "ts-practical-fp";
import { cslHasAnyTokens, cslValueHasCurrency, cslValueToken } from "src/csl/value";
import { aclTyphonToCSL, cslAssetName, cslScriptHash } from "src/csl/common";
import { singleton } from "ts-practical-fp";
import type { Hex } from "ts-binary-newtypes";
import type { TokenClass } from "src/typhon/api";

export const extractCip30Api = ([key, candidate]: [string, WalletCandidate]) => {
   if ('apiVersion' in candidate) {
      const wallet = { key, ...candidate as WalletCIP30Api}
      wallet.walletType = 'cip30'
      return wallet
   }
   return null
}

export const fetchRecipient = async (api: WalletCIP30ApiInstance) => {
   const recepient = mapFromHexed(LCSL.Address)(await api.getUsedAddresses())[0]
   if (!recepient) {
      throw new Error('Receive address not found!')
   }
   return recepient
}

export const fetchCollateral = async (api: WalletCIP30ApiInstance, lovelace: string | number) => {
   const amount = typeof lovelace == 'string' ? lovelace : lovelace.toFixed()
   return api.getCollateral({amount})
      .then(us => {
         if (!us) return null
         return mapFromHexed(LCSL.TransactionUnspentOutput)(us)
            .sort((a, b) => a.output().amount().coin().compare(b.output().amount().coin()))
            .at(0) ?? null
      })
}


export const fetchAllWalletUTxOs = 
   (wallet: WalletCIP30ApiInstance, policyId?: Hex | Hex[], assetName?: Hex | Hex[]) =>
   paginatedLookupAll({
      pageSize: 50, startPage: 0,
      getBatch: ({page}) => wallet.getUtxos(undefined, {page, limit: 50}).then(mapFromHexed(LCSL.TransactionUnspentOutput)),
      pred: (u) => {
         // Return true if atleast one policyId or policyId+assetName found
         const amount = u.output().amount()
         if (!singleton(policyId)[0] && singleton(assetName)[0]) {
            throw new Error('Cannot lookup assetName without policyId')
         }
         const potentialCurrencies = singleton(policyId)
            .map(p => amount.multiasset()?.get(cslScriptHash(p)) ?? LCSL.Assets.new())
         const potentialTokens = potentialCurrencies
            .map(assets =>
               (ns => !ns[0] || !!ns.find(n => !!assets.get(cslAssetName(n))))
               (singleton(assetName))
            ).every(b => b)
         return potentialTokens
      }
   })

export const fetchAllWalletUTxOs_ = 
   (wallet: WalletCIP30ApiInstance, tcl?: TokenClass | TokenClass[]) =>
   paginatedLookupAll({
      pageSize: 50, startPage: 0,
      getBatch: ({page}) => wallet.getUtxos(undefined, {page, limit: 50}).then(mapFromHexed(LCSL.TransactionUnspentOutput)),
      pred: (u) => {
         // Return true if atleast one policyId or policyId+assetName found
         const amount = u.output().amount()
         if (!singleton(tcl)[0]) return true
         return !!singleton(tcl)
            .find(tcl => !cslValueToken(aclTyphonToCSL(tcl), amount).is_zero())
      }
   })