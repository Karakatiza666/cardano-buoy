// import AssetFingerprint from '@emurgo/cip14-js'
import * as cip14js from '@emurgo/cip14-js'
import { fromHex, type Hex } from 'ts-binary-newtypes'
import type { TokenClass } from 'src/typhon/api'
const AssetFingerprint = (cip14js.default as unknown as typeof cip14js).default ?? cip14js.default
console.log('cip14js loaded', cip14js, AssetFingerprint)
// const _AssetFingerprint = (_AssetFingerprint as unknown as typeof cip14js).default // Boy do I like CommonJS

export function assetFingerprint(policyId: Hex, assetName: Hex) {
   return AssetFingerprint.fromParts(
      fromHex(policyId),
      fromHex(assetName)
   ).fingerprint()
}

export function tokenFingerprint({policyId, assetName}: TokenClass) {
   return AssetFingerprint.fromParts(
      fromHex(policyId),
      fromHex(assetName)
   ).fingerprint()
}