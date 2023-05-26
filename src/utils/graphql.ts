import type { NetworkId } from 'src/types/network'
import { GraphQLClient } from 'graphql-request'

export const graphqlClient = (endpoints: Record<NetworkId, string>, network: NetworkId) =>
   new GraphQLClient(endpoints[network], { headers: {} })
