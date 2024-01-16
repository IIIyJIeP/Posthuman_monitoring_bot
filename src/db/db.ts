import { ChainName } from "../blockchains/types";

const db = {
    "lastHeight": {
        "Osmosis":0,
        "Juno":0
    }
}

export function getLastHeight (chainName: ChainName)  {
    return db.lastHeight[chainName]
}

export function setLastHeight (chainName: ChainName, height: number)  {
    db.lastHeight[chainName] = height
}