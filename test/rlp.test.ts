import rlp = require('../src/rlp')
import { MAX_U256 } from '../src/constants'
import {bin2hex, hex2bin} from "../src";
import BN = require("../src/bn");

console.log(bin2hex(new BN(hex2bin('ff')).toArrayLike(Uint8Array, 'be', 8)))