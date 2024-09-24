import 'dotenv/config'
import { FmtString } from 'telegraf/format'
import { IndexedTx, StargateClient, } from '@cosmjs/stargate'
import { fmt, link, bold, code } from 'telegraf/format'
import { DecodedTX } from '../decodeTxs'

import { MsgSend } from '@neutron-org/neutronjs/cosmos/bank/v1beta1/tx'
import { MsgTransfer, MsgTransferResponse } from '@neutron-org/neutronjs/ibc/applications/transfer/v1/tx'
import { MsgAcknowledgement } from '@neutron-org/neutronjs/ibc/core/channel/v1/tx'
import { MsgExecuteContract } from '@neutron-org/neutronjs/cosmwasm/wasm/v1/tx'
import { MsgBurn } from '@neutron-org/neutronjs/osmosis/tokenfactory/v1beta1/tx'

import { minAmountWEIRD as minAmountWEIRDprod, minAmountWEIRDtest,
    denomWEIRDneutron, explorerTxNeutronURL, contractDASstake
} from '../../config.json'
import { getDaoDaoNickname } from '../daoDaoNames'
import { getIndexedTx } from '../getTx'
import { getReceiverFromMemo } from '../../utils/memojson'

const DEPLOYMENT = process.env.DEPLOYMENT
const minAmountWEIRD = DEPLOYMENT === 'production'? minAmountWEIRDprod : minAmountWEIRDtest

let ibcMsgsBuffer: {
    packet_sequence: bigint,
    telegramMsg: FmtString
}[] = []
function deleteIbcTx (sequence: bigint) {
    ibcMsgsBuffer = ibcMsgsBuffer.filter((msg) => msg.packet_sequence !== sequence)
}

