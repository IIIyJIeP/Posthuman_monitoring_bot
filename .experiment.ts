import { StargateClient} from '@cosmjs/stargate'
import { decodeTxsInBlock } from './src/blockchains/decodeTxs'
import { processTxsNeutron } from './src/blockchains/neutron/processTXs'
import { TelegramBot } from './src/telegram/telegram'

const heights = [
    12736955,
    
]

const {
    sendServiceInformation,
} = TelegramBot

const rpcEndpoint = 'https://rpc.cosmos.directory/neutron'

app()
async function app() {
    const queryClient = await StargateClient.connect(rpcEndpoint)
    
    for (const height of heights) {
        const block = await queryClient.getBlock(height)
        const decodedTxs = decodeTxsInBlock(block)

        const telegramMsgs = await processTxsNeutron(decodedTxs, queryClient)
        
        for (const msg of telegramMsgs) {
            await sendServiceInformation(msg)
            console.log(msg)
        }
    }

    process.exit()
}
