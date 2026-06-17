# Сборка установщика Raduga Dataset Video Community v0.3.5

## Windows — NSIS

### Требования
- [NSIS 3.09+](https://nsis.sourceforge.io/)
- Готовый `cargo tauri build` (файлы в `target/release/`)

### Сборка
```bash
# 1. Сначала собрать Tauri-приложение
cd <корень проекта>
bun run tauri build

# 2. Скомпилировать NSIS installer
makensis installer/rdvc_installer.nsi
# → создаст installer/RDVC_Setup_0.3.5.exe
```

Installer включает:
- Кастомные sidebar/header баннеры (положить в `installer/assets/`)
- Лицензию LICENSE.txt
- Все DLL из `target/release/`
- Проверку наличия ADB + ссылку на загрузку
- Записи в Add/Remove Programs
- Ярлык на рабочем столе
- Кастомный uninstaller с очисткой кэша

### Создание баннеров установщика
Нужны два BMP-файла в `installer/assets/`:
- `installer_side.bmp` — 164×314 px (боковой баннер, MUI Welcome/Finish)
- `installer_header.bmp` — 150×57 px (верхний баннер страниц)

---

## macOS — Tauri NSIS/DMG/PKG (встроено)

Tauri v2 собирает `.dmg` и `.app` автоматически при:
```bash
bun run tauri build -- --target aarch64-apple-darwin   # для M-series
bun run tauri build -- --target x86_64-apple-darwin    # для Intel
bun run tauri build                                     # текущая архитектура
```

Итог: `src-tauri/target/release/bundle/dmg/Raduga Dataset Video Community_0.3.5_aarch64.dmg`

---

## Структура релизного архива

```
RDVC_v0.3.5/
├── RDVC_Setup_0.3.5.exe          ← Windows installer (NSIS)
├── Raduga_Dataset_Video_Community_0.3.5_aarch64.dmg  ← macOS Apple Silicon
├── Raduga_Dataset_Video_Community_0.3.5_x64.dmg      ← macOS Intel
├── LICENSE.txt
└── CHANGELOG.md
```
