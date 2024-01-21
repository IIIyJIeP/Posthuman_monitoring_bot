import { poolsPHMNosmosis } from '../../config.json'


export function isPHMNpool (poolId: bigint) {
    if (poolsPHMNosmosis.find((pool)=>BigInt(pool.poolId) === poolId)) return true
    return false
}

export function getPoolInfo (poolId: bigint) {
    const poolInfo = poolsPHMNosmosis.find((pool)=>BigInt(pool.poolId) === poolId)
    return poolInfo ? {
        poolId: BigInt(poolInfo.poolId),
        secondTokenDenom: poolInfo.secondTokenDenom,
        secondTokenBaseDenom: poolInfo.secondTokenBaseDenom,
        secondTokenMultiplier: poolInfo.secondTokenMultiplier
    } : undefined
}