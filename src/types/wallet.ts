export type WalletCandidate = { name: string, icon: string }

export type DetectedWallet<AppWallet> = {
   name: string,
   icon: string,
   key: string,
   connect: () => Promise<AppWallet>
}
