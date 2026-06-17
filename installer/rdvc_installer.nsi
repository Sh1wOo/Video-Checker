; ============================================================
;  Raduga Dataset Video Community — NSIS Custom Installer
;  Version 0.3.5
;  © 2025 Raduga Photo (raduga.top)
; ============================================================

Unicode True

; ---- Includes -----------------------------------------------
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "WinMessages.nsh"
!include "x64.nsh"
!include "nsDialogs.nsh"

; ---- Basic Defines ------------------------------------------
!define PRODUCT_NAME        "Raduga Dataset Video Community"
!define PRODUCT_SHORT       "RDVC"
!define PRODUCT_VERSION     "0.3.5"
!define PRODUCT_PUBLISHER   "Raduga Photo"
!define PRODUCT_WEB         "https://raduga.top"
!define PRODUCT_EXE         "raduga-dataset-video-community.exe"
!define REGKEY              "Software\${PRODUCT_SHORT}"
!define UNINSTALL_KEY       "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_SHORT}"
!define INSTALL_DIR         "$PROGRAMFILES64\${PRODUCT_NAME}"

; ---- Output -------------------------------------------------
Name "${PRODUCT_NAME} ${PRODUCT_VERSION}"
OutFile "RDVC_Setup_${PRODUCT_VERSION}.exe"
InstallDir "${INSTALL_DIR}"
InstallDirRegKey HKLM "${REGKEY}" "InstallDir"
RequestExecutionLevel admin
ShowInstDetails show
ShowUninstDetails show
SetCompressor /SOLID lzma
SetCompressorDictSize 32

; ---- MUI Config ---------------------------------------------
!define MUI_ABORTWARNING
!define MUI_ICON                     "..\src-tauri\icons\icon.ico"
!define MUI_UNICON                   "..\src-tauri\icons\icon.ico"
!define MUI_WELCOMEFINISHPAGE_BITMAP "assets\installer_side.bmp"   ; 164x314 BMP
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_BITMAP       "assets\installer_header.bmp" ; 150x57 BMP
!define MUI_HEADERIMAGE_RIGHT

!define MUI_WELCOMEPAGE_TITLE        "Добро пожаловать в ${PRODUCT_NAME}"
!define MUI_WELCOMEPAGE_TEXT         "Программа установки установит ${PRODUCT_NAME} ${PRODUCT_VERSION} на ваш компьютер.$\r$\n$\r$\nПрограмма предназначена для бесплатного некоммерческого использования.$\r$\n$\r$\nНажмите Далее для продолжения."

!define MUI_FINISHPAGE_RUN           "$INSTDIR\${PRODUCT_EXE}"
!define MUI_FINISHPAGE_RUN_TEXT      "Запустить ${PRODUCT_NAME}"
!define MUI_FINISHPAGE_LINK          "Перейти на сайт raduga.top"
!define MUI_FINISHPAGE_LINK_LOCATION "${PRODUCT_WEB}"

; ---- Pages --------------------------------------------------
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "..\LICENSE.txt"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_WELCOME
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

; ---- Languages ----------------------------------------------
!insertmacro MUI_LANGUAGE "Russian"
!insertmacro MUI_LANGUAGE "English"

; ---- Version Info -------------------------------------------
VIProductVersion "${PRODUCT_VERSION}.0"
VIFileVersion    "${PRODUCT_VERSION}.0"
VIAddVersionKey /LANG=${LANG_ENGLISH} "ProductName"      "${PRODUCT_NAME}"
VIAddVersionKey /LANG=${LANG_ENGLISH} "ProductVersion"   "${PRODUCT_VERSION}"
VIAddVersionKey /LANG=${LANG_ENGLISH} "CompanyName"      "${PRODUCT_PUBLISHER}"
VIAddVersionKey /LANG=${LANG_ENGLISH} "LegalCopyright"   "© 2025 Raduga Photo"
VIAddVersionKey /LANG=${LANG_ENGLISH} "FileDescription"  "${PRODUCT_NAME} Installer"
VIAddVersionKey /LANG=${LANG_ENGLISH} "FileVersion"      "${PRODUCT_VERSION}"

; ============================================================
;  INSTALL SECTION
; ============================================================

