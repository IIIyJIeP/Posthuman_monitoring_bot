import 'dotenv/config'
import { StargateClient} from '@cosmjs/stargate'
import { decodeTxsInBlock } from './src/blockchains/osmosis/decodeTxs'
import { processTxsOsmosis } from './src/blockchains/osmosis/processTXs'
import { TelegramBot } from './src/telegram/telegram'

const heights = [
    13377647,
    
]

const {
    sendServiceInformation,
} = TelegramBot

const osmoRpcEndpoint = process.env.RPC_ENDPOINT_OSMO || 'https://rpc.osmosis.zone'

app()
async function app() {
    const osmoQueryClient = await StargateClient.connect(osmoRpcEndpoint)
    
    for (const height of heights) {
        const block = await osmoQueryClient.getBlock(height)
        const decodedTxs = decodeTxsInBlock(block)

        const telegramMsgs = await processTxsOsmosis(decodedTxs, osmoQueryClient)
        
        for (const msg of telegramMsgs) {
            await sendServiceInformation(msg)
            console.log(msg)
        }
    }

    process.exit()
}
