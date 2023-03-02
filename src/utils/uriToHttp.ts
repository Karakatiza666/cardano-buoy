const asIpfs = (hash: string) => [`https://cloudflare-ipfs.com/ipfs/${hash}/`, `https://ipfs.io/ipfs/${hash}/`]

export const uriToHttp = (uri: string | undefined): string[] => {
   if (!uri) return []
   if (uri.startsWith('data:')) return [uri]
   const protocol = uri.split(':')[0].toLowerCase();
   switch (protocol) {
      case 'https':
         return [uri];
      case 'http':
         return ['https' + uri.slice(4), uri];
      case 'ipfs': {
         const hash = uri.match(/^ipfs:(\/\/)?(.*)$/i)?.[2];
         if (!hash) return []
         return asIpfs(hash);
      }
      case 'ipns': {
         const name = uri.match(/^ipns:(\/\/)?(.*)$/i)?.[2];
         return [`https://cloudflare-ipfs.com/ipns/${name}/`, `https://ipfs.io/ipns/${name}/`];
      }
      default: {
         if (uri.slice(0, 2) == 'Qm') return asIpfs(uri)
         if (uri.slice(0, 3) == 'zb2') return asIpfs(uri)
         return [];
      }
   }
}
