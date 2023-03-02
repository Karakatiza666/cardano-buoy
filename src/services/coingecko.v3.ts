import BigNumber from "bignumber.js"

export const getCoingeckoTokenPrice = (crypto: string, fiat: string) =>
   fetch(`https://api.coingecko.com/api/v3/coins/${crypto}`)
   .then(r => r.json())
   .then(j =>
      (p => p ? new BigNumber(p) : null)(j.market_data?.current_price?.[fiat.toLowerCase()])
   )
