import { type Hex, toHex, fromHex } from 'ts-binary-newtypes'
import { BigNumber } from 'bignumber.js';
import blakejs from 'blakejs'
import { littleEndianToInteger } from 'ts-practical-fp'

// Calculate n-byte random number from bytestring seed
export const drng = (byteCount: number) => (byteString: Hex) => {
   if (byteCount > 32 || byteCount < 1) {
      throw new Error('drng: invalid byteCount')
   }
   return littleEndianToInteger(toHex(blakejs.blake2b(fromHex(byteString), undefined, 32).slice(32 - byteCount)))
}
