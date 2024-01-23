import { daoDaoNamesURL, dasTreasuryAddress } from '../config.json'

const names = {
    [dasTreasuryAddress]: 'DAS treasury'
}

export async function getDaoDaoNickname (address:string) {
    let name = ''
    try{
        const response = await fetch(daoDaoNamesURL + address)
        if (response.ok) {
            name = (await response.json()).name || ''
        }
    } catch (err) {
        console.error(err)
    }
    name = name === '' ? names[address] || '' : name
    name = name === '' ? '' : '(' + name + ')'
    return name
}