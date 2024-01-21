import { IndexedTx, StargateClient } from '@cosmjs/stargate'

export async function getIndexedTx (queryClient: StargateClient, txHash: string): Promise<IndexedTx> {
    return await queryClient.getTx(txHash) || await getIndexedTx(queryClient, txHash)
}