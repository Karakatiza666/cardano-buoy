
import type { ExUnits } from "@stricahq/typhonjs/dist/types.js"
import type { BigNumber } from 'bignumber.js'

export type EvaluationContext = {
   cost: EvaluationCost
   fee: BigNumber
}

export type EvaluationTag = 'spend' | 'mint' | 'certificate' | 'withdrawal'
export type EvaluationCost = (tag: EvaluationTag, idx: number) => ExUnits