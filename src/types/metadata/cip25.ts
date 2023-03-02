// https://cips.cardano.org/cips/cip25/
export type MetadataCIP25 = {
   "721":
   Record<string, // policy id
      Record<string, // asset name, hex encoded
      {
         name: string
         image: string | string[]
         mediaType?: string
         description?: string | string[]
         symbol?: string // non-spec: see https://cardanoscan.io/transaction/df3dbae05d784307c1eb88fc3d6244c1a980cf30f0b747a275ce9f01f9eec40d?tab=metadata
         decimals?: number // non-spec
         files?: {
            name: string
            mediaType: string
            src: string | string[]
         }[]
      }>
   > & {
      version?: string // If not specified the version is 1.0
   }
}