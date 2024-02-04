import 'dotenv/config'
import { CosmWasmClient } from '@cosmjs/cosmwasm-stargate'
import { contractTestSubDaoGovernance } from './src/config.json'

const junoRpcEndpoint = process.env.RPC_ENDPOINT_JUNO || 'https://rpc.osmosis.zone'

app()
async function app() {
    const address = contractTestSubDaoGovernance
    const queryMsg = {proposal: {proposal_id: 29}}
    
    const junoQueryClient = await CosmWasmClient.connect(junoRpcEndpoint)
    const response = await junoQueryClient.queryContractSmart(address, queryMsg)
    
    console.log(response)
}