import { poolsWEIRDosmosis } from '../../config.json'


export function isWeirdPool (poolId: bigint) {
    if (poolsWEIRDosmosis.find((pool)=>BigInt(pool.poolId) === poolId)) return true
    return false
}

export function getPoolInfo (poolId: bigint) {
    const poolInfo = poolsWEIRDosmosis.find((pool)=>BigInt(pool.poolId) === poolId)
    return poolInfo ? {
        poolId: BigInt(poolInfo.poolId),
        secondTokenDenom: poolInfo.secondTokenDenom,
        secondTokenBaseDenom: poolInfo.secondTokenBaseDenom,
        secondTokenMultiplier: poolInfo.secondTokenMultiplier
    } : undefined
}