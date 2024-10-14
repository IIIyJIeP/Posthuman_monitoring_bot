import 'dotenv/config'
import { IndexedTx, StargateClient, defaultRegistryTypes } from '@cosmjs/stargate'
import { DecodedTX } from '../decodeTxs'
import { fmt, link, bold, code, FmtString } from 'telegraf/format'
import { osmosis , ibc } from 'osmojs'
import { getDaoDaoNickname } from '../daoDaoNames'
import { minAmountWEIRD as minAmountWEIRDprod, minAmountWEIRDtest, 
    explorerTxOsmosisURL, denomWEIRDosmosis } from '../../config.json'
import { isWeirdPool, getPoolInfo } from './poolInfo'
import { Registry } from "@cosmjs/proto-signing"
import { MsgSend } from 'osmojs/dist/codegen/cosmos/bank/v1beta1/tx'
import { getIndexedTx } from '../getTx'
import { getReceiverFromMemo } from '../../utils/memojson'

const registry = new Registry(defaultRegistryTypes)

const DEPLOYMENT = process.env.DEPLOYMENT
const minAmountWEIRD = DEPLOYMENT === 'production'? minAmountWEIRDprod : minAmountWEIRDtest

let ibcMsgsBuffer: {
    packet_sequence: bigint,
    telegramMsg: FmtString
}[] = []
function deleteIbcTx (sequence: bigint) {
    ibcMsgsBuffer = ibcMsgsBuffer.filter((msg) => msg.packet_sequence !== sequence)
}

