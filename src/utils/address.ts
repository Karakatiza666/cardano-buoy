import { NetworkId } from "@stricahq/typhonjs/dist/types.js"

export const networkAddressPrefix = (network: NetworkId) => {
   switch(network) {
      case NetworkId.MAINNET: return 'addr'
      case NetworkId.TESTNET: return 'addr_test'
      default: throw new Error(`networkAddressPrefix unexpected network ${network}`)
   }
}