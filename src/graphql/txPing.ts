import { gql } from "graphql-request"
import type { Hex } from "ts-binary-newtypes"

const query = gql`
query txPing($id: Hash32Hex!) {
  transactions(where: {hash: {_eq: $id}}) {
    ...TransactionDetails
  }
}

fragment TransactionDetails on Transaction {
  hash
}
`

const variables = (id: Hex) => ({
   id
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const process = (data: any, id: Hex) => 
   data['transactions'][0]?.['hash'] === id

export const gqlTxPing = {
   query, process, variables
}