Section "Главный компонент" SecMain
  SectionIn RO  ; Mandatory

  SetOutPath "$INSTDIR"
  SetOverwrite on

  ; ── Core application binary ──────────────────────────────
  File "..\target\release\${PRODUCT_EXE}"

  ; ── Redistributable DLLs (bundled with release) ──────────
  ; Visual C++ Runtime
  File /nonfatal "..\target\release\msvcp140.dll"
  File /nonfatal "..\target\release\vcruntime140.dll"
  File /nonfatal "..\target\release\vcruntime140_1.dll"

  ; WebView2 loader
  File /nonfatal "..\target\release\WebView2Loader.dll"

  ; Tauri / WRY internals
  File /nonfatal "..\target\release\*.dll"

  ; ── Resources & data ─────────────────────────────────────
  SetOutPath "$INSTDIR\resources"
  File /nonfatal /r "..\target\release\resources\*.*"

  SetOutPath "$INSTDIR"

  ; ── Registry ─────────────────────────────────────────────
  WriteRegStr HKLM "${REGKEY}" "InstallDir"  "$INSTDIR"
  WriteRegStr HKLM "${REGKEY}" "Version"     "${PRODUCT_VERSION}"

  ; ── Add/Remove Programs entry ────────────────────────────
  WriteRegStr HKLM "${UNINSTALL_KEY}" "DisplayName"          "${PRODUCT_NAME}"
  WriteRegStr HKLM "${UNINSTALL_KEY}" "DisplayVersion"       "${PRODUCT_VERSION}"
  WriteRegStr HKLM "${UNINSTALL_KEY}" "Publisher"            "${PRODUCT_PUBLISHER}"
  WriteRegStr HKLM "${UNINSTALL_KEY}" "URLInfoAbout"         "${PRODUCT_WEB}"
  WriteRegStr HKLM "${UNINSTALL_KEY}" "InstallLocation"      "$INSTDIR"
  WriteRegStr HKLM "${UNINSTALL_KEY}" "DisplayIcon"          "$INSTDIR\${PRODUCT_EXE}"
  WriteRegStr HKLM "${UNINSTALL_KEY}" "UninstallString"      '"$INSTDIR\uninstall.exe"'
  WriteRegStr HKLM "${UNINSTALL_KEY}" "QuietUninstallString" '"$INSTDIR\uninstall.exe" /S'
  WriteRegDWORD HKLM "${UNINSTALL_KEY}" "NoModify" 1
  WriteRegDWORD HKLM "${UNINSTALL_KEY}" "NoRepair"  1

  ; Estimate installed size (~120 MB)
  WriteRegDWORD HKLM "${UNINSTALL_KEY}" "EstimatedSize" 122880

  ; ── Shortcuts ────────────────────────────────────────────
  CreateDirectory "$SMPROGRAMS\${PRODUCT_NAME}"
  CreateShortcut  "$SMPROGRAMS\${PRODUCT_NAME}\${PRODUCT_NAME}.lnk" \
                  "$INSTDIR\${PRODUCT_EXE}" "" "$INSTDIR\${PRODUCT_EXE}" 0
  CreateShortcut  "$SMPROGRAMS\${PRODUCT_NAME}\Удалить ${PRODUCT_NAME}.lnk" \
                  "$INSTDIR\uninstall.exe"
  CreateShortcut  "$DESKTOP\${PRODUCT_NAME}.lnk" \
                  "$INSTDIR\${PRODUCT_EXE}" "" "$INSTDIR\${PRODUCT_EXE}" 0

  ; ── Write uninstaller ────────────────────────────────────
  WriteUninstaller "$INSTDIR\uninstall.exe"

  ; ── Optional: install ADB silently if not present ────────
  Call CheckADB
SectionEnd

; ============================================================
;  HELPER: check ADB
; ============================================================

Function CheckADB
  nsExec::ExecToStack 'cmd /C where adb >nul 2>&1'
  Pop $0
  ${If} $0 != "0"
    MessageBox MB_YESNO|MB_ICONINFORMATION \
      "ADB (Android Debug Bridge) не найден.$\r$\n$\r$\nДля работы с Android/VR устройствами необходимо установить Android Platform Tools.$\r$\n$\r$\nОткрыть страницу загрузки сейчас?" \
      IDYES adb_open IDNO adb_skip
    adb_open:
      ExecShell "open" "https://developer.android.com/studio/releases/platform-tools"
    adb_skip:
  ${EndIf}
FunctionEnd

; ============================================================
;  UNINSTALL SECTION
; ============================================================

Section "Uninstall"
  ; Kill running instance
  nsExec::ExecToStack 'taskkill /F /IM "${PRODUCT_EXE}"'

  ; Files
  Delete "$INSTDIR\${PRODUCT_EXE}"
  Delete "$INSTDIR\*.dll"
  Delete "$INSTDIR\uninstall.exe"
  Delete "$INSTDIR\LICENSE.txt"
  RMDir /r "$INSTDIR\resources"
  RMDir "$INSTDIR"

  ; Shortcuts
  Delete "$SMPROGRAMS\${PRODUCT_NAME}\*.lnk"
  RMDir  "$SMPROGRAMS\${PRODUCT_NAME}"
  Delete "$DESKTOP\${PRODUCT_NAME}.lnk"

  ; Registry
  DeleteRegKey HKLM "${UNINSTALL_KEY}"
  DeleteRegKey HKLM "${REGKEY}"

  ; User data prompt
  MessageBox MB_YESNO|MB_ICONQUESTION \
    "Удалить папку с кэшем и настройками приложения?$\r$\n$APPDATA\${PRODUCT_NAME}" \
    IDNO no_userdata
    RMDir /r "$APPDATA\${PRODUCT_NAME}"
  no_userdata:

  MessageBox MB_OK|MB_ICONINFORMATION \
    "${PRODUCT_NAME} успешно удалён с вашего компьютера."
SectionEnd
