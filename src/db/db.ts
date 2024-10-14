import { ChainName } from "../blockchains/types";

// Simple Memmory DB. TODO: sqlite
const db = {
    "lastHeight": {
        "Osmosis":0,
        "Stargaze":0,
        "Neutron":0,
        "Injective":0
    }
}

export function getLastHeight (chainName: ChainName)  {
    return db.lastHeight[chainName]
}

export function setLastHeight (chainName: ChainName, height: number)  {
    db.lastHeight[chainName] = height
}