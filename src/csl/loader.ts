// import type { CardanoWasm } from '$lib/types/cardano/wasm';
// import init from '@emurgo/cardano-serialization-lib-browser/cardano_serialization_lib_bg.wasm?init'
// import init from './node_modules/@emurgo/cardano-serialization-lib-browser/cardano_serialization_lib_bg.wasm?init'
// import init from '@emurgo/cardano-serialization-lib-browser/cardano_serialization_lib_bg.wasm?init'

// type CSL = typeof import('@emurgo/cardano-serialization-lib-browser')
// class _Loader {
//    private _wasm!: CSL;
//    async load() {
//       if (this._wasm /* && this._wasm2*/) return;
//       // this._wasm = (await init({})).exports as unknown as CSL
//       this._wasm = await import('../../../node_modules/@emurgo/cardano-serialization-lib-browser')
//       // this._wasm2 = await import('../../temporary_modules/@emurgo/cardano-message-signing-browser/emurgo_message_signing')
//    }
//    get CSL() {
//       return this._wasm;
//    }
//    // get Message() {
//    //    return this._wasm2;
//    // }
// }

// // export default new Loader()
// export const Loader = new _Loader();