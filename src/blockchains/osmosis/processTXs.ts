import 'dotenv/config'
import { IndexedTx, StargateClient, defaultRegistryTypes } from '@cosmjs/stargate'
import { DecodedTX } from '../decodeTxs'
import { fmt, link, bold, code, FmtString } from 'telegraf/format'
import { getDaoDaoNickname } from '../daoDaoNames'
import { minAmount, explorerTxOsmosisURL, denomLEGosmosis, contractLegendDAO } from '../../config.json'
import { Registry } from "@cosmjs/proto-signing"
import { MsgSend } from 'osmojs/dist/codegen/cosmos/bank/v1beta1/tx'
import { getIndexedTx } from '../getTx'
import { cosmwasm } from 'osmojs'

const registry = new Registry(defaultRegistryTypes)

export async function processTxsOsmosis (decodedTxs: DecodedTX[], queryClient: StargateClient) {
    const telegramMsgs: FmtString[] = []
    for (const tx of decodedTxs) {
        let telegramMsg = fmt``
        let countMsgs = 0
        let indexedTx: IndexedTx | null = null
        
        for (let i = 0; i < tx.msgs.length; i++) {
            const msg = tx.msgs[i]
            if (msg.typeUrl === '/cosmos.bank.v1beta1.MsgSend' && countMsgs < 10) {
                // Send

                const decodedMsg = registry.decode(msg) as MsgSend
                let amount = 0
                for (const token of decodedMsg.amount) {
                    if (token.denom === denomLEGosmosis) {
                        amount += +token.amount/1000000
                    }
                }
                if (amount >= minAmount) {
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
                            
                            telegramMsg = fmt(telegramMsg, '🪙  #LEG #Send  📬\n', 
                                'Address ', code(sender), senderDaoDaoNick, ' sent ', bold(amount.toString() + ' LEG'), ' to ', code(toAddress), toAddressDaoDaoNick, '\n'
                            )
                        } else {
                            const toAddress = decodedMsg.toAddress as string
                            const toAddressDaoDaoNick = await getDaoDaoNickname(toAddress)
                            
                            if (countMsgs > 1) telegramMsg.text = telegramMsg.text.replace(/...\n$/, '')
                            telegramMsg = fmt(telegramMsg, '🪙  #LEG #Send  📬\n', 
                                'sent ', bold(amount.toString() + ' LEG'), ' to ', code(toAddress), toAddressDaoDaoNick, '\n',
                                '...\n'
                            )
                        }
                        countMsgs++
                    }
                }
            } else if (tx.msgs[i].typeUrl === '/cosmwasm.wasm.v1.MsgExecuteContract' && countMsgs < 10) {
                // MsgExecuteContract
                const msg = cosmwasm.wasm.v1.MsgExecuteContract.decode(tx.msgs[i].value)
                if (msg.contract === contractLegendDAO) {
                    // Legend DAO
                    const sender = msg.sender
                    
                    const executeContractMsg = JSON.parse(new TextDecoder().decode(msg.msg))
                    if (executeContractMsg.stake) {
                        // #LegendDAO #Stake
                        const amount = msg.funds.find(fund => fund.denom === denomLEGosmosis)?.amount
                        if(!amount) continue;
                        const amountNum = Number(amount)/1e6
                        if (amountNum < minAmount) continue;
                        
                        const senderDaoDaoNick = await getDaoDaoNickname(sender)
                        telegramMsg = fmt(telegramMsg, '🪙  #LegendDAO #Stake  🔐\n', 
                            'Address ', code(sender), senderDaoDaoNick, 
                            ' staked ', bold(amountNum.toString() + ' LEG'),
                            ' in the Legend token DAO\n'
                        )
                        countMsgs++
                    } else if (executeContractMsg.unstake) {
                        // #LegendDAO #Unstake
                        const amount = +executeContractMsg.unstake.amount / 1e6
                        if (amount >= minAmount) {
                            const sender = msg.sender
                            const senderDaoDaoNick = await getDaoDaoNickname(sender)
                            
                            telegramMsg = fmt(telegramMsg, '🪙  #LegendDAO #Unstake  🔓\n',
                                'Address ', code(sender), senderDaoDaoNick, ' requested unstake ',
                                bold(amount.toString() + ' LEG'), ' from Legend token DAO\n'
                            )
                            countMsgs++
                        }
                    } else if (executeContractMsg.claim) {
                        // #LegendDAO #Withdraw
                        if (indexedTx === null) indexedTx = await getIndexedTx(queryClient, tx.txId)
                        if (indexedTx.code === 0) {
                            const amount = +(indexedTx.events.find((ev) =>
                                ev.type === 'wasm' &&
                                ev.attributes.find((atr) => atr.key === '_contract_address')?.value === contractLegendDAO
                            )?.attributes.find((atr) => atr.key === 'amount')?.value || '0')/1e6
                            if (amount >= minAmount) {
                                const sender = msg.sender
                                const senderDaoDaoNick = await getDaoDaoNickname(sender)

                                telegramMsg = fmt(telegramMsg, '🪙  #LegendDAO #Withdraw  📬🪙📭\n', 
                                    'Address ', code(sender), senderDaoDaoNick, 
                                    ' withdraw from Legend token DAO ', bold(amount.toString() + ' LEG'), '\n'
                                )
                                countMsgs++
                            }
                        }
                    }
                }
            }
        }
        
        if (countMsgs > 0) {
            telegramMsg = fmt(telegramMsg, link('\nTX link', explorerTxOsmosisURL + tx.txId))
            if (tx.memo !== '') {
                telegramMsg = fmt(telegramMsg, '\n\n memo: ', tx.memo)
            }
            
            telegramMsgs.push(telegramMsg)
        }
    }
    return telegramMsgs
}