import 'dotenv/config'
import { StargateClient} from '@cosmjs/stargate'
import { start_polling } from './blockchains/poling';
import { TelegramBot } from './telegram/telegram';

const junoRpcEndpoint = process.env.RPC_ENDPOINT_JUNO || 'https://rpc-juno.ecostake.com'

export async function app() {
    try {
        TelegramBot.run()

        const junoQueryClient = await StargateClient.connect(junoRpcEndpoint)
        start_polling(junoQueryClient)
    } catch (err) {
        console.error(err)
        setTimeout(app, 1000)
    }
}

