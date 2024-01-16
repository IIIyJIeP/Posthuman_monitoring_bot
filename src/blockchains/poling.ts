import { StargateClient} from '@cosmjs/stargate'
import { ChainName } from './types'
import { getLastHeight, setLastHeight } from '../db/db'
import { decodeTxsInBlock as decodeTxsOsmosis} from './osmosis/processTxs'
import { decodeTxsInBlock as decodeTxsJuno} from './juno/processTxs'

export async function start_polling(queryClient: StargateClient, chainName: ChainName) {
    try {
        let height = getLastHeight(chainName)
        const currentHeight = await queryClient.getHeight()
        if (height === 0) height = currentHeight - 10
        
        if (currentHeight > height) {
            height++
            console.log(new Date(Date.now()).toLocaleString('ru'), 'Height ' + chainName + ': ', height)
        } else {
            setTimeout(start_polling, 1000, queryClient, chainName)
            return
        }

        const block = await queryClient.getBlock(height)
        const decodedTxs = chainName === 'Juno' ? 
            await decodeTxsJuno(block)
        :await decodeTxsOsmosis(block)
        
        console.log(decodedTxs)
        
        setLastHeight(chainName, height)
        start_polling(queryClient, chainName)
    } catch (err) {
        setTimeout(start_polling, 1 * 1000, queryClient, chainName)
        console.error(err)
    }
}