// Simple Memmory DB. TODO: ?
const db = {
    lastHeight: 0
}

export function getLastHeight ()  {
    return db.lastHeight
}

export function setLastHeight (height: number)  {
    db.lastHeight = height
}