import { WalletCandidate } from "src/types/wallet";

declare global {
   interface Window {
      cardano?: Record<string, WalletCandidate>
   }
   // eslint-disable-next-line no-var
   var LCSL: typeof import('@emurgo/cardano-serialization-lib-browser')
}