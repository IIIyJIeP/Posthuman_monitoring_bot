import { Block } from '@cosmjs/stargate'
import { decodeTxRaw } from "@cosmjs/proto-signing"   
import { sha256 } from "@cosmjs/crypto"
import { toHex } from "@cosmjs/encoding"
import { Any } from 'cosmjs-types/google/protobuf/any'

export type DecodedTX = {
    txId: string,
    memo: string,
    msgs: Any[]
}

export function decodeTxsInBlock(block: Block) {
    const decodedTxs: DecodedTX[] = []
    
    for (const tx of block.txs) {
        try {
            const txId = toHex(sha256(tx)).toUpperCase();
            const dTx = decodeTxRaw(tx)
            const memo = dTx.body.memo
            const msgs = dTx.body.messages
            const decodedTx:DecodedTX = {
                txId,
                memo,
                msgs
            }
            decodedTxs.push(decodedTx)
        
        } catch (e) {}
    }
    return decodedTxs
}