import { gql } from "graphql-request"
import { costModelObjectV1, costModelObjectV2 } from "src/utils/costModels"
import type { ProtocolParams } from "src/types/network"

const query = gql`
query currentEpochProtocolParams {
  cardano {
    currentEpoch {
      number
      protocolParams {
         a0
         coinsPerUtxoByte
         collateralPercent
         costModels
         decentralisationParam
         eMax
         extraEntropy
         keyDeposit
         maxBlockBodySize
         maxBlockExMem
         maxBlockExSteps
         maxBlockHeaderSize
         maxCollateralInputs
         maxTxExMem
         maxTxExSteps
         maxTxSize
         maxValSize
         minFeeA
         minFeeB
         minPoolCost
         minUTxOValue
         nOpt
         poolDeposit
         priceMem
         priceStep
         protocolVersion
         rho
         tau
      }
    }
  }
}`

const process = (data: any) => {
   const pp = data['cardano']['currentEpoch']['protocolParams']
   return {
      ...pp,
      // coinsPerUtxoWord: pp.coinsPerUtxoByte * 8,
      costModel: {
        PlutusV1: costModelObjectV1(pp.costModels.PlutusV1),
        PlutusV2: costModelObjectV2(pp.costModels.PlutusV2)
      }
   } as ProtocolParams
}

export const gqlProtocolParams = {
   query, process
}