import 'dotenv/config'
import { StargateClient} from '@cosmjs/stargate'
import { start_polling } from './blockchains/poling';

const osmoRpcEndpoint = process.env.RPC_ENDPOINT_OSMO || 'https://rpc.osmosis.zone'
const junoRpcEndpoint = process.env.RPC_ENDPOINT_JUNO || 'https://rpc-juno.ecostake.com'


export async function app() {
    try {
        const osmoQueryClient = await StargateClient.connect(osmoRpcEndpoint)
        const junoQueryClient = await StargateClient.connect(junoRpcEndpoint)
        
        start_polling(osmoQueryClient, 'Osmosis')
        start_polling(junoQueryClient, 'Juno')
    } catch (err) {
        console.error(err)
        setTimeout(app, 1000)
    }
}

