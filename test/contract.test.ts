import {getContractAddress} from "../src"
import assert = require('assert')

assert(
    getContractAddress('db850e702e3ffb77e367110b417d3af4c377bc0c', 1) === 'b98d74b22162682f1c47f64546298ce83967eda1'
    , 'get contract address error');