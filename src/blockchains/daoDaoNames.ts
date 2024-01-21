import { daoDaoNamesURL } from '../config.json'

export async function getDaoDaoNickname (address:string) {
    try{
        const response = await fetch(daoDaoNamesURL + address)
        if (response.ok) {
            const name = (await response.json()).name
            if (name !== null) {
                return '(' + name + ')'
            }
        } 
    } catch (err) {
        console.error(err)
    }
    return ''
}