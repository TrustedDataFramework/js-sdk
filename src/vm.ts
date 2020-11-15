import { hex2bin } from "./utils";
import { Binary } from "./constants";

/**
 * java script virtual machine
 */
export class VirtualMachine {
    buf: Uint8Array
    height: number
    hash: Uint8Array

    constructor(bin: Binary) {
        this.buf = hex2bin(bin)
        this.height = 1
        this.hash = new Uint8Array(32)
    }


}