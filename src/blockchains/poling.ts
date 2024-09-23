import { StargateClient} from '@cosmjs/stargate'
import { ChainName } from './types'
import { getLastHeight, setLastHeight } from '../db/db'
import { decodeTxsInBlock} from './decodeTxs'
import { processTxsOsmosis } from './osmosis/processTXs'
import { TelegramBot } from '../telegram/telegram';
import { processTxsStargaze } from './stargaze/processTXs'
import { processTxsNeutron } from './neutron/processTXs'

const DEPLOYMENT = process.env.DEPLOYMENT
const sendMsg =  DEPLOYMENT === 'production'? 
    TelegramBot.sendMsgToChannel
: TelegramBot.sendServiceInformation

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
        
        const telegramMsgs = 
            chainName === 'Stargaze' ? await processTxsStargaze(decodedTxs, queryClient)
            : chainName === 'Neutron' ? await processTxsNeutron(decodedTxs, queryClient)
            : chainName === 'Osmosis' ? await processTxsOsmosis(decodedTxs, queryClient)
        : []
        
        for (const msg of telegramMsgs) {
            console.log(msg)
            await sendMsg(msg)
        }

        setLastHeight(chainName, height)
        start_polling(queryClient, chainName)
    } catch (err) {
        setTimeout(start_polling, 1 * 1000, queryClient, chainName)
        console.error(err)
    }
}