
import { gql, GraphQLClient } from "graphql-request"
import type { TokenBoolExp } from "src/graphql/common"
import type { GQLTransactionOutput } from "src/graphql/types"

// https://input-output-hk.github.io/cardano-graphql/
const query = gql`
query utxos($limit: Int, $offset: Int, $where: TransactionOutput_bool_exp, $isScript: Boolean!) {
   utxos(limit: $limit, offset: $offset, where: $where) {
      address
      index
      txHash
      tokens {
         asset {
            policyId
            assetName
         }
         quantity
      }
      value
      script @include(if: $isScript) {
         hash
         type
      }
      datum @include(if: $isScript) {
         hash
         value
      }
   }
}`

const variables = (address: string, isScript: boolean, limit = 5, offset = 0, asset?: TokenBoolExp) => ({
   limit,
   offset,
   where: {
      address: { _eq: address },
      tokens: asset
   },
   isScript
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const process = (data: any) => data['utxos'] as GQLTransactionOutput[]

export const gqlAddressUTxOs = {
   query, process, variables
}