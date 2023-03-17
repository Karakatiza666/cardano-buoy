import { gql } from "graphql-request"
import { injectCostModelObject } from "src/utils/costModels"
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
  const pp = data['cardano']['currentEpoch']['protocolParams'] as ProtocolParams
  return injectCostModelObject('costModels')(pp)
}

export const gqlProtocolParams = {
   query, process
}