import BigNumber from 'bignumber.js';
import { makeHex, utf8ToHex } from 'ts-binary-newtypes';
import type { AssetClass, TokenClass } from 'src/typhon/api';

const native = 'lovelace'

export const assetClassUnit = (acl: AssetClass) =>
   acl == 'lovelace' ? acl : acl.policyId + acl.assetName

export const unitTokenClass = (unit: string): TokenClass => {
   if (unit == 'lovelace') throw new Error('Unit is lovelace, not token class!')
    return {
        policyId: makeHex(unit.slice(0, 56)),
        assetName: makeHex(unit.slice(56, 120))
    };
};

export const unitAssetClass = (unit: string): AssetClass =>
    unit == 'lovelace' ? 'lovelace' : ({
       policyId: makeHex(unit.slice(0, 56)),
       assetName: makeHex(unit.slice(56)),
    })

export const assetClassAddress = (acl: AssetClass): string => {
    if (acl === 'lovelace') {
        return native;
    } else {
        return `${acl.policyId}.${acl.assetName}`;
    }
};

export const addressAssetClass = (address: string): AssetClass => {
    if (address === native) {
        return 'lovelace';
    }
        return {
            policyId: makeHex(address.slice(0, 56)),
            assetName: makeHex(address.slice(57, 121))
        };
};

export const addressTokenClass = (address: string): TokenClass => {
    if (address === native) {
        throw new Error(`Address is ${native}, not token class!`)
    }
        return {
            policyId: makeHex(address.slice(0, 56)),
            assetName: makeHex(address.slice(57, 121))
        };
};

export const unitHex = (unit: string): string => {
   const acl = unitAssetClass(unit)
    if (acl === 'lovelace') {
        return utf8ToHex('lovelace');
    }
    const { policyId, assetName } = acl;
    return `${policyId}${assetName}`;
};

export const assetClassHex = (assetClass: AssetClass): string => {
    if (assetClass === 'lovelace') {
        return utf8ToHex('lovelace');
    } else {
        const { policyId, assetName } = assetClass;
        return `${policyId}${assetName}`;
    }
};

export const hexAssetClass = (hex: string): AssetClass => {
    if (hex === utf8ToHex('lovelace')) {
        return 'lovelace';
    } else {
        return unitAssetClass(hex);
    }
};

function removeTrailingZeros(num: string): string {
    const [integer, decimal] = num.split(".");
    if (!decimal) return integer
    const fixed = decimal.replace(/0*$/, "");
    return integer + (fixed.length ? '.' : '') + fixed;
}

export const formatAmount = (token: {amount: BigNumber}, decimals?: number) => {
   return removeTrailingZeros(token.amount.div(new BigNumber(10).pow(decimals ?? 0)).toFormat(decimals ?? 0))
}