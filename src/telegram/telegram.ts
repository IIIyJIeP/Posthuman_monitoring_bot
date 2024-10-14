import 'dotenv/config'
import { Telegraf, Context, session } from 'telegraf'
import { FmtString } from 'telegraf/format'

if (!process.env.TELEGRAM_BOT_TOKEN) throw new Error('"TELEGRAM_BOT_TOKEN" env var is required!');
if (!process.env.TEST_TG_BOT_TOKEN) throw new Error('"TEST_TG_BOT_TOKEN" env var is required!');
if (!process.env.DEPLOYMENT) throw new Error('"DEPLOYMENT" env var is required!');
const TOKEN = process.env.DEPLOYMENT === 'production' ? process.env.TELEGRAM_BOT_TOKEN : process.env.TEST_TG_BOT_TOKEN

if (!process.env.TELEGRAM_ADMIN_ID) throw new Error('"TELEGRAM_ADMIN_ID" env var is required!');
const ADMIN = +process.env.TELEGRAM_ADMIN_ID
if (!process.env.WEIRD_CHAT_ID) throw new Error('"WEIRD_CHAT_ID" env var is required!')
const CHANNEL_CHAT_ID = +process.env.WEIRD_CHAT_ID
if (!process.env.SERVICE_CHAT_ID) throw new Error('"SERVICE_CHAT_ID" env var is required!')
const SERVICE_CHAT_ID = +process.env.SERVICE_CHAT_ID

process.once("SIGINT", () => {
    TelegramBot.bot.stop("SIGINT")
    process.exit()
})
process.once("SIGTERM", () => {
    TelegramBot.bot.stop("SIGTERM")
    process.exit
})

export class TelegramBot {
    static isRuning = false
    
    static bot = new Telegraf(TOKEN)
        .use(session())
        .start((ctx) => ctx.reply('Welcome'))
        .hears('id', (ctx) => {
            ctx.reply('Chat ID:' + ctx.chat.id.toString() + 
                '\nTopic ID:' + ctx.message.message_thread_id?.toString() +
                '\nUser Id: ' + ctx.from.id.toString()
            )
        })
        
    static run = () => {
        if(!this.isRuning) {
            this.bot.launch()
                .then((data) => console.log(data))
                .catch((err) => console.error(err))
                .finally(() => {
                    this.isRuning = false
                    setTimeout(this.run, 1000)
                })
            this.isRuning = true
        }
    }
    
    static async sendMsgToChannel(msg: FmtString) {
        await TelegramBot.bot.telegram.sendMessage(
            CHANNEL_CHAT_ID, 
            msg,
            {
                disable_web_page_preview: true,
            }
        )
    }

    static async sendServiceInformation(msg: FmtString) {
        await TelegramBot.bot.telegram.sendMessage(
            SERVICE_CHAT_ID, 
            msg,
            {
                disable_web_page_preview: true,
            }
        )
    }
}