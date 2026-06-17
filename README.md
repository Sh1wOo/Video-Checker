# Raduga Dataset Video Community v0.3.5

**Бесплатный инструмент для работы с видеодатасетами** — сканирование, AI-анализ, управление файлами на ПК и Android/VR-устройствах.

Разработан для внутреннего использования в экосистеме [Raduga Photo](https://raduga.top).

---

## Возможности

- 🎥 **Сканирование видео** — быстрый обход директорий, подсчёт длительности, размера, структуры
- 🤖 **AI-анализ** — обнаружение коротких, битых, пассивных видео
- 📂 **Файловый менеджер Android/VR** — подключение PICO 4 Ultra, Quest, Android-смартфонов
- 🔧 **Восстановление битых видео** — встроенный repair через ffmpeg-подобный движок
- 📊 **Отчёты** — экспорт в CSV/JSON

---

## Установка

### Windows
1. Скачайте `RDVC_Setup_0.3.5.exe`
2. Запустите от имени администратора
3. Следуйте инструкциям

### macOS
1. Скачайте `.dmg` файл под вашу архитектуру
2. Перетащите приложение в `/Applications`

### Android/VR устройства (дополнительно)
Для работы с Android/VR (PICO 4 Ultra, Quest, Android) нужен ADB:

- **macOS:** `brew install android-platform-tools`
- **Windows:** [Скачать Android Platform Tools](https://developer.android.com/studio/releases/platform-tools), добавить папку в PATH

На устройстве включить: *Настройки → Настройки разработчика → Отладка по USB*

---

## Сборка из исходников

```bash
# Требования: Rust + bun + Tauri CLI
bun install
bun run tauri build
```

---

## Лицензия

Raduga Non-Commercial License v1.0 — см. [LICENSE.txt](LICENSE.txt)

Бесплатно для личного и некоммерческого использования.  
По вопросам коммерческого использования: info@raduga.top

© 2025 Raduga Photo
