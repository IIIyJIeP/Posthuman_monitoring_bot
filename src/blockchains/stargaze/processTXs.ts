import 'dotenv/config'
import { FmtString } from 'telegraf/format'
import { IndexedTx, StargateClient } from '@cosmjs/stargate'
import { fmt, link, bold, code } from 'telegraf/format'
import { DecodedTX } from '../decodeTxs'
import { cosmwasm, ibc, cosmos } from "stargazejs"
import { minAmountWEIRD as minAmountWEIRDprod, minAmountWEIRDtest,
    denomWEIRDstargaze, explorerTxStargazeURL, stargazeBurnAddress,
    stakingRewardsStargazeContract,
} from '../../config.json'
import { getDaoDaoNickname } from '../daoDaoNames'
import { getIndexedTx } from '../getTx'
import { getReceiverFromMemo } from '../../utils/memojson'

const DEPLOYMENT = process.env.DEPLOYMENT
const minAmountWEIRD = DEPLOYMENT === 'production'? minAmountWEIRDprod : minAmountWEIRDtest

let ibcMsgsBuffer: {
    packet_sequence: Long,
    telegramMsg: FmtString
}[] = []
function deleteIbcTx (sequence: Long) {
    ibcMsgsBuffer = ibcMsgsBuffer.filter((msg) => msg.packet_sequence !== sequence)
}

export async function processTxsStargaze (decodedTxs: DecodedTX[], queryClient: StargateClient) {
    const telegramMsgs: FmtString[] = []
    for (const tx of decodedTxs) {
        let telegramMsg = fmt``
        let countMsgs = 0
        let indexedTx: IndexedTx | null = null
        
        for (let i = 0; i < tx.msgs.length; i++) {
            const msg = tx.msgs[i]
            if (msg.typeUrl === '/cosmos.bank.v1beta1.MsgSend') {
                // #Send
            
                const decodedMsg = cosmos.bank.v1beta1.MsgSend.decode(msg.value)
                let amount = 0
                for (const token of decodedMsg.amount) {
                    if (token.denom === denomWEIRDstargaze) {
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
                            if(toAddress === stargazeBurnAddress) {
                                telegramMsg = fmt(telegramMsg, '🪙  #Stargaze #Burn  🔥\n', 
                                    'Address ', code(sender), senderDaoDaoNick, ' burned ', bold(amount.toString() + ' WEIRD\n')
                                )
                            } else {
                                telegramMsg = fmt(telegramMsg, '🪙  #Stargaze #Send  📬\n', 
                                    'Address ', code(sender), senderDaoDaoNick, ' sent ', bold(amount.toString() + ' WEIRD'), ' to ', code(toAddress), toAddressDaoDaoNick, '\n'
                                )
                            }
                        } else {
                            const toAddress = decodedMsg.toAddress
                            const toAddressDaoDaoNick = await getDaoDaoNickname(toAddress)
                            
                            if (countMsgs > 1) telegramMsg.text = telegramMsg.text.replace(/...\n$/, '');
                            
                            if(toAddress === stargazeBurnAddress) {
                                telegramMsg = fmt(telegramMsg, '🪙  #Stargaze #Burn  🔥\n', 
                                    'burned ', bold(amount.toString() + ' WEIRD\n'),
                                    '...\n'
                                )
                            } else {
                                telegramMsg = fmt(telegramMsg, '🪙  #Stargaze #Send  📬\n', 
                                    'sent ', bold(amount.toString() + ' WEIRD'), ' to ', code(toAddress), toAddressDaoDaoNick, '\n',
                                    '...\n'
                                )
                            }
                        }
                        countMsgs++
                    }
                }
            } else if (msg.typeUrl === '/ibc.applications.transfer.v1.MsgTransfer') {
                // #IBCtransfer
                
                const decodedMsg = ibc.applications.transfer.v1.MsgTransfer.decode(msg.value)
                if (
                    decodedMsg.token?.denom === denomWEIRDstargaze
                ){
                    const sender = decodedMsg.sender
                    // TODO fix type issues
                    // @ts-ignore
                    const receiver = getReceiverFromMemo(decodedMsg.memo) || decodedMsg.receiver
                    const amount = +decodedMsg.token.amount/1e6
                    if (amount >= minAmountWEIRD) {
                        if (indexedTx === null) indexedTx = await getIndexedTx(queryClient, tx.txId)
                        if (indexedTx.code === 0) {
                            
                            const packet_sequence = ibc.applications.transfer.v1.MsgTransferResponse
                                .decode(indexedTx.msgResponses[i].value)
                            // TODO fix type issues
                            // @ts-ignore
                            .sequence

                            const [
                                senderDaoDaoNick,
                                receiverDaoDaoNick
                            ] = await Promise.all([
                                getDaoDaoNickname(sender),
                                getDaoDaoNickname(receiver),
                            ])
                
                            telegramMsg = fmt(telegramMsg, '🪙  #Stargaze #IBCtransfer  📬\n',
                                'Address ', code(sender), senderDaoDaoNick, ' sent over IBC protocol ',
                                bold(amount.toString() + ' WEIRD'),
                                ' to ', code(receiver), receiverDaoDaoNick, '\n',
                                link('TX link', explorerTxStargazeURL + tx.txId)
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
            } else if (msg.typeUrl === '/ibc.core.channel.v1.MsgAcknowledgement') {
                // #IbcAcknowledgevent
            
                const decodedMsg = ibc.core.channel.v1.MsgAcknowledgement.decode(msg.value)
                const paccketSequence = decodedMsg.packet!.sequence
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
            } else if (msg.typeUrl === '/cosmwasm.wasm.v1.MsgExecuteContract') {
                // #Claim_NFT_staking_rewards
                
                const decodedMsg = cosmwasm.wasm.v1.MsgExecuteContract.decode(tx.msgs[i].value)
                if (decodedMsg.contract !== stakingRewardsStargazeContract) continue;
                
                const executeContractMsg = JSON.parse(new TextDecoder().decode(decodedMsg.msg))
                if (!executeContractMsg.claim_staking_rewards) continue;
                
                if (indexedTx === null) indexedTx = await getIndexedTx(queryClient, tx.txId);
                if (indexedTx.code !== 0) continue;
                
                const transfer = indexedTx.events.find(evnt => 
                    evnt.type === 'transfer' && evnt.attributes.find(attr => attr.key === 'amount')?.value.includes(denomWEIRDstargaze)
                )?.attributes.find(attr => attr.key === 'amount')
                ?.value.replace(denomWEIRDstargaze, '')
                if (!transfer) continue;
                
                const amount = Number(transfer)/1e6
                if (amount < minAmountWEIRD) continue;

                const sender = decodedMsg.sender
                const senderDaoDaoNick = await getDaoDaoNickname(sender)
                telegramMsg = fmt(telegramMsg, '🪙  #Stargaze #Claim_NFT_staking_rewards  🖼\n', 
                    'Address ', code(sender), senderDaoDaoNick, ' has claimed NFT-staking rewards ', 
                    bold(amount.toString() + ' WEIRD\n')
                )
                countMsgs++
            }
        }
        
        if (countMsgs > 0) {
            telegramMsg = fmt(telegramMsg, link('TX link', explorerTxStargazeURL + tx.txId))
            if (tx.memo !== '') {
                telegramMsg = fmt(telegramMsg, '\n\n memo: ', tx.memo)
            }
            
            telegramMsgs.push(telegramMsg)
        }
    }
    return telegramMsgs
}
