import 'dotenv/config'
import { IndexedTx, StargateClient} from '@cosmjs/stargate'
import { decodeTxsInBlock } from './src/blockchains/osmosis/processTxs'
import { fmt, link, bold, code } from 'telegraf/format'
import { osmosis } from 'osmojs'

const height = 13289992
const minAmountPHMN = 0.000001

const osmoRpcEndpoint = process.env.RPC_ENDPOINT_OSMO || 'https://rpc.osmosis.zone'
const daoDaoNamesURL = 'https://pfpk.daodao.zone/address/'
const mintscanTxOsmosisURL = 'https://www.mintscan.io/osmosis/tx/'
const denomPHMNosmosis = 'ibc/D3B574938631B0A1BA704879020C696E514CFADAA7643CDE4BD5EB010BDE327B'

app()
async function app() {
    const osmoQueryClient = await StargateClient.connect(osmoRpcEndpoint)
    const block = await osmoQueryClient.getBlock(height)
    for (const tx of await decodeTxsInBlock(block)) {
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
                    if (indexedTx === null) indexedTx = await osmoQueryClient.getTx(tx.txId)
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
                        amount += +route.tokenInAmount/1000000
                    }
                    if (amount >= minAmountPHMN) {
                        if (indexedTx === null) indexedTx = await osmoQueryClient.getTx(tx.txId)
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
                        if (indexedTx === null) indexedTx = await osmoQueryClient.getTx(tx.txId)
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
                    if (indexedTx === null) indexedTx = await osmoQueryClient.getTx(tx.txId)
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
                    if (indexedTx === null) indexedTx = await osmoQueryClient.getTx(tx.txId)
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
            }
        }
        
        if (countMsgs > 0) {
            telegramMsg = fmt(telegramMsg, link('TX link', mintscanTxOsmosisURL + tx.txId))
            if (tx.memo !== '') {
                telegramMsg = fmt(telegramMsg, '\n\n memo: ', tx.memo)
            }
            
            console.log(telegramMsg)
        }
    }
}
async function getDaoDaoNickname (address:string) {
    try{
        const response = await fetch(daoDaoNamesURL + address)
        if (response.ok) {
            const name = (await response.json()).name
            if (name !== null) {
                return '(' + name + ')'
            }
        } 
    } catch (err) {
        console.error(err)
    }
    return ''
}