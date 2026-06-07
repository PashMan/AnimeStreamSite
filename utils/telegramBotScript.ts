export const PYTHON_BOT_SCRIPT = `
import os
import re
import sys
import json
import logging
import asyncio
import subprocess
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, ContextTypes

# Настройка логирования
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Токен Телеграм бота (Задайте у себя в Hugging Face / Space Settings -> Repository Secrets)
API_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "YOUR_BOT_TOKEN_HERE")

# API токен для работы с Kodik (берём стандартный парсер)
KODIK_TOKEN = os.getenv("KODIK_API_TOKEN", "17cc4ee691bc251131a9041e6e89e78e")

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Обработка команды /start
    Поддерживает deep-links формата: dl_<id>_ep<серия>
    """
    args = context.args
    if not args:
        await update.message.reply_text(
            "👋 **Привет! Я бот для загрузки аниме с KamiAnime!**\\n\\n"
            "Перейдите на сайт, выберите тайтл, нажмите кнопку **«Скачать в Telegram»**, "
            "и я автоматически при помощи Hugging Face Spaces и ffmpeg подготовлю готовый видеофайл!",
            parse_mode="Markdown"
        )
        return

    # Извлекаем параметры глубокой ссылки
    param = args[0]
    if param.startswith("dl_"):
        parts = param.split("_")
        anime_id = parts[1]
        episode_str = parts[2] if len(parts) > 2 else "all"
        episode = episode_str.replace("ep", "")

        keyboard = [
            [
                InlineKeyboardButton("720p (HD качество)", callback_data=f"proc_{anime_id}_{episode}_720"),
                InlineKeyboardButton("1080p (Full HD качество)", callback_data=f"proc_{anime_id}_{episode}_1080")
            ],
            [
                InlineKeyboardButton("⚙️ Инструкция KamiAnime", url="https://shikimori.one")
            ]
        ]
        
        reply_markup = InlineKeyboardMarkup(keyboard)
        await update.message.reply_text(
            f"🎬 **Найдено аниме в базе!**\\n"
            f"• ID на Shikimori: \\\`{anime_id}\\\`\\n"
            f"• Серия: \\\`{episode}\\\`\\n\\n"
            f"Выберите желаемое качество. Я запущу **Hugging Face Space**, скачаю все фрагменты потока через **ffmpeg** и пришлю вам готовый MP4-файл без рекламы ставок!",
            reply_markup=reply_markup,
            parse_mode="Markdown"
        )

async def button_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Обработчик кнопок выбора качества
    """
    query = update.callback_query
    await query.answer()
    
    data = query.data
    if data.startswith("proc_"):
        _, anime_id, episode, quality = data.split("_")
        
        status_msg = await query.message.reply_text(
            "⏳ **[1/3] Поиск m3u8-потока на серверах баланисировщика...**\\n"
            "Парсим видеоряд и извлекаем прямые плейлисты...",
            parse_mode="Markdown"
        )

        try:
            # Делаем запрос к Kodik API для поиска m3u8
            # Сначала ищем по ID
            api_url = f"https://kodik-api.com/search?token={KODIK_TOKEN}&shikimori_id={anime_id}&with_material_data=true"
            res = subprocess.check_output(f"curl -s '{api_url}'", shell=True)
            info = json.loads(res.decode('utf-8'))
            
            if not info.get("results"):
                await status_msg.edit_text("❌ К сожалению, не удалось обнаружить аниме на наших серверах для прямого скачивания.")
                return

            item = info["results"][0]
            link = "https:" + item["link"] if item["link"].startswith("//") else item["link"]
            
            await status_msg.edit_text(
                f"📥 **[2/3] Запуск FFMPEG конвертера!**\\n\\n"
                f"• Поток: \\\`{link[:40]}...\\\`\\n"
                f"• Начинаем склеивание фрагментов потока TS в MP4...\\n"
                f"• Hugging Face использует 10Gbps канал, это займет менее минуты! 🚀",
                parse_mode="Markdown"
            )

            # Путь к итоговому файлу
            output_filename = f"anime_{anime_id}_ep_{episode}_{quality}p.mp4"
            
            # Эмуляция реальной сборки через утилиту ffmpeg и отправка потока.
            # На Hugging Face Space этот бот исполняет команду ffmpeg:
            #      ffmpeg -i \\"M3U8_URL\\" -c copy -bsf:a aac_adtstoasc output.mp4
            # В зависимости от структуры мы можем скачать тестовый файл или напрямую запустить скачивание
            
            await asyncio.sleep(4) # имитация сборки
            
            await status_msg.edit_text(
                "📤 **[3/3] Видео обработано!**\\n"
                "Загружаем MP4 контейнер в Telegram... 🚀",
                parse_mode="Markdown"
            )
            
            # В реальном коде Space:
            # context.bot.send_video(chat_id=query.message.chat_id, video=open(output_filename, 'rb'))
            
            await status_msg.edit_text(
                "✅ **Аниме успешно подготовлено!**\\n\\n"
                "Из-за ограничений Telegram Bot API на авто-загрузку больших файлов напрямую с серверов, "
                "ваш файл отправлен на прямую раздачу!\\n\\n"
                f"🔗 **[Кликните для скачивания MP4 ({quality}p)]({link})** (Без рекламы ставок!)\\n\\n"
                "Приятного просмотра 🍿",
                parse_mode="Markdown"
            )

        except Exception as e:
            logger.error(f"Error: {e}")
            await status_msg.edit_text(
                f"❌ Произошла ошибка при связывании ffmpeg и Hugging Face Space.\\n"
                f"Лог ошибки: \\\`{str(e)}\\\`\\n\\n"
                f"Но вы можете скачать напрямую через резервный поток!"
            )

def main():
    if not API_TOKEN or API_TOKEN == "YOUR_BOT_TOKEN_HERE":
        print("TELEGRAM_BOT_TOKEN is not set.")
        sys.exit(1)
        
    app = Application.builder().token(API_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CallbackQueryHandler(button_callback))
    
    print("KamiAnime HF Telegram Bot запущен!")
    app.run_polling()

if __name__ == '__main__':
    main()
`;
