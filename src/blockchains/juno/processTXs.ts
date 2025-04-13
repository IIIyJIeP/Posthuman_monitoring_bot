import 'dotenv/config'
import { FmtString } from 'telegraf/format'
import { IndexedTx, StargateClient, } from '@cosmjs/stargate'
import { fmt, link, bold, code } from 'telegraf/format'
import { DecodedTX } from '../decodeTxs'

import { MsgExecuteContract } from '@neutron-org/neutronjs/cosmwasm/wasm/v1/tx'
import { MsgBurn } from '@neutron-org/neutronjs/osmosis/tokenfactory/v1beta1/tx'

import {
    minAmountWEIRD as minAmountWEIRDprod, minAmountWEIRDtest,
    denomWEIRDneutron, explorerTxJunoURL, contractWFDAOgov, contractWeirdDAS
} from '../../config.json'
import { getDaoDaoNickname } from '../daoDaoNames'
import { getIndexedTx } from '../getTx'

const DEPLOYMENT = process.env.DEPLOYMENT
const minAmountWEIRD = DEPLOYMENT === 'production' ? minAmountWEIRDprod : minAmountWEIRDtest

export async function processTxsJuno(decodedTxs: DecodedTX[], queryClient: StargateClient) {
    const telegramMsgs: FmtString[] = []
    for (const tx of decodedTxs) {
        let telegramMsg = fmt``
        let countMsgs = 0
        let indexedTx: IndexedTx | null = null

        for (let i = 0; i < tx.msgs.length; i++) {
            if (countMsgs > 19) continue;
            const msg = tx.msgs[i]
            if (msg.typeUrl === MsgExecuteContract.typeUrl) {
                // #Contracts
                const decodedMsg = MsgExecuteContract.decode(tx.msgs[i].value)
                if (decodedMsg.contract === contractWFDAOgov) {
                    // #Weird_Friends_DAO
                    if (indexedTx === null) indexedTx = await getIndexedTx(queryClient, tx.txId)
                    if (indexedTx.code !== 0) continue

                    const executeContractMsg = JSON.parse(new TextDecoder().decode(decodedMsg.msg))
                    if (executeContractMsg.execute) {
                        // #EXECUTE
                        const packetDataRaw = indexedTx.events.find((ev) =>
                            ev.type === 'send_packet'
                        )?.attributes.find((atr) =>
                            atr.key === 'packet_data'
                        )?.value
                        if (!packetDataRaw) continue;
                        const packetData = JSON.parse(packetDataRaw)
                        const packetMsgs: any[] | undefined = packetData.msg?.execute?.msgs
                        if (!packetMsgs) continue;
                        const msgToWeirdDASb64: string | undefined = packetMsgs.find((msg) =>
                            msg.wasm?.execute?.contract_addr === contractWeirdDAS
                        ).wasm?.execute?.msg
                        if (!msgToWeirdDASb64) continue;
                        const msgToWeirdDAS = JSON.parse(Buffer.from(msgToWeirdDASb64, 'base64').toString('utf-8'))
                        const stargateMsgs: any[] | undefined = msgToWeirdDAS?.execute_admin_msgs?.msgs
                        if (!stargateMsgs) continue;
                        const msgBurnB64: string | undefined = stargateMsgs.find((msg) =>
                            msg.stargate?.type_url === MsgBurn.typeUrl
                        ).stargate.value
                        if (!msgBurnB64) continue;
                        const msgBurnUint8Arr: Uint8Array = Uint8Array.from(Buffer.from(msgBurnB64, 'base64'))
                        
                        // #Burn
                        const decodedMsg = MsgBurn.decode(msgBurnUint8Arr)
                        if (decodedMsg.amount.denom !== denomWEIRDneutron) continue;
                        const amount = Number(decodedMsg.amount.amount) / 1e6
                        if (amount < minAmountWEIRD) continue;

                        const sender = decodedMsg.sender
                        const senderDaoDaoNick = await getDaoDaoNickname(sender)

                        telegramMsg = fmt(telegramMsg, '🪙 #Juno #Weird_Friends_DAO #Admin_Execute #Weird_DAS #Burn  🔥\n',
                            'Address ', code(sender), senderDaoDaoNick, ' burned ', bold(amount.toString() + ' WEIRD\n')
                        )
                        countMsgs++
                    }
                }
            } 
        }

        if (countMsgs > 0) {
            telegramMsg = fmt(telegramMsg, link('TX link', explorerTxJunoURL + tx.txId))
            if (tx.memo !== '') {
                telegramMsg = fmt(telegramMsg, '\n\n memo: ', tx.memo)
            }

            telegramMsgs.push(telegramMsg)
        }
    }
    return telegramMsgs
}
