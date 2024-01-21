import 'dotenv/config'
import { StargateClient} from '@cosmjs/stargate'
import { decodeTxsInBlock } from './src/blockchains/juno/decodeTxs'
import { processTxsJuno } from './src/blockchains/juno/processTXs'
import { TelegramBot } from './src/telegram/telegram'

const heights = [
    13291465,
    13291470
]

const junoRpcEndpoint = process.env.RPC_ENDPOINT_JUNO || 'https://rpc.osmosis.zone'
const {
    sendServiceInformation,
} = TelegramBot

app()
async function app() {
    TelegramBot.run()
    
    const junoQueryClient = await StargateClient.connect(junoRpcEndpoint)
    
    for (const height of heights) {
        const block = await junoQueryClient.getBlock(height)
        const decodedTxs = await decodeTxsInBlock(block)

        const telegramMsgs = await processTxsJuno(decodedTxs, junoQueryClient)
        
        for (const msg of telegramMsgs) {
            await sendServiceInformation(msg)
            console.log(msg)
        }
    }    

    process.exit()
}