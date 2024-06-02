import { daoDaoNamesURL, subdaoTreasuryAddresses } from '../config.json'

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
    const DAS_SubDao_name = subdaoTreasuryAddresses.find((subdao) => 
        subdao.treasuryAddress === address
    )?.subdaoTag || ''
    name = name === '' ? DAS_SubDao_name : name
    name = name === '' ? '' : '(' + name + ')'
    return name
}