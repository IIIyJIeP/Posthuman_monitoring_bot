import 'dotenv/config'
import { FmtString } from 'telegraf/format'
import { IndexedTx, StargateClient, } from '@cosmjs/stargate'
import { fmt, link, bold, code } from 'telegraf/format'
import { DecodedTX } from '../decodeTxs'

import { MsgSend } from '@neutron-org/neutronjs/cosmos/bank/v1beta1/tx'
import { MsgTransfer, MsgTransferResponse } from '@neutron-org/neutronjs/ibc/applications/transfer/v1/tx'
import { MsgAcknowledgement } from '@neutron-org/neutronjs/ibc/core/channel/v1/tx'
import { MsgExecuteContract } from '@neutron-org/neutronjs/cosmwasm/wasm/v1/tx'

import {
    minAmountPHMN as minAmountPHMNprod, minAmountPHMNtest,
    denomPHMNneutron, explorerTxNeutronURL, contractPhmnPoolNeutron,
    denomUSDCneutron
} from '../../config.json'
import { getDaoDaoNickname } from '../daoDaoNames'
import { getIndexedTx } from '../getTx'
import { getReceiverFromMemo } from '../../utils/memojson'

const DEPLOYMENT = process.env.DEPLOYMENT
const minAmountPHMN = DEPLOYMENT === 'production' ? minAmountPHMNprod : minAmountPHMNtest

let ibcMsgsBuffer: {
    packet_sequence: bigint,
    telegramMsg: FmtString
}[] = []
function deleteIbcTx(sequence: bigint) {
    ibcMsgsBuffer = ibcMsgsBuffer.filter((msg) => msg.packet_sequence !== sequence)
}

