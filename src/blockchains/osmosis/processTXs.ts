import 'dotenv/config'
import { IndexedTx, StargateClient } from '@cosmjs/stargate'
import { DecodedTX } from './decodeTxs'
import { fmt, link, bold, code, FmtString } from 'telegraf/format'
import { osmosis , ibc} from 'osmojs'
import { getDaoDaoNickname } from '../daoDaoNames'
import { minAmountPHMN as minAmountPHMNprod, minAmountPHMNtest, 
    explorerTxOsmosisURL, denomPHMNosmosis, contractPHMNJuno } from '../../config.json'
import { isPHMNpool, getPoolInfo } from './poolInfo'

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
        //console.log(tx)
        let telegramMsg = fmt``
        let countMsgs = 0
        let indexedTx: IndexedTx | null = null
        for (let i = 0; i < tx.msgs.length; i++) {
            const msg = tx.msgs[i]
            
            // #SplitRouteSwap
            if (msg.typeUrl === '/osmosis.poolmanager.v1beta1.MsgSplitRouteSwapExactAmountIn') {
                // #Buy
                const route0pools = msg.value.routes[0].pools
                if (route0pools[route0pools.length - 1].tokenOutDenom === denomPHMNosmosis) {
                    if (indexedTx === null) indexedTx = await queryClient.getTx(tx.txId)
                    if (indexedTx?.code === 0) {
                        const amount = +osmosis.poolmanager.v1beta1.MsgSplitRouteSwapExactAmountInResponse
                            .decode(indexedTx?.msgResponses[i].value)
                            .tokenOutAmount/1000000
                        if (amount >= minAmountPHMN) {
                            const sender = msg.value.sender
                            const nickNameDAODAO = await getDaoDaoNickname(sender)
                            
                            telegramMsg = fmt(telegramMsg, '🐳  #Osmosis #Swap #Buy  💸📥🪙\n', 
                                'Address ', code(sender), nickNameDAODAO, ' bought ', bold(amount.toString() + ' PHMN'), '\n'
                            )
                            
                            countMsgs++
                        }
                    }
                // #Sell
                } else if (msg.value.tokenInDenom === denomPHMNosmosis) {
                    let amount = 0
                    for (const route of msg.value.routes) {
                        amount += +route.tokenInAmount
                    }
                    amount /= 1e6
                    if (amount >= minAmountPHMN) {
                        if (indexedTx === null) indexedTx = await queryClient.getTx(tx.txId)
                        if (indexedTx?.code === 0) {
                            const sender = msg.value.sender
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
                // #Sell
                if (msg.value.tokenIn.denom === denomPHMNosmosis) {
                    const amount = +msg.value.tokenIn.amount/1000000
                    if (amount >= minAmountPHMN) {
                        if (indexedTx === null) indexedTx = await queryClient.getTx(tx.txId)
                        if (indexedTx?.code === 0) {
                            const sender = msg.value.sender
                            const nickNameDAODAO = await getDaoDaoNickname(sender)
                            
                            telegramMsg = fmt(telegramMsg, '🐳  #Osmosis #Swap #Sell  🪙📤💸\n', 
                                'Address ', code(sender), nickNameDAODAO, ' sold ', bold(amount.toString() + ' PHMN'), '\n'
                            )
                            
                            countMsgs++
                        }
                    }
                // #Buy
                } else if (msg.value.routes[msg.value.routes.length - 1].tokenOutDenom === denomPHMNosmosis) {
                    if (indexedTx === null) indexedTx = await queryClient.getTx(tx.txId)
                    if (indexedTx?.code === 0) {
                        const amount = +osmosis.poolmanager.v1beta1.MsgSwapExactAmountInResponse
                            .decode(indexedTx?.msgResponses[i].value)
                            .tokenOutAmount/1000000
                        if (amount >= minAmountPHMN) {
                            const sender = msg.value.sender
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
                let denom = ''
                let amount = 0
                for (const token of msg.value.amount) {
                    if (token.denom === denomPHMNosmosis) {
                        denom = token.denom
                        amount += +token.amount/1000000
                    }
                }
                if (denom === denomPHMNosmosis && amount >= minAmountPHMN) {
                    if (indexedTx === null) indexedTx = await queryClient.getTx(tx.txId)
                    if (indexedTx?.code === 0) {
                        if (countMsgs === 0) {
                            const sender = msg.value.fromAddress
                            const toAddress = msg.value.toAddress
                            
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
                            const toAddress = msg.value.toAddress
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
            } else if (msg.typeUrl === '/osmosis.gamm.v1beta1.MsgJoinPool' && isPHMNpool(msg.value.poolId)) {
                if (indexedTx === null) indexedTx = await queryClient.getTx(tx.txId)
                if (indexedTx?.code === 0) {
                    const poolInfo = getPoolInfo(msg.value.poolId)
                    const tokenIns = osmosis.gamm.v1beta1.MsgJoinPoolResponse
                        .decode(indexedTx?.msgResponses[i].value)
                        .tokenIn
                    const amountPHMN = +tokenIns.find((coin)=>coin.denom === denomPHMNosmosis)!.amount/1e6
                    const amountSecondToken = +tokenIns
                        .find((coin)=>coin.denom === poolInfo?.secondTokenBaseDenom)!
                        .amount/poolInfo!.secondTokenMultiplier
                    if (amountPHMN >= minAmountPHMN) {
                        const sender = msg.value.sender
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
            // #AddLiquidity #SingleAsset
            } else if (
                msg.typeUrl === '/osmosis.gamm.v1beta1.MsgJoinSwapExternAmountIn' && 
                isPHMNpool(msg.value.poolId) &&
                msg.value.tokenIn.denom === denomPHMNosmosis &&
                +msg.value.tokenIn.amount/1e6 >= minAmountPHMN
            ) {
                if (indexedTx === null) indexedTx = await queryClient.getTx(tx.txId)
                if (indexedTx?.code === 0) {
                    const sender = msg.value.sender
                    const senderDaoDaoNick = await getDaoDaoNickname(sender)
                    const poolInfo = getPoolInfo(msg.value.poolId)

                    telegramMsg = fmt(telegramMsg, '🐳  #Osmosis #AddLiquidity #SingleAsset  ➕💰\n', 
                        'Address ', code(sender), senderDaoDaoNick, ' added ', 
                        bold((+msg.value.tokenIn.amount/1e6).toString() + ' PHMN'),
                        ' to the Osmosis liquidity pool #', msg.value.poolId.toString(), ' PHMN/', poolInfo?.secondTokenDenom, '\n'
                    )
                        
                    countMsgs++
                }
            // #RemoveLiquidity
            } else if (
                msg.typeUrl === '/osmosis.gamm.v1beta1.MsgExitPool' &&
                isPHMNpool(msg.value.poolId)
            ) {
                if (indexedTx === null) indexedTx = await queryClient.getTx(tx.txId)
                if (indexedTx?.code === 0) {
                    const response = osmosis.gamm.v1beta1.MsgExitPoolResponse
                        .decode(indexedTx.msgResponses[i].value)

                    const poolInfo = getPoolInfo(msg.value.poolId)

                    const amountPHMN = +response.tokenOut
                        .find((coin) => coin.denom === denomPHMNosmosis)!
                        .amount/1e6
                    const amountSecondToken = +response.tokenOut
                        .find((coin) => coin.denom === poolInfo!.secondTokenBaseDenom)!
                        .amount/poolInfo!.secondTokenMultiplier
                    
                    if (amountPHMN >= minAmountPHMN) {
                        const sender = msg.value.sender
                        const senderDaoDaoNick = await getDaoDaoNickname(sender)
                    
                        telegramMsg = fmt(telegramMsg, '🐳  #Osmosis #RemoveLiquidity  ➖💰\n', 
                            'Address ', code(sender), senderDaoDaoNick, ' removed ', 
                            bold(amountPHMN.toString() + ' PHMN'), ' and ', bold(amountSecondToken.toString() + ' ' + poolInfo?.secondTokenDenom),
                            ' from the Osmosis liquidity pool #', msg.value.poolId.toString(), '\n'
                        )
                        countMsgs++
                    }
                }
            // #IBCtransfer
            } else if (
                msg.typeUrl === '/ibc.applications.transfer.v1.MsgTransfer' &&
                msg.value.sourceChannel === 'channel-169' &&
                msg.value.token.denom === denomPHMNosmosis
            ) {
                const sender = msg.value.sender
                const receiver = msg.value.receiver
                const amount = +msg.value.token.amount/1e6
                if (amount >= minAmountPHMN) {
                    if (indexedTx === null) indexedTx = await queryClient.getTx(tx.txId)
                    if (indexedTx?.code === 0) {
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
            // #IbcAcknowledgevent
            } else if (
                msg.typeUrl === '/ibc.core.channel.v1.MsgAcknowledgement' &&
                msg.value.packet.sourceChannel === 'channel-169' &&
                msg.value.packet.destinationChannel === 'channel-47' &&
                msg.value.packet.destinationPort === 'wasm.juno1v4887y83d6g28puzvt8cl0f3cdhd3y6y9mpysnsp3k8krdm7l6jqgm0rkn'
            ) {
                const data = JSON.parse(new TextDecoder().decode(msg.value.packet.data))
                if (data.denom === 'transfer/channel-169/cw20:' + contractPHMNJuno) {
                    const paccketSequence = BigInt(msg.value.packet.sequence)
                    const telegramMsg = ibcMsgsBuffer.find((msg) => msg.packet_sequence === paccketSequence)?.telegramMsg
                    if (telegramMsg) {
                        deleteIbcTx(paccketSequence)
                        const acknowledgement = JSON.parse(new TextDecoder().decode(msg.value.acknowledgement))
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