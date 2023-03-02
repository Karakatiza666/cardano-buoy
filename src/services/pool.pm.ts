// import { initCIP25, initTokenMetadata } from "cardano-buoy";
// import type { Hex } from "ts-binary-newtypes";
// import type { TokenMetadataPayload } from "src/types/metadata";
// import type { MetadataCIP25 } from "src/types/metadata/cip25";
// import { assetFingerprint } from "src/utils/assetFingerprint";

// export function poolpmTokenMetadata(policyId: Hex, assetName: Hex) {
//   return fetch(`https://pool.pm/asset/${assetFingerprint(policyId, assetName)}`,
//     {cache: 'force-cache' })
//      .then((r) => r.json())
//      // .then((d) => d['metadata'] as TokenMetadataPayload<MetadataCIP25> | null)
//      .then(d => ('error' in d || d.label === 0) ? null : d as Record<string, unknown>)
//      .then(d => d ? initTokenMetadata({[d.label as number]: d.metadata }, policyId, assetName)[0] : null)
// }
export {}