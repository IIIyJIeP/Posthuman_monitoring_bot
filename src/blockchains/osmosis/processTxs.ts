import { Block, StargateClient, defaultRegistryTypes,  } from '@cosmjs/stargate'
import { osmosisProtoRegistry, cosmwasmProtoRegistry, ibcProtoRegistry } from 'osmojs'
import { decodeTxRaw, Registry } from "@cosmjs/proto-signing"   
import { sha256 } from "@cosmjs/crypto"
import { toHex } from "@cosmjs/encoding"
import { Any } from 'osmojs/dist/codegen/google/protobuf/any'

export type DecodedMSG = {
    typeUrl: string,
    value: any
}
export type DecodedTX = {
    txId: string,
    memo: string,
    msgs: DecodedMSG[]
}

export async function decodeTxsInBlock(block: Block) {
    const decodedTxs: DecodedTX[] = []
    for (const tx of block.txs) {
        const txId = toHex(sha256(tx)).toUpperCase();
        const dTx = decodeTxRaw(tx)
        const memo = dTx.body.memo
        const decodedTx:DecodedTX = {
            txId,
            memo,
            msgs: []
        }
        for (const msg of dTx.body.messages) {
            const registry = new Registry([
                ...defaultRegistryTypes,
                ...osmosisProtoRegistry,
                ...cosmwasmProtoRegistry,
                ...ibcProtoRegistry
            ])
            function decodeMsg (txMsg: Any){
                try {
                    const decodedMsg = registry.decode(txMsg)
                    if (txMsg.typeUrl == '/cosmwasm.wasm.v1.MsgExecuteContract') {
                        decodedMsg.msg = JSON.parse(new TextDecoder().decode(decodedMsg.msg))
                    } else if (txMsg.typeUrl == '/cosmos.authz.v1beta1.MsgExec') {
                        for (const execMsg of decodedMsg.msgs) {
                            decodeMsg(execMsg)
                        }
                    }
                    txMsg.value = decodedMsg
                } catch (err) {
                    console.error(err)
                }
            }
            decodeMsg(msg)
            decodedTx.msgs.push(msg)
        }
        decodedTxs.push(decodedTx)
    }
    return decodedTxs
}