import type { AssetName, BigNum, ScriptHash } from "@emurgo/cardano-serialization-lib-browser";
import { makeHex, toHex } from "ts-binary-newtypes";
import { fromBigNum } from "src/csl/value";

export const tokenCSLToTyphon = (token: {
   amount: BigNum;
   policyId: ScriptHash;
   assetName: AssetName;
}) => ({
   amount: fromBigNum(token.amount),
   policyId: makeHex(token.policyId.to_hex()),
   assetName: toHex(token.assetName.name())
})