export function getReceiverFromMemo (memo: string) {
    try {
        return JSON.parse(memo)?.forward?.receiver as string
    } catch (e) {
        return undefined
    }
}