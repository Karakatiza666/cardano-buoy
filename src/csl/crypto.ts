import { singleton } from "ts-practical-fp"
import { mnemonicToEntropy } from 'bip39'
import { Bip32PrivateKey, PrivateKey } from "@emurgo/cardano-serialization-lib-browser"
// https://forum.cardano.org/t/using-emurgo-cardano-serialization-lib-nodejs-for-creating-and-signing-transaction/88864
export const seedPrivateKey = (seed: string | string[]) => {
   const mnemonic = Array.isArray(seed) ? seed : Array.from(seed.match(/\w+/)?.values() ?? [])
   const entropy = mnemonicToEntropy(mnemonic.join(' '))
   return LCSL.Bip32PrivateKey.from_bip39_entropy(
      Buffer.from(entropy, 'hex'),
      Buffer.from(''),
   )
}

function harden(num: number): number {
   return 0x80000000 + num;
}

const roles = {
   'external': 0,
   'internal': 1,
   'staking': 2
}

export const deriveKeyPath = (root: Bip32PrivateKey, account: number, role: keyof typeof roles, index: number) => root
   .derive(harden(1852)) // purpose
   .derive(harden(1815)) // coin_type
   .derive(harden(0))
   .derive(harden(roles[role]))
   .derive(harden(index))
   .to_raw_key()