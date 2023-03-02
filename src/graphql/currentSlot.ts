// import BigNumber from "bignumber.js"
import { gql } from "graphql-request"

const query = gql`
query {
   cardano {
      tip {
         slotNo
      }
   }
}
`

// export const graphqlCurrentSlot = (graphqlClient: GraphQLClient) =>
//   () => graphqlClient.request(gqlCurrentSlot)
//     .then(d => d['cardano']['tip']['slotNo'] as number)

const process = (data: any) => data['cardano']['tip']['slotNo'] as number

export const gqlCurrentSlot = {
   query, process
}