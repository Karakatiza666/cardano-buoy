import {load} from 'cheerio';
import { nonNull } from 'ts-practical-fp';
import { filterObject_, mapObj } from 'ts-practical-fp';
import type { CardanoTokenMetadata } from 'src/types/metadata';
import type { TokenClass } from 'src/typhon/api';
import { mergeMetadata } from 'src/utils/metadata';

export const cardanoscanTokenMetadata = async (token: TokenClass) => {
   const tokenPage = load(await (await fetch(`https://cardanoscan.io/token/${token.policyId}.${token.assetName}`,
      {cache: 'default' })).text())
   const minttransactions = tokenPage('#minttransactions');
   const trxHashes = minttransactions.find('a.link').map((i, el) => {
      return tokenPage(el).attr('href');
    }).get().map(trxHashLink => /([a-f]|\d){64}/.exec(trxHashLink)?.[0]).filter(nonNull);
   if (!trxHashes.length) return null // throw new Error("Couldn\t find href in cardanoscanTokenMetadata")

   const getHashMetadata = async (trxHash: string) => {
      const xx = await (await fetch(`https://cardanoscan.io/transaction/${trxHash}?tab=metadata`,
         {cache: 'default' })).text()
      const mintTxPage = load(xx)
      const metadata: Record<number, unknown> = {}
      mintTxPage('#metadata').find('[data-label]').each((index, element) => {
         const key = mintTxPage(element).attr('data-label')!;
         const value = mintTxPage(element).attr('data-value')!;
         const meta = JSON.parse(value)
         metadata[parseInt(key)] = mapObj(mapObj(filterObject_((v) => !(typeof v == 'object') || Array.isArray(v))))(meta) ;
      });
      return metadata as CardanoTokenMetadata
   }
   const metadatas = await Promise.all(trxHashes.map(getHashMetadata))
   return mergeMetadata(metadatas) as CardanoTokenMetadata
}
