import { createInteractionContext, createStateQueryClient, createTxSubmissionClient, type InteractionContext } from '@cardano-ogmios/client'
import { UnknownResultError } from '@cardano-ogmios/client/dist/errors/index.js'
import { errors as submissionErrors } from '@cardano-ogmios/client/dist/TxSubmission/submissionErrors.js'
import { errors as evaluationErrors } from '@cardano-ogmios/client/dist/TxSubmission/evaluationErrors.js'
import type { StateQueryClient } from '@cardano-ogmios/client/dist/StateQuery/index.js'
import { makeHex, type Hex } from 'ts-binary-newtypes'
import type { OptionalIntersection } from 'ts-practical-fp'
import type { TxIn } from 'src/typhon/api'

//export type TxSubmissionClient = Awaited<ReturnType<typeof createTxSubmissionClient>>

const ogmiosParams = (enpoint: string) => {
   const res = /(.*):(\d+)\/(true|false)/.exec(enpoint)
   if (!res?.[1]) throw new Error('Invalid Ogmios endpoint string')
   return {
      host: res[1],
      port: parseInt(res[2]),
      tls: res[3] === 'true'
   }
}

export const makeOgmiosContext = (ctx: {ogmiosEndpoint: string}) => createInteractionContext(
   err => {
      console.log("Ogmios failed to connect")
      console.error(err)
   },
   () => console.log("Ogmios connection closed."),
   {
      connection: ogmiosParams(ctx.ogmiosEndpoint)
   }
)

export const isOgmiosEvaluationError = (e: Error) =>
   Object.values(evaluationErrors).some(err => e instanceof err.Error) || e instanceof UnknownResultError

export const isOgmiosSubmissionError = (e: Error) =>
   Object.values(submissionErrors).some(err => e instanceof err.Error) || e instanceof UnknownResultError

export const ogmiosFetchDatum = async (_client: StateQueryClient, txIns: TxIn[])
   : Promise<(TxIn & OptionalIntersection<{datumHash: Hex} | {datum: string | { [k: string]: unknown; }}>)[]> => {
   if (txIns.length == 0) {
      throw new Error('ogmios `utxo` request hangs on empty array')
   }
   const client = await _client.acquire(await _client.chainTip())
   const utxos = await client.utxo(txIns.map(txIn =>
      ({
        txId: txIn.txHash,
        index: txIn.index
      })
   ))
   // if (utxo[1].datumHash) return {
   //    datumHash: makeHex(utxo[1].datumHash)
   // }
   // if (utxo[1].datum) return {
   //    datum: utxo[1].datum
   // }
   // return {}
   console.log('ogmiosFetchDatum', utxos)
   client.shutdown()
   return utxos.map(utxo => ({
      ...(
           utxo[1].datumHash ? ({
            datumHash: makeHex(utxo[1].datumHash)
         })
         : utxo[1].datum ? ({
            datum: utxo[1].datum
         })
         : ({})
      ),
      txHash: makeHex(utxo[0].txId),
      index: utxo[0].index
   }) )
}