
import { apply, callNonNull, firstNonNull, tuple, nonNull } from "ts-practical-fp"
import { WalletCandidate } from "src/types/wallet"

export const cardanoCandidates = (w: Window) => {
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
}

export const fetchConnectors = <Candidate, T>(ws: [string, Candidate][], extractors: ((c: [string, Candidate]) => T | null)[]) => {
   return ws
      .map(w => firstNonNull(apply(w))(extractors))
      .filter(nonNull)
}

export function fetchConnector<Candidate, T>(w: Record<string, Candidate> | undefined, extractors: ((c: [string, Candidate]) => T | null)[], wallet: string) {
   return callNonNull((c: Candidate) => firstNonNull(apply(tuple(wallet, c)))(extractors))(w?.[wallet])
}

const knownConnectorIcons = {
   yoroi: 'https://yoroi-wallet.com/assets/yoroi-logo-symbol.svg'
} as Record<string, string>
