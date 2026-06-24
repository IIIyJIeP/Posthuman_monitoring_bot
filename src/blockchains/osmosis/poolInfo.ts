import { StargateClient } from '@cosmjs/stargate'
import { osmosis } from 'osmojs'
import { QueryDenomMetadataRequest, QueryDenomMetadataResponse } from 'osmojs/dist/codegen/cosmos/bank/v1beta1/query'
import type { DenomUnit } from 'osmojs/dist/codegen/cosmos/bank/v1beta1/bank'
import { denomPHMNosmosis } from '../../config.json'

export async function getPoolInfo (poolId: bigint, queryClient: StargateClient) {
    const qc = (queryClient as any).forceGetQueryClient()

    const poolResult = await qc.queryAbci(
        '/osmosis.gamm.v1beta1.Query/Pool',
        osmosis.gamm.v1beta1.QueryPoolRequest.encode({ poolId }).finish(),
        undefined
    )
    const { pool } = osmosis.gamm.v1beta1.QueryPoolResponse.decode(poolResult.value)
    if (!pool) return undefined

    const phmn = pool.poolAssets.find(a => a.token.denom === denomPHMNosmosis)
    if (!phmn) return undefined

    const secondAsset = pool.poolAssets.find(a => a.token.denom !== denomPHMNosmosis)
    if (!secondAsset) return undefined

    const secondTokenBaseDenom = secondAsset.token.denom

    const metaResult = await qc.queryAbci(
        '/cosmos.bank.v1beta1.Query/DenomMetadata',
        QueryDenomMetadataRequest.encode({ denom: secondTokenBaseDenom }).finish(),
        undefined
    )
    const { metadata } = QueryDenomMetadataResponse.decode(metaResult.value)
    const displayUnit = metadata?.denomUnits.find((u: DenomUnit) => u.denom === metadata.display)
    const secondTokenMultiplier = displayUnit ? Math.pow(10, displayUnit.exponent) : 1
    const secondTokenDenom = metadata?.symbol || metadata?.display || secondTokenBaseDenom

    return {
        poolId,
        secondTokenBaseDenom,
        secondTokenDenom,
        secondTokenMultiplier
    }
}