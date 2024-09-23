import 'dotenv/config'
import { StargateClient} from '@cosmjs/stargate'
import { start_polling } from './blockchains/poling';
import { TelegramBot } from './telegram/telegram';

const osmoRpcEndpoint = process.env.RPC_ENDPOINT_OSMO || 'https://rpc.osmosis.zone'
const starsRpcEndpoint = process.env.RPC_ENDPOINT_STARS || 'https://rpc.cosmos.directory/stargaze'
const neutronRpcEndpoint = process.env.RPC_ENDPOINT_NEUTRON || 'https://rpc.cosmos.directory/neutron'

export async function app() {
    try {
        TelegramBot.run()

        const osmoQueryClient = await StargateClient.connect(osmoRpcEndpoint)
        const starsQueryClient = await StargateClient.connect(starsRpcEndpoint)
        const neutronQueryClient = await StargateClient.connect(neutronRpcEndpoint)
        
        start_polling(osmoQueryClient, 'Osmosis')
        start_polling(starsQueryClient, 'Stargaze')
        start_polling(neutronQueryClient, 'Neutron')
    } catch (err) {
        console.error(err)
        setTimeout(app, 1000)
    }
}