export async function processTxsNeutron(decodedTxs: DecodedTX[], queryClient: StargateClient) {
    const telegramMsgs: FmtString[] = []
    for (const tx of decodedTxs) {
        let telegramMsg = fmt``
        let countMsgs = 0
        let indexedTx: IndexedTx | null = null

        for (let i = 0; i < tx.msgs.length; i++) {
            if (countMsgs > 19) continue;
            const msg = tx.msgs[i]

            if (msg.typeUrl === MsgSend.typeUrl) { // Send
                const decodedMsg = MsgSend.decode(msg.value)
                let amount = 0
                for (const token of decodedMsg.amount) {
                    if (token.denom === denomPHMNneutron) {
                        amount += +token.amount / 1000000
                    }
                }
                if (amount >= minAmountPHMN) {
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
                            telegramMsg = fmt(telegramMsg, '🐳  #Neutron #Send  📬\n',
                                'Address ', code(sender), senderDaoDaoNick, ' sent ', bold(amount.toString() + ' PHMN'), ' to ', code(toAddress), toAddressDaoDaoNick, '\n'
                            )
                        } else {
                            const toAddress = decodedMsg.toAddress
                            const toAddressDaoDaoNick = await getDaoDaoNickname(toAddress)

                            if (countMsgs > 1) telegramMsg.text = telegramMsg.text.replace(/...\n$/, '');

                            telegramMsg = fmt(telegramMsg, '🐳  #Neutron #Send  📬\n',
                                'sent ', bold(amount.toString() + ' PHMN'), ' to ', code(toAddress), toAddressDaoDaoNick, '\n',
                                '...\n'
                            )
                        }
                        countMsgs++
                    }
                }
            } else if (msg.typeUrl === MsgTransfer.typeUrl) { // #IBCtransfer
                const decodedMsg = MsgTransfer.decode(msg.value)
                if (
                    decodedMsg.token?.denom === denomPHMNneutron
                ) {
                    const sender = decodedMsg.sender
                    const receiver = getReceiverFromMemo(decodedMsg.memo) || decodedMsg.receiver
                    const amount = +decodedMsg.token.amount / 1e6
                    if (amount >= minAmountPHMN) {
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

                            telegramMsg = fmt(telegramMsg, '🐳  #Neutron #IBCtransfer  📬\n',
                                'Address ', code(sender), senderDaoDaoNick, ' sent over IBC protocol ',
                                bold(amount.toString() + ' PHMN'),
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
                            setTimeout(deleteIbcTx, 1800 * 1000, packet_sequence)
                        }
                    }
                }
            } else if (msg.typeUrl === MsgAcknowledgement.typeUrl) { // #IbcAcknowledgevent
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
            } else if (msg.typeUrl === MsgExecuteContract.typeUrl) { // #Contracts
                // #Contracts
                const decodedMsg = MsgExecuteContract.decode(tx.msgs[i].value)
                if (decodedMsg.contract === contractPhmnPoolNeutron) { // PHMN_pool

                    // PHMN_pool
                    if (indexedTx === null) indexedTx = await getIndexedTx(queryClient, tx.txId)
                    if (indexedTx.code !== 0) continue

                    const executeContractMsg = JSON.parse(new TextDecoder().decode(decodedMsg.msg))
                    if (executeContractMsg.swap) { // #Swap

                        // #Swap
                        const sellPhmnCoin = decodedMsg.funds.find(coin => coin.denom === denomPHMNneutron)
                        if (sellPhmnCoin) { // #Sell

                            // #Sell
                            const amount = Number(sellPhmnCoin.amount) / 1e6
                            if (amount < minAmountPHMN) continue;

                            const sender = decodedMsg.sender
                            const senderDaoDaoNick = await getDaoDaoNickname(sender)

                            telegramMsg = fmt(telegramMsg, '🐳  #Neutron #Swap #Sell  🪙📤💸\n',
                                'Address ', code(sender), senderDaoDaoNick, ' sold ', bold(amount.toString() + ' PHMN'), '\n'
                            )
                            countMsgs++

                        } else if (executeContractMsg.swap.offer_asset?.info?.native_token?.denom === denomUSDCneutron) { // #Buy

                            // #Buy
                            const event = indexedTx.events.find(
                                event => event.type === 'wasm' &&
                                    event.attributes.find(attr => attr.key === 'ask_asset')?.value === denomPHMNneutron
                            )
                            if (!event) continue;

                            const amount = Number(event.attributes.find(attr => attr.key === 'return_amount')?.value) / 1e6
                            if (amount < minAmountPHMN) continue;

                            const sender = decodedMsg.sender
                            const senderDaoDaoNick = await getDaoDaoNickname(sender)

                            telegramMsg = fmt(telegramMsg, '🐳  #Neutron #Swap #Buy  💸📥🪙\n',
                                'Address ', code(sender), senderDaoDaoNick, ' bought ', bold(amount.toString() + ' PHMN'), '\n'
                            )
                            countMsgs++
                        }
                    } else if (false) { // TODO: add/remove liquidity

                    }
                } else { // Other contracts
                    const contractMsg = JSON.parse(new TextDecoder().decode(decodedMsg.msg)) as {
                        swap_and_action?: {
                            affiliates?: [],
                            min_asset?: {
                                native?: {
                                    amount: string,
                                    denom: string
                                }
                            },
                            post_swap_action?: {
                                ibc_transfer?: {
                                    ibc_info?: {
                                        memo?: string,
                                        receiver?: string,
                                        recover_address?: string,
                                        source_channel?: string
                                    }
                                }
                            },
                            user_swap?: {
                                swap_exact_asset_in?: {
                                    operations?: [],
                                    swap_venue_name?: string
                                }
                            },
                            timeout_timestamp?: number
                        }
                    }

                    if (!contractMsg.swap_and_action) continue;
                    // #Astroport
                    const phmnInFunds = decodedMsg.funds.find(coin => coin.denom === denomPHMNneutron)

                    if (phmnInFunds) { // #Sell

                        // #Sell
                        const amount = +phmnInFunds.amount / 1e6
                        if (amount < minAmountPHMN) continue;
                        if (indexedTx === null) indexedTx = await getIndexedTx(queryClient, tx.txId)
                        if (indexedTx.code !== 0) continue;
                        const sender = decodedMsg.sender
                        const nickNameDAODAO = await getDaoDaoNickname(sender)

                        telegramMsg = fmt(telegramMsg, '🐳 #Neutron #Astroport #Swap #Sell  🪙📤💸\n',
                            'Address ', code(sender), nickNameDAODAO, ' sold ', bold(amount.toString() + ' PHMN'), '\n'
                        )

                        countMsgs++

                    } else if (contractMsg.swap_and_action?.min_asset?.native?.denom === denomPHMNneutron) { // #Buy

                        // #Buy
                        if (indexedTx === null) indexedTx = await getIndexedTx(queryClient, tx.txId)
                        if (indexedTx.code !== 0) continue;
                        const amount = +(indexedTx.events.find(
                            ev => ev.type === 'token_swapped' && ev.attributes.find(
                                attr => attr.key === 'tokens_out'
                            )?.value.includes(denomPHMNneutron)
                        )?.attributes.find(
                            attr => attr.key === 'tokens_out'
                        )?.value.replace(denomPHMNneutron, '') || '0') / 1e6
                        if (amount < minAmountPHMN) continue;

                        const sender = decodedMsg.sender
                        const nickNameDAODAO = await getDaoDaoNickname(sender)

                        telegramMsg = fmt(telegramMsg, '🐳 #Neutron #Astroport #Swap #Buy  💸📥🪙\n',
                            'Address ', code(sender), nickNameDAODAO, ' bought ', bold(amount.toString() + ' PHMN'), '\n'
                        )
                        countMsgs++

                        // #IBCtransfer
                        const ibcInfo = contractMsg.swap_and_action.post_swap_action?.ibc_transfer?.ibc_info
                        if (!ibcInfo) continue;
                        const receiver = getReceiverFromMemo(ibcInfo.memo || "") || ibcInfo.receiver
                        if (!receiver) continue;
                        const receiverDaoDaoNick = await getDaoDaoNickname(receiver)
                        telegramMsg = fmt(telegramMsg, '🐳 #IBCtransfer  📬\n',
                            '& sent over IBC protocol to ', code(receiver), receiverDaoDaoNick, '\n',
                        )
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