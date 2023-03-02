import { zip } from 'ts-practical-fp'

// Returns URI prefixed with 'ipfs://'
export const ipfsUploadBlob = (blob: Blob): Promise<string> =>
   fetch('/api/ipfs', { method: 'POST', headers: { 'Content-Type': blob.type }, body: blob })
   .then(r => {
      if (!r.ok) {
         throw new Error(`IPFS upload error! status: ${r.status}`);
      }
      return r.json();
   })

export async function asyncUploadBlobs(toUpload: [string, Blob][]) {
   const uploadedIds = [] as string[]
   try{
   // https://stackoverflow.com/questions/59694309/for-await-of-vs-promise-all
   for (const result of await Promise.all(toUpload.map(e => ipfsUploadBlob(e[1])))) {
      // By default, CIDs from nft.starage are in V1 base32 format,
      // which is too long to store in cardano metadata.
      // It needs to be converted into shorter, base58 representation
      uploadedIds.push('ipfs://' + result)
   }
   }catch(e){
      console.log(e)
      return Promise.reject(e)
   }

   if (toUpload.length !== uploadedIds.length) {
      throw new Error('Not all files uploaded!')
   }

   return zip(toUpload.map(e => e[0]), uploadedIds)
}