export async function processTxsOsmosis (decodedTxs: DecodedTX[], queryClient: StargateClient) {
    const telegramMsgs: FmtString[] = []
    for (const tx of decodedTxs) {
        let telegramMsg = fmt``
        let countMsgs = 0
        let indexedTx: IndexedTx | null = null
        
        for (let i = 0; i < tx.msgs.length; i++) {
            const msg = tx.msgs[i]
            if (msg.typeUrl === '/osmosis.poolmanager.v1beta1.MsgSplitRouteSwapExactAmountIn') {
                // #SplitRouteSwap
                const decodedMsg = osmosis.poolmanager.v1beta1.MsgSplitRouteSwapExactAmountIn.decode(msg.value)
                const route0pools = decodedMsg.routes[0].pools
                if (route0pools[route0pools.length - 1].tokenOutDenom === denomWEIRDosmosis) {
                    // #Buy
                    if (indexedTx === null) indexedTx = await getIndexedTx(queryClient, tx.txId)
                    if (indexedTx.code === 0) {
                        const amount = +osmosis.poolmanager.v1beta1.MsgSplitRouteSwapExactAmountInResponse
                            .decode(indexedTx.msgResponses[i].value)
                            .tokenOutAmount/1000000
                        if (amount >= minAmountWEIRD) {
                            const sender = decodedMsg.sender
                            const nickNameDAODAO = await getDaoDaoNickname(sender)
                            
                            telegramMsg = fmt(telegramMsg, '🪙  #Osmosis #Swap #Buy  💸📥🪙\n', 
                                'Address ', code(sender), nickNameDAODAO, ' bought ', bold(amount.toString() + ' WEIRD'), '\n'
                            )
                            
                            countMsgs++
                        }
                    }
                } else if (decodedMsg.tokenInDenom === denomWEIRDosmosis) {
                    // #Sell
                    let amount = 0
                    for (const route of decodedMsg.routes) {
                        amount += +route.tokenInAmount
                    }
                    amount /= 1e6
                    if (amount >= minAmountWEIRD) {
                        if (indexedTx === null) indexedTx = await getIndexedTx(queryClient, tx.txId)
                        if (indexedTx.code === 0) {
                            const sender = decodedMsg.sender
                            const nickNameDAODAO = await getDaoDaoNickname(sender)
                            
                            telegramMsg = fmt(telegramMsg, '🪙  #Osmosis #Swap #Sell  🪙📤💸\n', 
                                'Address ', code(sender), nickNameDAODAO, ' sold ', bold(amount.toString() + ' WEIRD'), '\n'
                            )
                            
                            countMsgs++
                        }
                    }
                }
            } else if (msg.typeUrl === '/osmosis.poolmanager.v1beta1.MsgSplitRouteSwapExactAmountOut') {
                // #SplitRouteSwap
                const decodedMsg = osmosis.poolmanager.v1beta1.MsgSplitRouteSwapExactAmountOut.decode(msg.value)
                const route0pools = decodedMsg.routes[0].pools
                if (route0pools[0].tokenInDenom === denomWEIRDosmosis) {
                    // #Sell
                    if (indexedTx === null) indexedTx = await getIndexedTx(queryClient, tx.txId)
                    if (indexedTx.code === 0) {
                        const amount = +osmosis.poolmanager.v1beta1.MsgSplitRouteSwapExactAmountOutResponse
                            .decode(indexedTx.msgResponses[i].value)
                            .tokenInAmount/1e6
                        if (amount >= minAmountWEIRD) {
                            const sender = decodedMsg.sender
                            const nickNameDAODAO = await getDaoDaoNickname(sender)
                            
                            telegramMsg = fmt(telegramMsg, '🪙  #Osmosis #Swap #Sell  🪙📤💸\n', 
                                'Address ', code(sender), nickNameDAODAO, ' sold ', bold(amount.toString() + ' WEIRD'), '\n'
                            )
                            
                            countMsgs++
                        }
                    }
                } else if (decodedMsg.tokenOutDenom === denomWEIRDosmosis) {
                    // #Buy
                    let amount = 0
                    for (const route of decodedMsg.routes) {
                        amount += +route.tokenOutAmount
                    }
                    amount /= 1e6
                    if (amount >= minAmountWEIRD) {
                        if (indexedTx === null) indexedTx = await getIndexedTx(queryClient, tx.txId)
                        if (indexedTx.code === 0) {
                            const sender = decodedMsg.sender
                            const nickNameDAODAO = await getDaoDaoNickname(sender)
                            
                            telegramMsg = fmt(telegramMsg, '🪙  #Osmosis #Swap #Buy  💸📥🪙\n', 
                                'Address ', code(sender), nickNameDAODAO, ' bought ', bold(amount.toString() + ' WEIRD'), '\n'
                            )
                            
                            countMsgs++
                        }
                    }
                }
            } else if (msg.typeUrl === '/osmosis.poolmanager.v1beta1.MsgSwapExactAmountIn') {
                // #Swap
                const decodedMsg = osmosis.poolmanager.v1beta1.MsgSwapExactAmountIn.decode(msg.value)
                if (decodedMsg.tokenIn.denom === denomWEIRDosmosis) {
                    // #Sell
                    const amount = +decodedMsg.tokenIn.amount/1000000
                    if (amount >= minAmountWEIRD) {
                        if (indexedTx === null) indexedTx = await getIndexedTx(queryClient, tx.txId)
                        if (indexedTx.code === 0) {
                            const sender = decodedMsg.sender
                            const nickNameDAODAO = await getDaoDaoNickname(sender)
                            
                            telegramMsg = fmt(telegramMsg, '🪙  #Osmosis #Swap #Sell  🪙📤💸\n', 
                                'Address ', code(sender), nickNameDAODAO, ' sold ', bold(amount.toString() + ' WEIRD'), '\n'
                            )
                            
                            countMsgs++
                        }
                    }
                } else if (decodedMsg.routes[decodedMsg.routes.length - 1].tokenOutDenom === denomWEIRDosmosis) {
                    // #Buy
                    if (indexedTx === null) indexedTx = await getIndexedTx(queryClient, tx.txId)
                    if (indexedTx.code === 0) {
                        const amount = +osmosis.poolmanager.v1beta1.MsgSwapExactAmountInResponse
                            .decode(indexedTx.msgResponses[i].value)
                            .tokenOutAmount/1000000
                        if (amount >= minAmountWEIRD) {
                            const sender = decodedMsg.sender
                            const nickNameDAODAO = await getDaoDaoNickname(sender)
                            
                            telegramMsg = fmt(telegramMsg, '🪙  #Osmosis #Swap #Buy  💸📥🪙\n', 
                                'Address ', code(sender), nickNameDAODAO, ' bought ', bold(amount.toString() + ' WEIRD'), '\n'
                            )
                            
                            countMsgs++
                        }
                    }
                }
            } else if (msg.typeUrl === '/osmosis.poolmanager.v1beta1.MsgSwapExactAmountOut') {
                // #Swap
                const decodedMsg = osmosis.poolmanager.v1beta1.MsgSwapExactAmountOut.decode(msg.value)
                if (decodedMsg.tokenOut.denom === denomWEIRDosmosis) {
                    // #Buy
                    const amount = +decodedMsg.tokenOut.amount/1e6
                    if (amount >= minAmountWEIRD) {
                        if (indexedTx === null) indexedTx = await getIndexedTx(queryClient, tx.txId)
                        if (indexedTx.code === 0) {
                            const sender = decodedMsg.sender
                            const nickNameDAODAO = await getDaoDaoNickname(sender)
                            
                            telegramMsg = fmt(telegramMsg, '🪙  #Osmosis #Swap #Buy  💸📥🪙\n', 
                                'Address ', code(sender), nickNameDAODAO, ' bought ', bold(amount.toString() + ' WEIRD'), '\n'
                            )
                            
                            countMsgs++
                        }
                    }
                } else if (decodedMsg.routes[0].tokenInDenom === denomWEIRDosmosis) {
                    // #Sell
                    if (indexedTx === null) indexedTx = await getIndexedTx(queryClient, tx.txId)
                    if (indexedTx.code === 0) {
                        const amount = +osmosis.poolmanager.v1beta1.MsgSwapExactAmountOutResponse
                            .decode(indexedTx.msgResponses[i].value)
                            .tokenInAmount/1e6
                        if (amount >= minAmountWEIRD) {
                            const sender = decodedMsg.sender
                            const nickNameDAODAO = await getDaoDaoNickname(sender)
                            
                            telegramMsg = fmt(telegramMsg, '🪙  #Osmosis #Swap #Sell  🪙📤💸\n', 
                                'Address ', code(sender), nickNameDAODAO, ' sold ', bold(amount.toString() + ' WEIRD'), '\n'
                            )
                            
                            countMsgs++
                        }
                    }
                }
            } else if (msg.typeUrl === '/cosmos.bank.v1beta1.MsgSend') {
                // #Send
                const decodedMsg = registry.decode(msg) as MsgSend
                const denom = denomWEIRDosmosis
                let amount = 0
                for (const token of decodedMsg.amount) {
                    if (token.denom === denomWEIRDosmosis) {
                        amount += +token.amount/1000000
                    }
                }
                if (amount >= minAmountWEIRD) {
                    if (indexedTx === null) indexedTx = await getIndexedTx(queryClient, tx.txId)
                    if (indexedTx.code === 0) {
                        if (countMsgs === 0) {
                            const sender = decodedMsg.fromAddress as string
                            const toAddress = decodedMsg.toAddress as string
                            
                            const [
                                senderDaoDaoNick,
                                toAddressDaoDaoNick
                            ] = await Promise.all([
                                getDaoDaoNickname(sender),
                                getDaoDaoNickname(toAddress)
                            ]) 
                            
                            telegramMsg = fmt(telegramMsg, '🪙  #Osmosis #Send  📬\n', 
                                'Address ', code(sender), senderDaoDaoNick, ' sent ', bold(amount.toString() + ' WEIRD'), ' to ', code(toAddress), toAddressDaoDaoNick, '\n'
                            )
                        } else {
                            const toAddress = decodedMsg.toAddress as string
                            const toAddressDaoDaoNick = await getDaoDaoNickname(toAddress)
                            
                            if (countMsgs > 1) telegramMsg.text = telegramMsg.text.replace(/...\n$/, '')
                            telegramMsg = fmt(telegramMsg, '🪙  #Osmosis #Send  📬\n', 
                                'sent ', bold(amount.toString() + ' WEIRD'), ' to ', code(toAddress), toAddressDaoDaoNick, '\n',
                                '...\n'
                            )
                        }
                        countMsgs++
                    }
                }
            // #AddLiquidity
            } else if (msg.typeUrl === '/osmosis.gamm.v1beta1.MsgJoinPool') {
                const decodedMsg = osmosis.gamm.v1beta1.MsgJoinPool.decode(msg.value)
                if (isWeirdPool(decodedMsg.poolId)) {
                    if (indexedTx === null) indexedTx = await getIndexedTx(queryClient, tx.txId)
                    if (indexedTx.code === 0) {
                        const poolInfo = getPoolInfo(decodedMsg.poolId)
                        const tokenIns = osmosis.gamm.v1beta1.MsgJoinPoolResponse
                            .decode(indexedTx.msgResponses[i].value)
                            .tokenIn
                        const amountWEIRD = +tokenIns.find((coin)=>coin.denom === denomWEIRDosmosis)!.amount/1e6
                        const amountSecondToken = +tokenIns
                            .find((coin)=>coin.denom === poolInfo!.secondTokenBaseDenom)!
                            .amount/poolInfo!.secondTokenMultiplier
                        if (amountWEIRD >= minAmountWEIRD) {
                            const sender = decodedMsg.sender
                            const senderDaoDaoNick = await getDaoDaoNickname(sender)

                            telegramMsg = fmt(telegramMsg, '🪙  #Osmosis #AddLiquidity  ➕💰\n', 
                                'Address ', code(sender), senderDaoDaoNick, ' added ', 
                                bold(amountWEIRD.toString() + ' WEIRD'), ' and ',
                                bold(amountSecondToken.toString() + ' ' + poolInfo!.secondTokenDenom),
                                ' to the Osmosis liquidity pool #', poolInfo!.poolId.toString(), '\n'
                            )
                            
                            countMsgs++
                        }
                    }
                }
            // #AddLiquidity #SingleAsset
            } else if (msg.typeUrl === '/osmosis.gamm.v1beta1.MsgJoinSwapExternAmountIn') { 
                const decodedMsg = osmosis.gamm.v1beta1.MsgJoinSwapExternAmountIn.decode(msg.value)
                if (
                    isWeirdPool(decodedMsg.poolId) &&
                    decodedMsg.tokenIn.denom === denomWEIRDosmosis &&
                    +decodedMsg.tokenIn.amount/1e6 >= minAmountWEIRD
                ) {
                
                    if (indexedTx === null) indexedTx = await getIndexedTx(queryClient, tx.txId)
                    if (indexedTx.code === 0) {
                        const sender = decodedMsg.sender
                        const senderDaoDaoNick = await getDaoDaoNickname(sender)
                        const poolInfo = getPoolInfo(decodedMsg.poolId)

                        telegramMsg = fmt(telegramMsg, '🪙  #Osmosis #AddLiquidity #SingleAsset  ➕💰\n', 
                            'Address ', code(sender), senderDaoDaoNick, ' added ', 
                            bold((+decodedMsg.tokenIn.amount/1e6).toString() + ' WEIRD'),
                            ' to the Osmosis liquidity pool #', decodedMsg.poolId.toString(), ' WEIRD/', poolInfo!.secondTokenDenom, '\n'
                        )
                            
                        countMsgs++
                    }
                }
            // #RemoveLiquidity
            } else if (msg.typeUrl === '/osmosis.gamm.v1beta1.MsgExitPool') {
                const decodedMsg = osmosis.gamm.v1beta1.MsgExitPool.decode(msg.value)
                if (isWeirdPool(decodedMsg.poolId)) {
                    if (indexedTx === null) indexedTx = await getIndexedTx(queryClient, tx.txId)
                    if (indexedTx.code === 0) {
                        const response = osmosis.gamm.v1beta1.MsgExitPoolResponse
                            .decode(indexedTx.msgResponses[i].value)

                        const poolInfo = getPoolInfo(decodedMsg.poolId)

                        const amountWEIRD = +response.tokenOut
                            .find((coin) => coin.denom === denomWEIRDosmosis)!
                            .amount/1e6
                        const amountSecondToken = +response.tokenOut
                            .find((coin) => coin.denom === poolInfo!.secondTokenBaseDenom)!
                            .amount/poolInfo!.secondTokenMultiplier
                        
                        if (amountWEIRD >= minAmountWEIRD) {
                            const sender = decodedMsg.sender
                            const senderDaoDaoNick = await getDaoDaoNickname(sender)
                        
                            telegramMsg = fmt(telegramMsg, '🪙  #Osmosis #RemoveLiquidity  ➖💰\n', 
                                'Address ', code(sender), senderDaoDaoNick, ' removed ', 
                                bold(amountWEIRD.toString() + ' WEIRD'), ' and ', bold(amountSecondToken.toString() + ' ' + poolInfo!.secondTokenDenom),
                                ' from the Osmosis liquidity pool #', decodedMsg.poolId.toString(), '\n'
                            )
                            countMsgs++
                        }
                    }
                }
            // #IBCtransfer
            } else if (msg.typeUrl === '/ibc.applications.transfer.v1.MsgTransfer') {
                const decodedMsg = ibc.applications.transfer.v1.MsgTransfer.decode(msg.value)
                if (
                    decodedMsg.token.denom === denomWEIRDosmosis
                ){
                    const sender = decodedMsg.sender
                    const receiver = getReceiverFromMemo(decodedMsg.memo) || decodedMsg.receiver
                    const amount = +decodedMsg.token.amount/1e6
                    if (amount >= minAmountWEIRD) {
                        if (indexedTx === null) indexedTx = await getIndexedTx(queryClient, tx.txId)
                        if (indexedTx.code === 0) {
                            const packet_sequence = ibc.applications.transfer.v1.MsgTransferResponse
                                .decode(indexedTx.msgResponses[i].value)
                            .sequence

                            const [
                                senderDaoDaoNick,
                                receiverDaoDaoNick
                            ] = await Promise.all([
                                getDaoDaoNickname(sender),
                                getDaoDaoNickname(receiver),
                            ])
                
                            telegramMsg = fmt(telegramMsg, '🪙  #Osmosis #IBCtransfer  📬\n',
                                'Address ', code(sender), senderDaoDaoNick, ' sent over IBC protocol ',
                                bold(amount.toString() + ' WEIRD'),
                                ' to ', code(receiver), receiverDaoDaoNick, '\n',
                                link('TX link', explorerTxOsmosisURL + tx.txId)
                            )
                            if (tx.memo !== '') {
                                telegramMsg = fmt(telegramMsg, '\n\n memo: ', tx.memo)
                            }

                            ibcMsgsBuffer.push({
                                packet_sequence,
                                telegramMsg
                            })
                            setTimeout(deleteIbcTx, 1800*1000, packet_sequence)
                        }
                    }
                }
            // #IbcAcknowledgevent
            } else if (msg.typeUrl === '/ibc.core.channel.v1.MsgAcknowledgement') {
                const decodedMsg = ibc.core.channel.v1.MsgAcknowledgement.decode(msg.value)
                const paccketSequence = decodedMsg.packet.sequence
                const telegramMsg = ibcMsgsBuffer.find((msg) => msg.packet_sequence === paccketSequence)?.telegramMsg
                if (telegramMsg) {
                    deleteIbcTx(paccketSequence)
                    const acknowledgement = JSON.parse(new TextDecoder().decode(decodedMsg.acknowledgement))
                    if (acknowledgement.result === 'MQ==' || acknowledgement.result === 'AQ==') {
                        if (indexedTx === null) indexedTx = await getIndexedTx(queryClient, tx.txId)
                        if (indexedTx.code === 0) {
                            telegramMsgs.push(telegramMsg)
                        }
                    }
                }
            }
        }
        
        if (countMsgs > 0) {
            telegramMsg = fmt(telegramMsg, link('TX link', explorerTxOsmosisURL + tx.txId))
            if (tx.memo !== '') {
                telegramMsg = fmt(telegramMsg, '\n\n memo: ', tx.memo)
            }
            
            telegramMsgs.push(telegramMsg)
        }
    }
    return telegramMsgs
}