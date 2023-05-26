import type { Address, TransactionOutput, TransactionUnspentOutput } from "@emurgo/cardano-serialization-lib-browser";
import type { NetworkId } from "src/types/network";
import { comp } from "ts-practical-fp";
import { makeHex, type Hex } from "ts-binary-newtypes"
import { addressCSLtoTyphon } from "src/typhon/common";

export const cslScriptEnterpriseAddr = (ctx: {network: NetworkId}, scriptHash: Hex) =>
   LCSL.EnterpriseAddress.new(
      ctx.network, // 0 for Testnet - 1 for Mainnet
      LCSL.StakeCredential.from_scripthash(LCSL.ScriptHash.from_hex(scriptHash))
   ).to_address()

export const cslAddress = (script: Address | TransactionOutput | TransactionUnspentOutput) =>
   script instanceof LCSL.Address ? script
 : script instanceof LCSL.TransactionOutput ? script.address()
 : script.output().address()

export const cslPaymentCredHash = comp(cslAddress, addr => makeHex(addressCSLtoTyphon(addr).paymentCredential.hash))

// export const cslPaymentCredHash = (script: Address | TransactionOutput | TransactionUnspentOutput) => {
//    const addr = 
   
//    // return callNonNull(makeHex, LCSL.EnterpriseAddress.from_address(addr)?.payment_cred().to_scripthash()?.to_hex())
//    return makeHex(addressCSLtoTyphon(addr).paymentCredential.hash)
// }

// export const cslRequireScriptAddrHex = comp(
//       cslScriptAddrHex,
//       (h => h ?? (() => { throw new Error('cslRequireScriptAddrHex: Not an enterprise address')})())
//    )

const addressHeaderType = (addr: Address) => addr.to_bytes()[0] >> 4

// https://cips.cardano.org/cips/cip19
export const shelleyPaymentCredType = (addr: Address) => {
   console.log('shelleyPaymentCredType', addr.to_bech32(), addressHeaderType(addr))
   switch (addressHeaderType(addr)) {
      case 0: return 'PaymentKeyHash'
      case 1: return 'ScriptHash'
      case 2: return 'PaymentKeyHash'
      case 3: return 'ScriptHash'
      case 4: return 'PaymentKeyHash'
      case 5: return 'ScriptHash'
      case 6: return 'PaymentKeyHash'
      case 7: return 'ScriptHash'
   }
   throw new Error('Unknown address type')
}