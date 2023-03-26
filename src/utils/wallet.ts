import { DetectedWallet, WalletCandidate } from "src/types/wallet"

export const extractUsing = <AppContext, NetworkInfo, WalletApi, AppWallet>(
   fetchAppContext: (network: NetworkInfo) => Promise<AppContext>,
   extract: ([key, candidate]: [string, WalletCandidate]) => WalletApi | null,
   makeCardanoWallet: (wallet: WalletApi) => Promise<[NetworkInfo, (ctx: AppContext) => AppWallet]>
   ) =>
   ([key, candidate]: [string, WalletCandidate]): DetectedWallet<AppWallet> | null => {
   const api = extract([key, candidate])
   if (!api) {
      return null
   }
   return {
      name: candidate.name,
      icon: candidate.icon,
      key,
      connect: () => makeCardanoWallet(api).then(([network, maker]) => fetchAppContext(network).then(maker))
   }
}