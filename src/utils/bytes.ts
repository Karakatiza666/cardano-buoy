import { type Hex, toHex } from 'ts-binary-newtypes'
import { BigNumber } from 'bignumber.js';
import blakejs from 'blakejs'
import { littleEndianToInteger } from 'ts-practical-fp'

// Calculate n-byte random number from bytestring seed
export const drng = (byteCount: number) => (byteString: Hex) =>
   littleEndianToInteger(toHex(blakejs.blake2b(byteString, undefined, 32).slice(32 - byteCount)))
