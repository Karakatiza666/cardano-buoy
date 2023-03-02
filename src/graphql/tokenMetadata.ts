import { gql } from "graphql-request"
import { costModelObjectV1, costModelObjectV2 } from "src/utils/costModels"
import type { ProtocolParams } from "src/types/network"
import type { CardanoMetadata, CardanoTokenMetadata, GetTokenMetadataBody } from "src/types/metadata"
import { tuple } from "ts-practical-fp"

const query = gql`
query tokenMints($limit: Int, $offset: Int, $where: TokenMint_bool_exp) {
   tokenMints(limit: $limit, offset: $offset, where: $where) {
      transaction {
         metadata {
            key
            value
         }
      }
   }
}
`

type GQLTokenMetadata = {
  //data: {
  tokenMints: {
     transaction: {
        metadata: {
           key: string
           value: GetTokenMetadataBody<CardanoTokenMetadata> // <MetadataCIP25 | MetadataCIP38>
        }[]
     }
  }[]
  //}
}

const variables = (policyId: string, assetName: string, limit = 5, offset = 0) => ({
  limit,
  offset,
  where: {
     asset: {
        policyId: { _eq: policyId },
        assetName: { _eq: assetName }
     }
  }
})

const process = (data: GQLTokenMetadata) => { //, [policyId, assetName]: Parameters<typeof variables>) => {
  const mint = data.tokenMints.at(-1)
  // if (!data) return undefined
  if (!mint) return undefined
  // const m = mint.transaction.metadata.find((m) => m.key === label)
  // return m?.value?.[policyId]?.['0x' + assetName] as TokenMetadataPayload<T>
  return Object.fromEntries(mint.transaction.metadata.map(({key, value}) => tuple(key, value)))
}

export const gqlTokenMetadata = {
   query, process, variables
}
