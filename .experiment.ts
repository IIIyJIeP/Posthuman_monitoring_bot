import { TelegramBot } from './src/telegram/telegram'
import { fmt } from 'telegraf/format'

app()
async function app() {
    TelegramBot.run()
    
    await TelegramBot.sendMsgToChannel(fmt`Second test msg`)

    process.exit()
}