import { NetworkId } from "src/types/network"

export const networkAddressPrefix = (network: NetworkId) => {
   switch(network) {
      case NetworkId.MAINNET: return 'addr'
      case NetworkId.TESTNET: return 'addr_test'
      default: throw new Error(`networkAddressPrefix unexpected network ${network}`)
   }
}