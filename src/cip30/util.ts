import type { WalletCIP30Api, WalletCIP30ApiInstance } from "src/cip30/api";
import { mapFromHexed, fromHexed } from "ts-binary-newtypes";
import { isEmptyObj, paginatedLookupAll } from "ts-practical-fp";
import { cslHasAnyTokens, cslValueHasCurrency, cslValueToken } from "src/csl/value";
import { aclTyphonToCSL, cslAssetName, cslScriptHash } from "src/csl/common";
import { singleton } from "ts-practical-fp";
import type { Hex } from "ts-binary-newtypes";
import type { TokenClass } from "src/typhon/api";
import { WalletCandidate } from "src/types/wallet";
import { TransactionUnspentOutput } from "@emurgo/cardano-serialization-lib-browser";
import { takeLeftWhile } from "fp-ts/lib/Array.js";

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
   const us = await api.getCollateral({amount})
   if (!us) return []
   const sorted = mapFromHexed(LCSL.TransactionUnspentOutput)(us)
      .sort((a, b) => a.output().amount().coin().compare(b.output().amount().coin()))
   let acc = LCSL.BigNum.from_str(lovelace.toString())
   const pred = (c: TransactionUnspentOutput) => {
      if (acc.is_zero()) return false
      acc = acc.clamped_sub(c.output().amount().coin())
      return true
   }
   const minimal = takeLeftWhile(pred)(sorted)
   return acc.is_zero() ? minimal : [] // Return empty array when total collateral not enough to cover requested amount
}

export const fetchAllWalletUTxOs_ = 
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

export const fetchAllWalletUTxOs = 
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

export const getWalletUTxOPage = (api: WalletCIP30ApiInstance) => (params: {pageSize: number, page: number}) => api
   // TODO: give the option to specify minimum value for UTxOs:
   // .getUtxos(toHexed(LCSL.Value.new(ada(minExpectedAda)), v => v.to_bytes()), {...params, limit})
   .getUtxos(undefined, {page: params.page, limit: params.pageSize})
   .then(mapFromHexed(LCSL.TransactionUnspentOutput))
   // .then(us => ((us ?? []).forEach(u => console.log('getUTxOPage', u.to_json())), us))

export const enablePatchCIP30 = async (api: WalletCIP30Api & { key: string }) => {
   let instance = await api.enable()
   if (!instance.getCollateral) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      instance.getCollateral = (instance as any).experimental?.getCollateral
   }
   // Workarounds for wallets that incorrectly implement CIP30 spec
   if (api.key == 'flint') {
      instance.getUtxos = ((f) => async (amount, paginate) => {
         const res = await f(amount)
         if (paginate?.limit == res.length && paginate?.page) {
            // Return empty page if second page was requested by mistake
            return []
         }
         return res
      })(instance.getUtxos)
   } else if (api.key == 'yoroi') {
      const getCollateral = (f => ((arg) =>
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
         f(arg?.amount as any)) as typeof f
      )(instance.getCollateral.bind(instance))

      instance = Object.assign(Object.create(Object.getPrototypeOf(instance)), instance, {
         getCollateral,
      })
   } else if (api.key == 'begin') {
      instance.signTx = (signTx => (tx, partialSign) =>
         signTx(tx, partialSign).then(res => !isEmptyObj(res)
            ? res
            : (() => { throw new Error('User declined to sign the transaction') })()
         )
      )(instance.signTx)
   }
   return instance
}