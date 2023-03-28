
import { apply, callNonNull, firstNonNull, tuple, nonNull } from "ts-practical-fp"
import { WalletCandidate } from "src/types/wallet"

export function fetchConnectors<T>(w: Record<string, WalletCandidate> | undefined, extractors: ((c: [string, WalletCandidate]) => T | null)[])  {
   const usedNames = new Set<string>()
   if (!w) {
      return []
   }
   return Object.entries(w)
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

export function fetchConnector<T>(w: Record<string, WalletCandidate> | undefined, extractors: ((c: [string, WalletCandidate]) => T | null)[], wallet: string) {
   return callNonNull(c => firstNonNull(apply(tuple(wallet, c)))(extractors), w?.[wallet])
}

const knownConnectorIcons = {
   yoroi: 'https://yoroi-wallet.com/assets/yoroi-logo-symbol.svg'
} as Record<string, string>
