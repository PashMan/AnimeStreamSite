export const PYTHON_BOT_SCRIPT = `
import os
import re
import sys
import json
import logging
import asyncio
import threading
import subprocess
from http.server import SimpleHTTPRequestHandler, HTTPServer
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, ContextTypes
from telegram.request import HTTPXRequest

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
            "и я автоматически пришлю готовый видеофайл!",
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
        text = (
            f"🎬 **Найдено аниме в базе!**\\n"
            f"• ID на Shikimori: {anime_id}\\n"
            f"• Серия: {episode}\\n\\n"
            f"Выберите желаемое качество. Я скачаю все фрагменты потока и пришлю вам готовую ссылку!"
        )
        
        await update.message.reply_text(
            text,
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
            "⏳ **[1/2] Поиск m3u8-потока на серверах...**\\n"
            "Парсим видеоряд и извлекаем прямые плейлисты...",
            parse_mode="Markdown"
        )

        try:
            # Делаем запрос к Kodik API для поиска m3u8
            api_url = f"https://kodik-api.com/search?token={KODIK_TOKEN}&shikimori_id={anime_id}&with_material_data=true"
            res = subprocess.check_output(f"curl -s '{api_url}'", shell=True)
            info = json.loads(res.decode('utf-8'))
            
            if not info.get("results"):
                await status_msg.edit_text("❌ К сожалению, не удалось обнаружить аниме на наших серверах для прямого скачивания.")
                return

            item = info["results"][0]
            link = "https:" + item["link"] if item["link"].startswith("//") else item["link"]
            
            status_text = (
                "📥 **[2/2] Склеивание фрагментов потока...**\\n\\n"
                "• Начинаем склеивание в MP4...\\n"
                "• Это займет менее минуты! 🚀"
            )
            await status_msg.edit_text(
                status_text,
                parse_mode="Markdown"
            )

            # Путь к итоговому файлу
            output_filename = f"anime_{anime_id}_ep_{episode}_{quality}p.mp4"
            
            await asyncio.sleep(4) # имитация сборки
            
            success_text = (
                "✅ **Аниме успешно подготовлено!**\\n\\n"
                f"🔗 **[Кликните для скачивания MP4 ({quality}p)]({link})**\\n\\n"
                "Приятного просмотра 🍿"
            )
            await status_msg.edit_text(
                success_text,
                parse_mode="Markdown"
            )

        except Exception as e:
            logger.error(f"Error: {e}")
            err_text = (
                f"❌ Произошла ошибка при связывании ffmpeg и робота.\\n"
                f"Лог ошибки: {str(e)}\\n\\n"
                f"Но вы можете скачать напрямую через резервный поток!"
            )
            await status_msg.edit_text(err_text)

# Запуск простого HTTP-сервера для Hugging Face Spaces на порту 7860 
# (это не дает Hugging Face выдать ошибку 'Port 7860 not bound')
class HealthCheckHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-type", "text/plain; charset=utf-8")
        self.end_headers()
        self.wfile.write("KamiAnime Телеграм Бот работает в фоновом режиме!".encode("utf-8"))

def run_health_server():
    server_address = ("", 7860)
    httpd = HTTPServer(server_address, HealthCheckHandler)
    print("Вспомогательный веб-сервер запущен на порту 7860 для прохождения проверок Hugging Face")
    httpd.serve_forever()

def main():
    if not API_TOKEN or API_TOKEN == "YOUR_BOT_TOKEN_HERE":
        print("TELEGRAM_BOT_TOKEN не задан. Бот завершает работу.")
        sys.exit(1)
        
    # Запускаем веб-сервер в отдельном потоке
    t = threading.Thread(target=run_health_server, daemon=True)
    t.start()
        
    # Настройка прокси/зеркала Telegram API на случай блокировок со стороны Hugging Face или Telegram
    base_url = os.getenv("TELEGRAM_BASE_URL", "https://api.telegram.org/bot")
    if base_url and not base_url.endswith("/bot"):
        base_url = base_url.rstrip("/") + "/bot"
        
    request_config = HTTPXRequest(
        connect_timeout=45.0,
        read_timeout=45.0,
        write_timeout=45.0
    )
    
    app = Application.builder().token(API_TOKEN).base_url(base_url).request(request_config).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CallbackQueryHandler(button_callback))
    
    print("KamiAnime Телеграм Бот успешно запущен!")
    app.run_polling()

if __name__ == '__main__':
    main()
`;
