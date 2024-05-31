import { StargateClient} from '@cosmjs/stargate'
import { getLastHeight, setLastHeight } from '../db/db'
import { decodeTxsInBlock} from './decodeTxs'
import { processTxsJuno } from './juno/processTXs'
import { TelegramBot } from '../telegram/telegram';

const {
    sendMsgRespChannel: sendMsgWhalesChannel,
} = TelegramBot

export async function start_polling(queryClient: StargateClient) {
    try {
        let height = getLastHeight()
        const currentHeight = await queryClient.getHeight()
        if (height === 0) height = currentHeight - 1
        
        if (currentHeight > height) {
            height++
            console.log(new Date(Date.now()).toLocaleString('ru'), 'Height:', height)
        } else {
            setTimeout(start_polling, 1000, queryClient)
            return
        }

        const block = await queryClient.getBlock(height)
        const decodedTxs = decodeTxsInBlock(block)
        
        const telegramMsgs = await processTxsJuno(decodedTxs, queryClient)
        
        for (const msg of telegramMsgs) {
            console.log(msg)
            await sendMsgWhalesChannel(msg)
        }

        setLastHeight(height)
        start_polling(queryClient)
    } catch (err) {
        setTimeout(start_polling, 1 * 1000, queryClient)
        console.error(err)
    }
}