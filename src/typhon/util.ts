import { WalletCandidate } from "src/types/wallet"
import type { WalletTyphonApi } from "src/typhon/api"

export const extractTyphonApi = ([key, candidate]: [string, WalletCandidate]) => {
   if (key === 'typhon') {
      const wallet: WalletTyphonApi = {key, ...candidate as any }
      wallet.walletType = 'typhon'
      return wallet
   }
   return null
}