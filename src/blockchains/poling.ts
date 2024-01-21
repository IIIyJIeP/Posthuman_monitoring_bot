import { StargateClient} from '@cosmjs/stargate'
import { ChainName } from './types'
import { getLastHeight, setLastHeight } from '../db/db'
import { decodeTxsInBlock} from './decodeTxs'
import { processTxsOsmosis } from './osmosis/processTXs'
import { processTxsJuno } from './juno/processTXs'
import { TelegramBot } from '../telegram/telegram';

const {
    sendMsgWhalesChannel,
} = TelegramBot

export async function start_polling(queryClient: StargateClient, chainName: ChainName) {
    try {
        let height = getLastHeight(chainName)
        const currentHeight = await queryClient.getHeight()
        if (height === 0) height = currentHeight - 1
        
        if (currentHeight > height) {
            height++
            console.log(new Date(Date.now()).toLocaleString('ru'), 'Height ' + chainName + ': ', height)
        } else {
            setTimeout(start_polling, 1000, queryClient, chainName)
            return
        }

        const block = await queryClient.getBlock(height)
        const decodedTxs = decodeTxsInBlock(block)
        
        const telegramMsgs = chainName === 'Juno' ? 
            await processTxsJuno(decodedTxs, queryClient)
        : await processTxsOsmosis(decodedTxs, queryClient)
        
        for (const msg of telegramMsgs) {
            console.log(msg)
            await sendMsgWhalesChannel(msg)
        }

        setLastHeight(chainName, height)
        start_polling(queryClient, chainName)
    } catch (err) {
        setTimeout(start_polling, 1 * 1000, queryClient, chainName)
        console.error(err)
    }
}