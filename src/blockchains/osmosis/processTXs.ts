import 'dotenv/config'
import { IndexedTx, StargateClient, defaultRegistryTypes } from '@cosmjs/stargate'
import { DecodedTX } from '../decodeTxs'
import { fmt, link, bold, code, FmtString } from 'telegraf/format'
import { osmosis , ibc } from 'osmojs'
import { getDaoDaoNickname } from '../daoDaoNames'
import { minAmountPHMN as minAmountPHMNprod, minAmountPHMNtest, 
    explorerTxOsmosisURL, denomPHMNosmosis, contractPHMNJuno, contractIbcPhmnJuno } from '../../config.json'
import { isPHMNpool, getPoolInfo } from './poolInfo'
import { Registry } from "@cosmjs/proto-signing"
import { MsgSend } from 'osmojs/dist/codegen/cosmos/bank/v1beta1/tx'

const registry = new Registry(defaultRegistryTypes)

const DEPLOYMENT = process.env.DEPLOYMENT
const minAmountPHMN = DEPLOYMENT === 'production'? minAmountPHMNprod : minAmountPHMNtest

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
            // #SplitRouteSwap
            if (msg.typeUrl === '/osmosis.poolmanager.v1beta1.MsgSplitRouteSwapExactAmountIn') {
                // #Buy
                const decodedMsg = osmosis.poolmanager.v1beta1.MsgSplitRouteSwapExactAmountIn.decode(msg.value)
                const route0pools = decodedMsg.routes[0].pools
                if (route0pools[route0pools.length - 1].tokenOutDenom === denomPHMNosmosis) {
                    if (indexedTx === null) indexedTx = await queryClient.getTx(tx.txId)
                    if (indexedTx!.code === 0) {
                        const amount = +osmosis.poolmanager.v1beta1.MsgSplitRouteSwapExactAmountInResponse
                            .decode(indexedTx!.msgResponses[i].value)
                            .tokenOutAmount/1000000
                        if (amount >= minAmountPHMN) {
                            const sender = decodedMsg.sender
                            const nickNameDAODAO = await getDaoDaoNickname(sender)
                            
                            telegramMsg = fmt(telegramMsg, '🐳  #Osmosis #Swap #Buy  💸📥🪙\n', 
                                'Address ', code(sender), nickNameDAODAO, ' bought ', bold(amount.toString() + ' PHMN'), '\n'
                            )
                            
                            countMsgs++
                        }
                    }
                // #Sell
                } else if (decodedMsg.tokenInDenom === denomPHMNosmosis) {
                    let amount = 0
                    for (const route of decodedMsg.routes) {
                        amount += +route.tokenInAmount
                    }
                    amount /= 1e6
                    if (amount >= minAmountPHMN) {
                        if (indexedTx === null) indexedTx = await queryClient.getTx(tx.txId)
                        if (indexedTx!.code === 0) {
                            const sender = decodedMsg.sender
                            const nickNameDAODAO = await getDaoDaoNickname(sender)
                            
                            telegramMsg = fmt(telegramMsg, '🐳  #Osmosis #Swap #Sell  🪙📤💸\n', 
                                'Address ', code(sender), nickNameDAODAO, ' sold ', bold(amount.toString() + ' PHMN'), '\n'
                            )
                            
                            countMsgs++
                        }
                    }
                }
            // #Swap
            } else if (msg.typeUrl === '/osmosis.poolmanager.v1beta1.MsgSwapExactAmountIn') {
                const decodedMsg = osmosis.poolmanager.v1beta1.MsgSwapExactAmountIn.decode(msg.value)
                // #Sell
                if (decodedMsg.tokenIn.denom === denomPHMNosmosis) {
                    const amount = +decodedMsg.tokenIn.amount/1000000
                    if (amount >= minAmountPHMN) {
                        if (indexedTx === null) indexedTx = await queryClient.getTx(tx.txId)
                        if (indexedTx!.code === 0) {
                            const sender = decodedMsg.sender
                            const nickNameDAODAO = await getDaoDaoNickname(sender)
                            
                            telegramMsg = fmt(telegramMsg, '🐳  #Osmosis #Swap #Sell  🪙📤💸\n', 
                                'Address ', code(sender), nickNameDAODAO, ' sold ', bold(amount.toString() + ' PHMN'), '\n'
                            )
                            
                            countMsgs++
                        }
                    }
                // #Buy
                } else if (decodedMsg.routes[decodedMsg.routes.length - 1].tokenOutDenom === denomPHMNosmosis) {
                    if (indexedTx === null) indexedTx = await queryClient.getTx(tx.txId)
                    if (indexedTx!.code === 0) {
                        const amount = +osmosis.poolmanager.v1beta1.MsgSwapExactAmountInResponse
                            .decode(indexedTx!.msgResponses[i].value)
                            .tokenOutAmount/1000000
                        if (amount >= minAmountPHMN) {
                            const sender = decodedMsg.sender
                            const nickNameDAODAO = await getDaoDaoNickname(sender)
                            
                            telegramMsg = fmt(telegramMsg, '🐳  #Osmosis #Swap #Buy  💸📥🪙\n', 
                                'Address ', code(sender), nickNameDAODAO, ' bought ', bold(amount.toString() + ' PHMN'), '\n'
                            )
                            
                            countMsgs++
                        }
                    }
                }
            // #Send
            } else if (msg.typeUrl === '/cosmos.bank.v1beta1.MsgSend') {
                const decodedMsg = registry.decode(msg) as MsgSend
                const denom = denomPHMNosmosis
                let amount = 0
                for (const token of decodedMsg.amount) {
                    if (token.denom === denomPHMNosmosis) {
                        amount += +token.amount/1000000
                    }
                }
                if (amount >= minAmountPHMN) {
                    if (indexedTx === null) indexedTx = await queryClient.getTx(tx.txId)
                    if (indexedTx!.code === 0) {
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
                            
                            telegramMsg = fmt(telegramMsg, '🐳  #Osmosis #Send  📬\n', 
                                'Address ', code(sender), senderDaoDaoNick, ' sent ', bold(amount.toString() + ' PHMN'), ' to ', code(toAddress), toAddressDaoDaoNick, '\n'
                            )
                        } else {
                            const toAddress = decodedMsg.toAddress as string
                            const toAddressDaoDaoNick = await getDaoDaoNickname(toAddress)
                            
                            if (countMsgs > 1) telegramMsg.text = telegramMsg.text.replace(/...\n$/, '')
                            telegramMsg = fmt(telegramMsg, '🐳  #Osmosis #Send  📬\n', 
                                'sent ', bold(amount.toString() + ' PHMN'), ' to ', code(toAddress), toAddressDaoDaoNick, '\n',
                                '...\n'
                            )
                        }
                        countMsgs++
                    }
                }
            // #AddLiquidity
            } else if (msg.typeUrl === '/osmosis.gamm.v1beta1.MsgJoinPool') {
                const decodedMsg = osmosis.gamm.v1beta1.MsgJoinPool.decode(msg.value)
                if (isPHMNpool(decodedMsg.poolId)) {
                    if (indexedTx === null) indexedTx = await queryClient.getTx(tx.txId)
                    if (indexedTx!.code === 0) {
                        const poolInfo = getPoolInfo(decodedMsg.poolId)
                        const tokenIns = osmosis.gamm.v1beta1.MsgJoinPoolResponse
                            .decode(indexedTx!.msgResponses[i].value)
                            .tokenIn
                        const amountPHMN = +tokenIns.find((coin)=>coin.denom === denomPHMNosmosis)!.amount/1e6
                        const amountSecondToken = +tokenIns
                            .find((coin)=>coin.denom === poolInfo!.secondTokenBaseDenom)!
                            .amount/poolInfo!.secondTokenMultiplier
                        if (amountPHMN >= minAmountPHMN) {
                            const sender = decodedMsg.sender
                            const senderDaoDaoNick = await getDaoDaoNickname(sender)

                            telegramMsg = fmt(telegramMsg, '🐳  #Osmosis #AddLiquidity  ➕💰\n', 
                                'Address ', code(sender), senderDaoDaoNick, ' added ', 
                                bold(amountPHMN.toString() + ' PHMN'), ' and ',
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
                    isPHMNpool(decodedMsg.poolId) &&
                    decodedMsg.tokenIn.denom === denomPHMNosmosis &&
                    +decodedMsg.tokenIn.amount/1e6 >= minAmountPHMN
                ) {
                
                    if (indexedTx === null) indexedTx = await queryClient.getTx(tx.txId)
                    if (indexedTx!.code === 0) {
                        const sender = decodedMsg.sender
                        const senderDaoDaoNick = await getDaoDaoNickname(sender)
                        const poolInfo = getPoolInfo(decodedMsg.poolId)

                        telegramMsg = fmt(telegramMsg, '🐳  #Osmosis #AddLiquidity #SingleAsset  ➕💰\n', 
                            'Address ', code(sender), senderDaoDaoNick, ' added ', 
                            bold((+decodedMsg.tokenIn.amount/1e6).toString() + ' PHMN'),
                            ' to the Osmosis liquidity pool #', decodedMsg.poolId.toString(), ' PHMN/', poolInfo!.secondTokenDenom, '\n'
                        )
                            
                        countMsgs++
                    }
                }
            // #RemoveLiquidity
            } else if (msg.typeUrl === '/osmosis.gamm.v1beta1.MsgExitPool') {
                const decodedMsg = osmosis.gamm.v1beta1.MsgExitPool.decode(msg.value)
                if (isPHMNpool(decodedMsg.poolId)) {
                    if (indexedTx === null) indexedTx = await queryClient.getTx(tx.txId)
                    if (indexedTx!.code === 0) {
                        const response = osmosis.gamm.v1beta1.MsgExitPoolResponse
                            .decode(indexedTx!.msgResponses[i].value)

                        const poolInfo = getPoolInfo(decodedMsg.poolId)

                        const amountPHMN = +response.tokenOut
                            .find((coin) => coin.denom === denomPHMNosmosis)!
                            .amount/1e6
                        const amountSecondToken = +response.tokenOut
                            .find((coin) => coin.denom === poolInfo!.secondTokenBaseDenom)!
                            .amount/poolInfo!.secondTokenMultiplier
                        
                        if (amountPHMN >= minAmountPHMN) {
                            const sender = decodedMsg.sender
                            const senderDaoDaoNick = await getDaoDaoNickname(sender)
                        
                            telegramMsg = fmt(telegramMsg, '🐳  #Osmosis #RemoveLiquidity  ➖💰\n', 
                                'Address ', code(sender), senderDaoDaoNick, ' removed ', 
                                bold(amountPHMN.toString() + ' PHMN'), ' and ', bold(amountSecondToken.toString() + ' ' + poolInfo!.secondTokenDenom),
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
                    decodedMsg.sourceChannel === 'channel-169' &&
                    decodedMsg.token.denom === denomPHMNosmosis
                ){
                    const sender = decodedMsg.sender
                    const receiver = decodedMsg.receiver
                    const amount = +decodedMsg.token.amount/1e6
                    if (amount >= minAmountPHMN) {
                        if (indexedTx === null) indexedTx = await queryClient.getTx(tx.txId)
                        if (indexedTx!.code === 0) {
                            const packet_sequence = ibc.applications.transfer.v1.MsgTransferResponse
                                .decode(indexedTx!.msgResponses[i].value)
                            .sequence

                            const [
                                senderDaoDaoNick,
                                receiverDaoDaoNick
                            ] = await Promise.all([
                                getDaoDaoNickname(sender),
                                getDaoDaoNickname(receiver),
                            ])
                
                            telegramMsg = fmt(telegramMsg, '🐳  #Osmosis #IBCtransfer  📬\n',
                                'Address ', code(sender), senderDaoDaoNick, ' sent over IBC protocol ',
                                bold(amount.toString() + ' PHMN'),
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
                if (
                    decodedMsg.packet.sourceChannel === 'channel-169' &&
                    decodedMsg.packet.destinationChannel === 'channel-47' &&
                    decodedMsg.packet.destinationPort === 'wasm.' + contractIbcPhmnJuno
                ) {
                    const data = JSON.parse(new TextDecoder().decode(decodedMsg.packet.data))
                    if (data.denom === 'transfer/channel-169/cw20:' + contractPHMNJuno) {
                        const paccketSequence = decodedMsg.packet.sequence
                        const telegramMsg = ibcMsgsBuffer.find((msg) => msg.packet_sequence === paccketSequence)?.telegramMsg
                        if (telegramMsg) {
                            deleteIbcTx(paccketSequence)
                            const acknowledgement = JSON.parse(new TextDecoder().decode(decodedMsg.acknowledgement))
                            if (acknowledgement.result === 'MQ==') {
                                if (indexedTx === null) indexedTx = await queryClient.getTx(tx.txId)
                                if (indexedTx?.code === 0) {
                                    telegramMsgs.push(telegramMsg)
                                }
                            }
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