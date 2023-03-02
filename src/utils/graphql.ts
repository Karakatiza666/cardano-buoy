import type { NetworkId } from '@stricahq/typhonjs/dist/types.js'
import { GraphQLClient } from 'graphql-request'

export const graphqlClient = (endpoints: Record<NetworkId, string>, network: NetworkId) =>
   new GraphQLClient(endpoints[network], { headers: {} })
