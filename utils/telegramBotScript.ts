export const PYTHON_BOT_SCRIPT = `import os
import re
import sys
import json
import logging
import asyncio
import threading
import subprocess
import urllib.request
import urllib.parse
import base64
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

# API токен для работы с Kodik
KODIK_TOKEN = os.getenv("KODIK_API_TOKEN", "17cc4ee691bc251131a9041e6e89e78e")

def convert_char(char, num):
    alph = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    upper = char.upper()
    if upper in alph:
        idx = (alph.index(upper) + num) % len(alph)
        ch = alph[idx]
        return ch.lower() if char.islower() else ch
    return char

def decode_kodik_url(encoded):
    for rot in range(26):
        crypted = "".join(convert_char(c, rot) for c in encoded)
        padding = (4 - (len(crypted) % 4)) % 4
        try:
            padded_str = crypted + "=" * padding
            decoded_bytes = base64.b64decode(padded_str.encode("utf-8"))
            decoded = decoded_bytes.decode("utf-8", errors="ignore")
            if "mp4:hls:manifest" in decoded:
                return decoded
        except Exception:
            pass
    raise ValueError("Decryption of Kodik stream URL failed")

def extract_m3u8_stream(iframe_url, quality=None):
    if iframe_url.startswith("//"):
        iframe_url = "https:" + iframe_url
    
    # Резолвим домены для борьбы с блокировками и лимитами, как в веб-прокси
    iframe_url = re.sub(
        r'(kodik\\.info|kodik\\.cc|kodik\\.biz|kodik\\.net|kodik\\.tv|kodik\\.club|kodik\\.site|kodik\\.space)', 
        'kodikplayer.com', 
        iframe_url
    )
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://shikimori.one/'
    }
    
    # 1. Загружаем iframe-страницу
    req = urllib.request.Request(iframe_url, headers=headers)
    with urllib.request.urlopen(req, timeout=15) as response:
        html = response.read().decode('utf-8')
        
    # 2. Извлекаем параметры (как в server.ts)
    url_params_match = re.search(r"urlParams\\s*=\\s*'([^']+)'", html) or re.search(r'urlParams\\s*=\\s*"([^"]+)"', html) or re.search(r"urlParams\\s*=\\s*({[^;]+})", html)
    hash_match = re.search(r"\\.hash\\s*=\\s*'([^']+)'", html) or re.search(r'\\.hash\\s*=\\s*"([^"]+)"', html) or re.search(r"""\\.hash\\s*=\\s*['\"]([^'\"]+)['\"]""", html)
    id_match = re.search(r"\\.id\\s*=\\s*'([^']+)'", html) or re.search(r'\\.id\\s*=\\s*"([^"]+)"', html) or re.search(r"""\\.id\\s*=\\s*['\"]([^'\"]+)['\"]""", html)
    type_match = re.search(r"\\.type\\s*=\\s*'([^']+)'", html) or re.search(r'\\.type\\s*=\\s*"([^"]+)"', html) or re.search(r"""\\.type\\s*=\\s*['\"]([^'\"]+)['\"]""", html)
    
    if not (url_params_match and hash_match and id_match and type_match):
        raise ValueError("Failed to parse iframe parameters from Kodik. Stream might be offline.")
        
    url_params = json.loads(url_params_match.group(1))
    video_hash = hash_match.group(1)
    video_id = id_match.group(1)
    video_type = type_match.group(1)
    
    # Поиск скрипта с Gbox ajax logic
    script_url = '/assets/js/app.serial.js'
    script_urls = re.findall(r"<script\\b[^>]*?\\bsrc\\s*=\\s*[\\\"']([^\\\"']+\\.js[^\\\"']*)[\\\"']", html, re.IGNORECASE)
    asset_script = next((s for s in script_urls if '/assets/' in s), None)
    if asset_script:
        script_url = asset_script
    elif script_urls:
        script_url = script_urls[0]
        
    base_url_obj = urllib.parse.urlparse(iframe_url)
    script_absolute_url = script_url if script_url.startswith('http') else f"{base_url_obj.scheme}://{base_url_obj.netloc}{script_url}"
    
    # 3. Загружаем скрипт для парсинга AJAX пути Gbox
    req_script = urllib.request.Request(script_absolute_url, headers={'Referer': iframe_url, 'User-Agent': headers['User-Agent']})
    with urllib.request.urlopen(req_script, timeout=15) as res_script:
        script_html = res_script.read().decode('utf-8')
        
    ajax_match = re.search(r"\\$\\.ajax\\([\\s\\S]*?url:\\s*atob\\(\\\"([^\\\"]+)\\\"\\)", script_html) or re.search(r"atob\\(\\\"([^\\\"'\\(\\)]+)\\\"\\)", script_html)
    if not ajax_match:
        raise ValueError("Could not extract player API script")
        
    gbox_path = base64.b64decode(ajax_match.group(1).encode('utf-8')).decode('utf-8')
    gbox_url = f"{base_url_obj.scheme}://{base_url_obj.netloc}{gbox_path}"
    
    # 4. Запрашиваем ссылки с Gbox-сервера
    payload = {
        'hash': video_hash,
        'id': video_id,
        'type': video_type,
        'd': url_params.get('d', 'kodik.info'),
        'd_sign': url_params.get('d_sign', ''),
        'pd': url_params.get('pd', ''),
        'pd_sign': url_params.get('pd_sign', ''),
        'ref': urllib.parse.unquote(url_params.get('ref', '')),
        'ref_sign': url_params.get('ref_sign', ''),
        'bad_user': 'true',
        'cdn_is_working': 'true'
    }
    encoded_payload = urllib.parse.urlencode(payload).encode('utf-8')
    
    gbox_headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': headers['User-Agent'],
        'Referer': iframe_url
    }
    
    req_gbox = urllib.request.Request(gbox_url, data=encoded_payload, headers=gbox_headers)
    with urllib.request.urlopen(req_gbox, timeout=15) as res_gbox:
        gbox_data = json.loads(res_gbox.read().decode('utf-8'))
        
    if not gbox_data or not gbox_data.get('links'):
        raise ValueError(f"Kodik gbox API returned empty links: {gbox_data}")
        
    links_dict = gbox_data['links']
    available_qualities = sorted([int(k) for k in links_dict.keys()], reverse=True)
    if not available_qualities:
        raise ValueError("No video stream found for any quality.")
        
    return available_qualities, links_dict

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Обработка команды /start
    Поддерживает deep-links формата: dl_<id>_ep<серия>_tr<озвучка>
    """
    args = context.args
    if not args:
        await update.message.reply_text(
            "👋 **Привет! Я бот для загрузки аниме с KamiAnime!**\\n\\n"
            "Перейдите на сайт, выберите тайтл, нажмите кнопку **«Скачать в Telegram»**, "
            "и я автоматически пришлю готовый видеофайл в выбранной вами озвучке!",
            parse_mode="Markdown"
        )
        return

    param = args[0]
    if param.startswith("dl_"):
        parts = param.split("_")
        anime_id = parts[1]
        
        episode = "1"
        translation_id = "0"
        
        for part in parts[2:]:
            if part.startswith("ep"):
                episode = part.replace("ep", "")
            elif part.startswith("tr"):
                translation_id = part.replace("tr", "")

        status_msg = await update.message.reply_text(
            "⏳ **Поиск информации о тайтле на серверах...**",
            parse_mode="Markdown"
        )
        
        try:
            # Делаем запрос к Kodik API
            api_url = f"https://kodik-api.com/search?token={KODIK_TOKEN}&shikimori_id={anime_id}&with_material_data=true"
            req = urllib.request.Request(api_url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=10) as response:
                info = json.loads(response.read().decode('utf-8'))
            
            if not info.get("results"):
                await status_msg.edit_text("❌ К сожалению, аниме не найдено на сервере.")
                return
                
            # Ищем нужную озвучку (translation)
            matching_item = None
            if translation_id and translation_id != "0":
                for item in info["results"]:
                    if "translation" in item and str(item["translation"].get("id")) == str(translation_id):
                        matching_item = item
                        break
            
            if not matching_item:
                matching_item = info["results"][0]
                
            anime_title = matching_item.get("material_data", {}).get("title", "Аниме")
            translation_title = matching_item.get("translation", {}).get("title", "Стандартная озвучка")
            
            # Подготовка клавиш выбора качества (360p, 480p, 720p)
            keyboard = [
                [
                    InlineKeyboardButton("🟢 360p (SD качество)", callback_data=f"q_{anime_id}_{episode}_{translation_id}_360"),
                    InlineKeyboardButton("🔵 480p (HQ качество)", callback_data=f"q_{anime_id}_{episode}_{translation_id}_480"),
                    InlineKeyboardButton("🔥 720p (HD качество)", callback_data=f"q_{anime_id}_{episode}_{translation_id}_720")
                ],
                [
                    InlineKeyboardButton("🪐 На сайт KamiAnime", url="https://shikimori.one")
                ]
            ]
            
            reply_markup = InlineKeyboardMarkup(keyboard)
            text = (
                f"🎬 **Найдено аниме в нашей базе!**\\n\\n"
                f"• 📌 **Название:** {anime_title}\\n"
                f"• 🎙️ **Озвучка:** {translation_title}\\n"
                f"• 💿 **Серия:** {episode}\\n\\n"
                f"Выберите желаемое качество видео ниже. Наш робот мгновенно склеит фрагменты m3u8 в целый MP4-файл и отправит его вам!"
            )
            
            await status_msg.delete()
            await update.message.reply_text(
                text,
                reply_markup=reply_markup,
                parse_mode="Markdown"
            )
            
        except Exception as e:
            logger.error(f"Start error: {e}")
            await status_msg.edit_text(f"❌ Возникла непредвиденная ошибка: {str(e)}")

async def button_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Обработчик кнопок качества (q_...)
    """
    query = update.callback_query
    await query.answer()
    
    data = query.data
    if data.startswith("q_"):
        parts = data.split("_")
        anime_id = parts[1]
        episode = parts[2]
        translation_id = parts[3]
        quality = parts[4]
        
        status_msg = await query.message.reply_text(
            f"⏳ **[1/3] Поиск потока для {quality}p...**\\n"
            f"Извлекаем прямые плейлисты в выбранной озвучке...",
            parse_mode="Markdown"
        )

        try:
            # 1. Запрос к Kodik API
            api_url = f"https://kodik-api.com/search?token={KODIK_TOKEN}&shikimori_id={anime_id}&with_material_data=true"
            req = urllib.request.Request(api_url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=10) as response:
                info = json.loads(response.read().decode('utf-8'))
            
            if not info.get("results"):
                await status_msg.edit_text("❌ Видеопоток не найден на серверах.")
                return

            # Находим подходящую озвучку
            matching_item = None
            if translation_id and translation_id != "0":
                for item in info["results"]:
                    if "translation" in item and str(item["translation"].get("id")) == str(translation_id):
                        matching_item = item
                        break
            
            if not matching_item:
                matching_item = info["results"][0]

            link = matching_item["link"]
            if not link.startswith("http"):
                link = "https:" + link if link.startswith("//") else link

            # Подстановка серии в плеер, если сериал
            if episode and episode != "all" and episode != "None":
                sep = "&" if "?" in link else "?"
                link = f"{link}{sep}episode={episode}"

            # 2. Дешифрование потока через бэкенд-парсер
            await status_msg.edit_text(
                f"⚙️ **[2/3] Дешифрование m3u8...**\\n"
                f"Парсим прямые плейлисты Kodik для качества {quality}p...",
                parse_mode="Markdown"
            )
            
            available_quals, links_dict = extract_m3u8_stream(link, quality)
            
            selected_qual_str = str(quality)
            if selected_qual_str not in links_dict:
                selected_qual_str = str(available_quals[0])
                
            raw_src = links_dict[selected_qual_str][0]['src']
            decrypted_url = raw_src if 'mp4:hls:manifest' in raw_src else decode_kodik_url(raw_src)
            playlist_url = decrypted_url if decrypted_url.startswith('http') else "https:" + decrypted_url

            # 3. Склеивание потока через FFmpeg
            await status_msg.edit_text(
                f"🚀 **[3/3] Запуск FFmpeg компилятора...**\\n"
                f"Скачиваем сегменты потока HLS в один MP4-файл.\\n"
                f"Это займет буквально секунд 15-30, подождите...",
                parse_mode="Markdown"
            )

            output_filename = f"anime_{anime_id}_ep_{episode}_{quality}p.mp4"
            if os.path.exists(output_filename):
                try:
                    os.remove(output_filename)
                except:
                    pass

            # Запускаем ffmpeg
            cmd = [
                "ffmpeg", "-y",
                "-headers", "Referer: https://kodik.info/\\r\\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36\\r\\n",
                "-i", playlist_url,
                "-c", "copy",
                "-bsf:a", "aac_adtstoasc",
                output_filename
            ]
            
            process = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=120)
            
            if not os.path.exists(output_filename) or os.path.getsize(output_filename) == 0:
                raise RuntimeError(f"FFmpeg failed: {process.stderr or process.stdout}")

            file_size = os.path.getsize(output_filename)
            file_size_mb = file_size / (1024 * 1024)

            # Если файл превышает 48 МБ (лимит Telegram), мы разделяем его без потери качества
            if file_size > 48 * 1024 * 1024:
                try:
                    # 1. Измеряем длительность видео через ffprobe
                    duration = 1440.0
                    try:
                        probe_cmd = [
                            "ffprobe", "-v", "error", "-show_entries", "format=duration",
                            "-of", "default=noprint_wrappers=1:noclose=1", output_filename
                        ]
                        p_dur = subprocess.run(probe_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
                        if p_dur.returncode == 0 and p_dur.stdout.strip():
                            duration = float(p_dur.stdout.strip())
                    except Exception as pe:
                        logger.error(f"Ffprobe error: {pe}")

                    import math
                    import glob
                    
                    target_size = 47 * 1024 * 1024  # 47 MB
                    num_parts = math.ceil(file_size / target_size)
                    segment_time = duration / num_parts

                    await status_msg.edit_text(
                        f"✂️ **Файл весит {file_size_mb:.1f} Мб (лимит TG: 50MB).**\\n"
                        f"Склеили без сжатия! Теперь быстро нарезаем фильм на {num_parts} равные части без потери качества для отправки в Telegram...",
                        parse_mode="Markdown"
                    )

                    parts_pattern = f"part_%03d_{output_filename}"
                    split_cmd = [
                        "ffmpeg", "-y",
                        "-i", output_filename,
                        "-c", "copy",
                        "-map", "0",
                        "-segment_time", str(segment_time),
                        "-f", "segment",
                        "-reset_timestamps", "1",
                        parts_pattern
                    ]
                    
                    split_process = subprocess.run(split_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
                    part_files = sorted(glob.glob(f"part_*_{output_filename}"))
                    
                    if len(part_files) > 0:
                        space_id = os.getenv("SPACE_ID", "")
                        space_host = os.getenv("SPACE_HOST", "")
                        download_text = ""
                        
                        if space_host or space_id:
                            if space_host:
                                download_url = f"https://{space_host}/{output_filename}"
                            else:
                                subdomain = space_id.replace("/", "-").lower()
                                download_url = f"https://{subdomain}.hf.space/{output_filename}"
                            
                            download_text = (
                                f"🪐 **Прямая ссылка на целый файл (100% качество):**\\n"
                                f"🔗 **[СКАЧАТЬ {quality}p]({download_url})**\\n\\n"
                            )
                        
                        header_text = (
                            f"🎬 **Аниме готово без потери качества!**\\n\\n"
                            f"{download_text}"
                            f"📦 Файл разделен на {len(part_files)} части, чтобы обойти ограничение Telegram.\\n"
                            f"Отправляем части прямо сюда..."
                        )
                        await status_msg.edit_text(header_text, parse_mode="Markdown", disable_web_page_preview=True)
                        
                        for idx, part_file in enumerate(part_files):
                            part_size = os.path.getsize(part_file)
                            part_size_mb = part_size / (1024 * 1024)
                            
                            await query.message.reply_chat_action("upload_video")
                            with open(part_file, "rb") as pf:
                                await query.message.reply_video(
                                    video=pf,
                                    filename=os.path.basename(part_file),
                                    caption=(
                                        f"🎞️ **Часть {idx+1} из {len(part_files)}** ({part_size_mb:.1f} MB)\\n\\n"
                                        f"• **Серия:** {episode}\\n"
                                        f"• **Качество:** {quality}p (без сжатия!)"
                                    ),
                                    supports_streaming=True
                                )
                            try:
                                os.remove(part_file)
                            except:
                                pass
                        
                        try:
                            os.remove(output_filename)
                        except:
                            pass
                        return
                    else:
                        raise RuntimeError(f"FFmpeg segmentation returned no files: {split_process.stderr}")
                        
                except Exception as ex:
                    logger.error(f"Lossless splitting failed: {ex}. Falling back to compression...")
                    try:
                        await status_msg.edit_text(
                            f"⚠️ Не удалось нарезать файл без потери качества. Запускаем сжатие до 47MB...",
                            parse_mode="Markdown"
                        )
                        # 2. Вычисляем битрейт под целевой размер 45MB
                        target_bytes = 45 * 1024 * 1024
                        total_bitrate_bps = (target_bytes * 8) / duration
                        audio_bitrate_bps = 64000
                        video_bitrate_bps = total_bitrate_bps - audio_bitrate_bps
                        
                        if video_bitrate_bps < 120000:
                            video_bitrate_bps = 120000
                            
                        compressed_filename = f"compressed_{output_filename}"
                        if os.path.exists(compressed_filename):
                            try:
                                os.remove(compressed_filename)
                            except:
                                pass
                                
                        compress_cmd = [
                            "ffmpeg", "-y",
                            "-i", output_filename,
                            "-b:v", f"{int(video_bitrate_bps)}",
                            "-maxrate", f"{int(video_bitrate_bps * 1.5)}",
                            "-bufsize", f"{int(video_bitrate_bps * 2)}",
                            "-c:v", "libx264",
                            "-preset", "veryfast",
                            "-c:a", "aac",
                            "-b:a", f"{int(audio_bitrate_bps)}",
                            compressed_filename
                        ]
                        
                        subprocess.run(compress_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
                        if os.path.exists(compressed_filename) and os.path.getsize(compressed_filename) > 0:
                            os.remove(output_filename)
                            os.rename(compressed_filename, output_filename)
                            file_size = os.path.getsize(output_filename)
                            file_size_mb = file_size / (1024 * 1024)
                    except Exception as ce:
                        logger.error(f"Compression fallback failed: {ce}")

            file_size = os.path.getsize(output_filename)
            file_size_mb = file_size / (1024 * 1024)

            await status_msg.edit_text(
                f"📥 **Сборка завершена успешно! ({file_size_mb:.1f} MB)**\\n"
                f"Начинаем отправку видеофайла в Telegram-чат...",
                parse_mode="Markdown"
            )

            # Отправка файла видео, если он влезает в лимит бота (50MB)
            if file_size <= 50 * 1024 * 1024:
                await query.message.reply_chat_action("upload_video")
                with open(output_filename, "rb") as video_file:
                    await query.message.reply_video(
                        video=video_file,
                        filename=output_filename,
                        caption=(
                            f"🍿 **Ваше аниме готово для просмотра!**\\n\\n"
                            f"• **Серия:** {episode}\\n"
                            f"• **Качество:** {quality}p\\n"
                            f"• **Размер:** {file_size_mb:.1f} Мб\\n\\n"
                            f"Приятного просмотра! 🎉"
                        ),
                        supports_streaming=True
                    )
                await status_msg.delete()
                # Удаляем временный файл для экономии диска
                try:
                    os.remove(output_filename)
                except:
                    pass
            else:
                # Если файл слишком большой, отдаем прямую ссылку с Hugging Face Spaces
                space_id = os.getenv("SPACE_ID", "")
                space_host = os.getenv("SPACE_HOST", "")
                
                if space_host or space_id:
                    if space_host:
                        download_url = f"https://{space_host}/{output_filename}"
                    else:
                        subdomain = space_id.replace("/", "-").lower()
                        download_url = f"https://{subdomain}.hf.space/{output_filename}"
                    
                    await status_msg.edit_text(
                        f"🍿 **Аниме готово для скачивания!**\\n\\n"
                        f"Файл весит **{file_size_mb:.1f} MB**, что больше лимита Telegram бота (50MB).\\n"
                        f"Мы сохранили его в вашем Space-хранилище. Скачайте по прямой ссылке:\\n\\n"
                        f"🔗 **[СКАЧАТЬ MP4 {quality}p]({download_url})**\\n\\n"
                        f"*Ссылка активна, скачивание идет на полной скорости!*",
                        parse_mode="Markdown"
                    )
                else:
                    await status_msg.edit_text(
                        f"⚠️ **Файл весит {file_size_mb:.1f} MB** (превышает лимит 50MB бота).\\n"
                        f"Настройте переменные в секретах Hugging Face, чтобы получать ссылки на прямое скачивание файлов!"
                    )

        except Exception as e:
            logger.error(f"Error in callback: {e}")
            err_text = (
                f"❌ Возникла ошибка при обработке или скачивании:\\n"
                f"_{str(e)}_\\n\\n"
                f"Попробуйте выбрать другое качество или серию!"
            )
            await status_msg.edit_text(err_text, parse_mode="Markdown")

# Запуск простого HTTP-сервера для Hugging Face Spaces на порту 7860
class HealthCheckHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        filename = self.path.lstrip("/")
        filename = os.path.basename(filename)
        
        # Скачивание готовых MP4 файлов напрямую из spaces
        if filename.endswith(".mp4") and os.path.exists(filename):
            try:
                size = os.path.getsize(filename)
                self.send_response(200)
                self.send_header("Content-Type", "video/mp4")
                self.send_header("Content-Length", str(size))
                self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                
                with open(filename, "rb") as f:
                    while True:
                        chunk = f.read(256 * 1024)
                        if not chunk:
                            break
                        self.wfile.write(chunk)
                return
            except Exception as e:
                logger.error(f"Error serving MP4: {e}")
                
        self.send_response(200)
        self.send_header("Content-type", "text/html; charset=utf-8")
        self.end_headers()
        html_content = (
            "<html>"
            "<head><title>KamiAnime Bot</title></head>"
            "<body style='font-family: sans-serif; text-align: center; padding-top: 100px; background-color: #0f172a; color: #f8fafc;'>"
            "<h1 style='color: #38bdf8;'>Ready to download: Active</h1>"
            "<p style='color: #94a3b8;'>Бот успешно занут на Hugging Face Spaces и осуществляет сборку аниме!</p>"
            "</body>"
            "</html>"
        )
        self.wfile.write(html_content.encode("utf-8"))

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
        
    # Настройка прокси/зеркала Telegram API
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
`
