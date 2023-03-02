type Label = string
export type CardanoMetadata = Record<Label, unknown>
export type CardanoTokenMetadata = Record<Label, { [x: string]: { [x: string]: unknown} } >

export type TokenMetadataPayload<T> = { [x: string]: T }

export type TokenMetadataBody<T> = { [x: string]: TokenMetadataPayload<T> }

export type TokenMetadataType<T> = { [x in Label]: TokenMetadataBody<T> & { version?: string } }

export type GetTokenMetadataPayload<T> = T extends TokenMetadataType<infer X> ? X : never
export type GetTokenMetadataBody<T> = T extends TokenMetadataType<infer X> ? { [x: string]: { [x: string]: X} } : never