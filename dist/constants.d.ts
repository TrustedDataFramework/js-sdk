import BN = require("./bn");
export declare type Digital = string | number | BN;
export declare type Binary = string | Uint8Array | ArrayBuffer;
export declare type Readable = string | number | boolean;
export declare type AbiInput = string | number | boolean | ArrayBuffer | Uint8Array | BN;
export declare type RLPElement = Uint8Array | Uint8Array[];
export declare enum TX_STATUS {
    PENDING = 0,
    INCLUDED = 1,
    CONFIRMED = 2,
    DROPPED = 3
}
export declare const constants: {
    POA_VERSION: number;
    POW_VERSION: number;
    POS_VERSION: number;
    COINBASE: number;
    TRANSFER: number;
    DEPLOY: number;
    CONTRACT_CALL: number;
    PEER_AUTHENTICATION_ADDR: string;
    POA_AUTHENTICATION_ADDR: string;
    POS_CONTRACT_ADDR: string;
};
export declare type ABI_TYPE = 'function' | 'event';
export declare enum ABI_DATA_TYPE {
    bool = 0,
    i64 = 1,
    u64 = 2,
    f64 = 3,
    string = 4,
    bytes = 5,
    address = 6,
    u256 = 7
}
export declare const MAX_U64: BN;
export declare const MAX_U256: BN;
export declare const MAX_I64: BN;
export declare const MIN_I64: BN;
export declare const MAX_SAFE_INTEGER: BN;
export declare const MIN_SAFE_INTEGER: BN;
export declare const ONE: BN;
export declare const ZERO: BN;
