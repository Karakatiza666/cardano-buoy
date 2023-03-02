const gqlEq = <T>(v : T | T[]): { _in: T[] } | { _eq: T } =>
  Array.isArray(v) ? { _in : v } : { _eq: v }

export const tokenBoolExp = (policyId: string | string[], assetNameHex?: string | string[]) => ({
  asset: {
    policyId: gqlEq(policyId),
    assetName: assetNameHex ? gqlEq(assetNameHex) : undefined
  }
})

export type TokenBoolExp = ReturnType<typeof tokenBoolExp>