import 'dotenv/config'
import { FmtString } from 'telegraf/format'
import { IndexedTx, StargateClient} from '@cosmjs/stargate'
import { fmt, link, bold, code } from 'telegraf/format'
import { DecodedTX } from '../decodeTxs'
import { cosmwasm, ibc } from "juno-network"
import { minAmountRESPprod, minAmountRESPtest,
    explorerTxJunoURL, contractRESPJuno
} from '../../config.json'
import { getDaoDaoNickname } from '../daoDaoNames'
import { getIndexedTx } from '../getTx'

const DEPLOYMENT = process.env.DEPLOYMENT
const minAmountRESP = DEPLOYMENT === 'production'? minAmountRESPprod : minAmountRESPtest

export async function processTxsJuno (decodedTxs: DecodedTX[], queryClient: StargateClient) {
    const telegramMsgs: FmtString[] = []
    for (const tx of decodedTxs) {
        //console.log(tx)
        let telegramMsg = fmt``
        let countMsgs = 0
        let indexedTx: IndexedTx | null = null
        for (let i = 0; i < tx.msgs.length; i++) {
            // #Juno #MsgExecuteContract
            if (tx.msgs[i].typeUrl === '/cosmwasm.wasm.v1.MsgExecuteContract' && countMsgs < 10) {
                const msg = cosmwasm.wasm.v1.MsgExecuteContract.decode(tx.msgs[i].value)
                if (msg.contract === contractRESPJuno) { // #RESPcontract
                    const executeContractMsg = JSON.parse(new TextDecoder().decode(msg.msg))
                    if (executeContractMsg.transfer) { // #Send
                        const amount = +executeContractMsg.transfer.amount
                        if (amount >= minAmountRESP) {
                            if (indexedTx === null) indexedTx = await getIndexedTx(queryClient, tx.txId)
                            if (indexedTx.code === 0) {
                                const sender = msg.sender
                                const toAddress = executeContractMsg.transfer.recipient as string
                                
                                if (countMsgs === 0) {
                                    const [
                                        senderDaoDaoNick,
                                        toAddressDaoDaoNick
                                    ] = await Promise.all([
                                        getDaoDaoNickname(sender),
                                        getDaoDaoNickname(toAddress)
                                    ]) 
                                    
                                    telegramMsg = fmt(telegramMsg, '🤝  #Send  📬\n', 
                                        'Address ', code(sender), senderDaoDaoNick, ' sent ', bold(amount.toString() + ' RESP'), ' to ', code(toAddress), toAddressDaoDaoNick, '\n'
                                    )
                                } else {
                                    const toAddressDaoDaoNick = await getDaoDaoNickname(toAddress)
                            
                                    if (countMsgs > 1) telegramMsg.text = telegramMsg.text.replace(/...\n$/, '')
                                    telegramMsg = fmt(telegramMsg, '🤝  #Send  📬\n', 
                                        'sent ', bold(amount.toString() + ' RESP'), ' to ', code(toAddress), toAddressDaoDaoNick, '\n',
                                        '...\n'
                                    )
                                }
                                countMsgs++
                            }
                        }
                    } else if ( // #Mint
                        executeContractMsg.mint &&
                        +executeContractMsg.mint.amount >= minAmountRESP
                    ) {
                        if (indexedTx === null) indexedTx = await getIndexedTx(queryClient, tx.txId)
                        if (indexedTx.code === 0) {
                            const amount = +executeContractMsg.mint.amount
                            
                            const sender = msg.sender
                            const senderDaoDaoNick = await getDaoDaoNickname(sender)

                            telegramMsg = fmt(telegramMsg, '🤝  #Mint  🪙\n', 
                                'Address ', code(sender), senderDaoDaoNick, ' minted ', 
                                bold(amount.toString() + ' RESP'), '\n'
                            )
                            countMsgs++
                        }
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
