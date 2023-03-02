import type { EvaluationCost } from "src/types/evaluation";
import type { EvaluationResult } from "@cardano-ogmios/client/dist/TxSubmission/index.js";
import type { ExUnits } from '@cardano-ogmios/schema'
import { mapObj } from "ts-practical-fp";

const toTyphonExUnits = ({memory, steps}: ExUnits) => ({
  mem: memory,
  steps
})

export const dummyEval: EvaluationCost = () => ({ mem: 0, steps: 0 })
export const evaluated = (result: EvaluationResult): EvaluationCost => {
   // Sometimes evaluateTx returns budgeds with strange id's (e.g. spend:5 when asked for spend:0)
   // Here is a workaround:
   // Budgets received from evaluateTx are grouped by their type and sorted
   // And wanted index is a new index of an item in a sorted list!
   const newIndices = {} as Record<string, number[]>
   Object.keys(result).forEach(key => {
      const [tag, idx] = key.split(':')
      if (!newIndices[tag]) {
        newIndices[tag] = []
      }
      newIndices[tag].push(parseInt(idx))
   })
   const normalizedResult = mapObj
      ((v: number[], k) => v.sort().map((i) => result[k + ':' + i.toFixed()]))
      (newIndices)
   return (tag, idx) => {
      console.log('evaluated:', result)
      console.log('normalized:', normalizedResult)
      console.log('trying:', tag, idx)
      // const entry = result[tag + ':' + idx.toFixed()]
      // const entry = normalizedResult[tag][idx.toFixed()]
      const entry = normalizedResult[tag][idx]
      return toTyphonExUnits(entry)
   }
}