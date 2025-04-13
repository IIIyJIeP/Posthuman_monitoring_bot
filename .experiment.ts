import { StargateClient} from '@cosmjs/stargate'
import { decodeTxsInBlock } from './src/blockchains/decodeTxs'
import { processTxsJuno } from './src/blockchains/juno/processTXs'
import { TelegramBot } from './src/telegram/telegram'

const heights = [
    25334751,
    
]

const {
    sendServiceInformation,
} = TelegramBot

const rpcEndpoint = process.env.RPC_ENDPOINT_JUNO || 'https://rpc.cosmos.directory/juno'
console.log(rpcEndpoint)

app()
async function app() {
    const queryClient = await StargateClient.connect(rpcEndpoint)
    
    for (const height of heights) {
        const block = await queryClient.getBlock(height)
        const decodedTxs = decodeTxsInBlock(block)

        const telegramMsgs = await processTxsJuno(decodedTxs, queryClient)
        
        for (const msg of telegramMsgs) {
            await sendServiceInformation(msg)
            console.log(msg)
        }
    }

    process.exit()
}
