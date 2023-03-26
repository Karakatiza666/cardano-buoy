
import { apply, callNonNull, firstNonNull, tuple, nonNull } from "ts-practical-fp"
import { WalletCandidate } from "src/types/wallet"

export function fetchConnectors<T>(w: Window, extractors: ((c: [string, WalletCandidate]) => T | null)[])  {
   const usedNames = new Set<string>()
   if (!w.cardano) {
      return []
   }
   return Object.entries(w.cardano)
      .filter(([,c]) => {
         return typeof c === 'object' && Object.keys(c).length !== 0
      })
      .filter(([,c]) =>
         !usedNames.has(c.name) && (usedNames.add(c.name), true)
      )
      // .map(w => ((w[1].icon = w[1].icon ?? knownConnectorIcons[w[1].name]), w))
      .map(w => firstNonNull(apply(w))(extractors))
      .filter(nonNull)
}

export function fetchConnector<T>(w: Window, extractors: ((c: [string, WalletCandidate]) => T | null)[], wallet: string) {
   return callNonNull(w => firstNonNull(apply(tuple(wallet, w)))(extractors), w.cardano?.[wallet])
}

const knownConnectorIcons = {
   yoroi: 'https://yoroi-wallet.com/assets/yoroi-logo-symbol.svg'
} as Record<string, string>