export async function processTxsNeutron (decodedTxs: DecodedTX[], queryClient: StargateClient) {
    const telegramMsgs: FmtString[] = []
    for (const tx of decodedTxs) {
        let telegramMsg = fmt``
        let countMsgs = 0
        let indexedTx: IndexedTx | null = null
        
        for (let i = 0; i < tx.msgs.length; i++) {
            const msg = tx.msgs[i]
            if (msg.typeUrl === MsgSend.typeUrl) {
                // #Send
            
                const decodedMsg = MsgSend.decode(msg.value)
                let amount = 0
                for (const token of decodedMsg.amount) {
                    if (token.denom === denomWEIRDneutron) {
                        amount += +token.amount/1000000
                    }
                }
                if (amount >= minAmountWEIRD) {
                    if (indexedTx === null) indexedTx = await getIndexedTx(queryClient, tx.txId)
                    if (indexedTx.code === 0) {
                        
                        if (countMsgs === 0) {
                            const sender = decodedMsg.fromAddress
                            const toAddress = decodedMsg.toAddress
                            
                            const [
                                senderDaoDaoNick,
                                toAddressDaoDaoNick
                            ] = await Promise.all([
                                getDaoDaoNickname(sender),
                                getDaoDaoNickname(toAddress)
                            ]) 
                            telegramMsg = fmt(telegramMsg, '🪙  #Neutron #Send  📬\n',
                                'Address ', code(sender), senderDaoDaoNick, ' sent ', bold(amount.toString() + ' WEIRD'), ' to ', code(toAddress), toAddressDaoDaoNick, '\n'
                            )
                        } else {
                            const toAddress = decodedMsg.toAddress
                            const toAddressDaoDaoNick = await getDaoDaoNickname(toAddress)
                            
                            if (countMsgs > 1) telegramMsg.text = telegramMsg.text.replace(/...\n$/, '');
                            
                            telegramMsg = fmt(telegramMsg, '🪙  #Neutron #Send  📬\n',
                                'sent ', bold(amount.toString() + ' WEIRD'), ' to ', code(toAddress), toAddressDaoDaoNick, '\n',
                                '...\n'
                            )
                        }
                        countMsgs++
                    }
                }
            } else if (msg.typeUrl === MsgBurn.typeUrl) {
                // #Burn
            
                const decodedMsg = MsgBurn.decode(msg.value)
                if (decodedMsg.amount.denom !== denomWEIRDneutron) continue;
                const amount = Number(decodedMsg.amount.amount)/1e6
                if (amount < minAmountWEIRD) continue;

                if (indexedTx === null) indexedTx = await getIndexedTx(queryClient, tx.txId)
                if (indexedTx.code !== 0) continue;
                
                const sender = decodedMsg.sender
                const senderDaoDaoNick = await getDaoDaoNickname(sender)
                        
                telegramMsg = fmt(telegramMsg, '🪙  #Neutron #Burn  🔥\n', 
                    'Address ', code(sender), senderDaoDaoNick, ' burned ', bold(amount.toString() + ' WEIRD\n')
                )
                countMsgs++
            } else if (msg.typeUrl === MsgTransfer.typeUrl) {
                // #IBCtransfer
                
                const decodedMsg = MsgTransfer.decode(msg.value)
                if (
                    decodedMsg.token?.denom === denomWEIRDneutron
                ){
                    const sender = decodedMsg.sender
                    const receiver = getReceiverFromMemo(decodedMsg.memo) || decodedMsg.receiver
                    const amount = +decodedMsg.token.amount/1e6
                    if (amount >= minAmountWEIRD) {
                        if (indexedTx === null) indexedTx = await getIndexedTx(queryClient, tx.txId)
                        if (indexedTx.code === 0) {
                            
                            const packet_sequence = MsgTransferResponse
                                .decode(indexedTx.msgResponses[i].value)
                            .sequence

                            const [
                                senderDaoDaoNick,
                                receiverDaoDaoNick
                            ] = await Promise.all([
                                getDaoDaoNickname(sender),
                                getDaoDaoNickname(receiver),
                            ])
                
                            telegramMsg = fmt(telegramMsg, '🪙  #Neutron #IBCtransfer  📬\n',
                                'Address ', code(sender), senderDaoDaoNick, ' sent over IBC protocol ',
                                bold(amount.toString() + ' WEIRD'),
                                ' to ', code(receiver), receiverDaoDaoNick, '\n',
                                link('TX link', explorerTxNeutronURL + tx.txId)
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
            } else if (msg.typeUrl === MsgAcknowledgement.typeUrl) {
                // #IbcAcknowledgevent
            
                const decodedMsg = MsgAcknowledgement.decode(msg.value)
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
            } else if (msg.typeUrl === MsgExecuteContract.typeUrl) {
                // #Contracts
                
                const decodedMsg = MsgExecuteContract.decode(tx.msgs[i].value)
                if (decodedMsg.contract === contractDASstake) {
                    // #WEIRD_DAS
                    if (indexedTx === null) indexedTx = await getIndexedTx(queryClient, tx.txId)
                    if (indexedTx.code !== 0) continue
                    
                    const executeContractMsg = JSON.parse(new TextDecoder().decode(decodedMsg.msg))
                    if (executeContractMsg.stake) {
                        // #HOLD
                        
                        const amount = decodedMsg.funds.find(coin => coin.denom === denomWEIRDneutron)?.amount
                        if (!amount) continue;
                        const amountNum = Number(amount)/1e6
                        if (amountNum < minAmountWEIRD) continue;
                        
                        const sender = decodedMsg.sender
                        const senderDaoDaoNick = await getDaoDaoNickname(sender)
                        
                        telegramMsg = fmt(telegramMsg, '🪙  #WEIRD_DAS #HOLD  🔐\n', 
                            'Address ', code(sender), senderDaoDaoNick, 
                            ' just increased holdings in the DAS by ', 
                            bold(amountNum.toString() + ' WEIRD'), '\n'
                        )
                        countMsgs++
                    } else if (executeContractMsg.unstake) {
                        // #Unlock

                        const amount = +executeContractMsg.unstake.amount/1e6
                        if (amount < minAmountWEIRD) continue;

                        const sender = decodedMsg.sender
                        const senderDaoDaoNick = await getDaoDaoNickname(sender)
                        
                        const claimDuration = +(indexedTx.events.find((evnt) =>
                            evnt.type === 'wasm' &&
                            evnt.attributes.find((atr) =>
                                atr.key === 'claim_duration'
                            )
                        )?.attributes.find((atr) =>
                            atr.key === 'claim_duration'
                        )?.value.replace('time: ', '') || '-86400') / 86400

                        telegramMsg = fmt(telegramMsg, '🪙  #WEIRD_DAS #Unlock  🔓\n',
                            'Address ', code(sender), senderDaoDaoNick, ' requested unlock ',
                            bold(amount.toString() + ' WEIRD'), ' from DAS. Claim duration ',
                            claimDuration.toString(), ' days\n'
                        )
                        countMsgs++
                    } else if (executeContractMsg.claim) {
                        // #Withdraw

                        const amount = +(indexedTx.events.find((ev) =>
                            ev.type === 'wasm' &&
                            ev.attributes.find((atr) => atr.key === '_contract_address')?.value === contractDASstake
                        )?.attributes.find((atr) => atr.key === 'amount')?.value || '0')/1e6
                        if (amount < minAmountWEIRD) continue;

                        const sender = decodedMsg.sender
                        const senderDaoDaoNick = await getDaoDaoNickname(sender)

                        telegramMsg = fmt(telegramMsg, '🪙  #WEIRD_DAS #Withdraw  📬🪙📭\n', 
                            'Address ', code(sender), senderDaoDaoNick, ' withdraw from the DAS ', bold(amount.toString() + ' WEIRD'), '\n'
                        )
                        countMsgs++
                    }
                }
            }
        }
        
        if (countMsgs > 0) {
            telegramMsg = fmt(telegramMsg, link('TX link', explorerTxNeutronURL + tx.txId))
            if (tx.memo !== '') {
                telegramMsg = fmt(telegramMsg, '\n\n memo: ', tx.memo)
            }
            
            telegramMsgs.push(telegramMsg)
        }
    }
    return telegramMsgs
}
