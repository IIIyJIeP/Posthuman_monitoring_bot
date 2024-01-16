import { Block, StargateClient } from '@cosmjs/stargate'
import { decodeTxRaw } from "@cosmjs/proto-signing"
import { sha256 } from "@cosmjs/crypto";
import { toHex } from "@cosmjs/encoding";



export async function decodeTxsInBlock(block: Block) {
    
    // const Promises = []

    // for (const tx of block.txs) {
    //     const txId = toHex(sha256(tx)).toUpperCase();
    //     Promises.push(queryClient.getTx(txId))
    // }
    // const indexedTxs = await Promise.all(Promises) 
    
    // const gasPrices = []
    // for (const indexedTx of indexedTxs) {
    //     if(indexedTx?.code === 0) {
    //         const gasWanted = Number(indexedTx.gasWanted)
    //         const decodedTX = decodeTxRaw(indexedTx.tx)
    //         if (decodedTX.authInfo.fee?.amount[0].denom === 'uosmo') {
    //             const amountUosmo = Number(decodedTX.authInfo.fee.amount[0].amount)
    //             const gasPrice = Math.round(amountUosmo*1000000/gasWanted)/1000000
    //             gasPrices.push(gasPrice)
    //         }
    //     }
    // }

    // if (gasPrices.length > 0) {
    //     const minGasPrice = Math.min(...gasPrices)
    //     const averageGasPrice = Math.round(
    //         gasPrices.reduce(
    //             (total, value) => total + value, 0
    //         )*1000000/gasPrices.length
    //     )/1000000
    //     const maxGasPrice = Math.max(...gasPrices)
        
    //     const gasPrise = {
    //         minGasPrice,
    //         averageGasPrice,
    //         maxGasPrice
    //     }
    //     return gasPrise
    // } else {
    //     return null
    // }
}