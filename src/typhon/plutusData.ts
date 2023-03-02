import type { PlutusData, PlutusDataConstructor } from "@stricahq/typhonjs/dist/types.js"

const plutusConstructor = (i: number) => (...data: PlutusData[]) => ({
  constructor: i,
  fields: data
}) as PlutusDataConstructor

// https://playground.plutus.iohkdev.io/doc/haddock/plutus-tx/html/src/PlutusTx.IsData.Instances.html
// makeIsDataIndexed ''Bool [('False,0),('True,1)]
// makeIsDataIndexed ''Maybe [('Just,0),('Nothing,1)]
// makeIsDataIndexed ''Either [('Left,0),('Right,1)]
export const plutusGenericConstructor = plutusConstructor(0)
export const plutusEmptyConstructor = plutusConstructor(0)()
export const plutusBoolConstructor = (data: boolean) => plutusConstructor(data ? 1 : 0)()
export const plutusNothingConstructor = plutusConstructor(1)()
export const plutusJustConstructor = (data: PlutusData) => plutusConstructor(0)(data)
export const plutusLeftConstructor = (data: PlutusData) => plutusConstructor(0)(data)
export const plutusRightConstructor = (data: PlutusData) => plutusConstructor(1)(data)