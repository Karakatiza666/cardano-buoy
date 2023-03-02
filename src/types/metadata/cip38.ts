import type { AnyPrefixed } from "ts-practical-fp"

// https://github.com/savaki/CIPs/blob/master/CIP-0035/CIP-0035.md
export type MetadataCIP38 = {
   "20":
   Record<string, // policy id
      Record<string, // asset name, hex encoded
      {
         ticker?: string // when present overrides default ticker which is the asset-name
         url?: string // https only url that refers to metadata stored offchain
         desc?: string | string[] // additional description that defines the usage of the token
         icon: string // MUST be either https, ipfs, or data. icon MUST be a browser supported image format.
         decimals?: number // how many decimal places should the token support
         // version?: string // when not specified, version will default to 1.0
      } & AnyPrefixed<'icon-', string>> // allows teams to provide icon in different sizes. the recommended values of size are 16, 32, 64, 96, 128
   > & {
      version?: string // when not specified, version will default to 1.0
   }
}
