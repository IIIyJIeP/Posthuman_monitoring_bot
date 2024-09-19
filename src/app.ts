import 'dotenv/config'
import { StargateClient} from '@cosmjs/stargate'
import { start_polling } from './blockchains/poling';
import { TelegramBot } from './telegram/telegram';

const osmoRpcEndpoint = process.env.RPC_ENDPOINT_OSMO || 'https://rpc.osmosis.zone'

export async function app() {
    try {
        TelegramBot.run()

        const osmoQueryClient = await StargateClient.connect(osmoRpcEndpoint)
        
        start_polling(osmoQueryClient, 'Osmosis')
    } catch (err) {
        console.error(err)
        setTimeout(app, 1000)
    }
}

