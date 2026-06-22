import 'dotenv/config'
import { StargateClient} from '@cosmjs/stargate'
import { start_polling } from './blockchains/poling';
import { TelegramBot } from './telegram/telegram';

const osmoRpcEndpoint = process.env.RPC_ENDPOINT_OSMO || 'https://rpc.osmosis.zone'
const junoRpcEndpoint = process.env.RPC_ENDPOINT_JUNO || 'https://rpc-juno.ecostake.com'
const neutronRpcEndpoint = process.env.RPC_ENDPOINT_NEUTRON || 'https://rpc.cosmos.directory/neutron'
const cosmoshubRpcEndpoint = process.env.RPC_ENDPOINT_COSMOS || 'https://rpc.cosmos.directory/cosmoshub'

export async function app() {
    try {
        TelegramBot.run()

        // const osmoQueryClient = await StargateClient.connect(osmoRpcEndpoint)
        // const junoQueryClient = await StargateClient.connect(junoRpcEndpoint)
        // const neutronQueryClient = await StargateClient.connect(neutronRpcEndpoint)
        const cosmoshubQueryClient = await StargateClient.connect(cosmoshubRpcEndpoint)

        // start_polling(osmoQueryClient, 'Osmosis')
        // start_polling(junoQueryClient, 'Juno')
        // start_polling(neutronQueryClient, 'Neutron')
        start_polling(cosmoshubQueryClient, 'CosmosHub')
        
    } catch (err) {
        console.error(err)
        setTimeout(app, 1000)
    }
}

