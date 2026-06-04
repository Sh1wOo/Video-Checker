# Video Scanner Team Work NPC

Desktop scanner for local video quality control, short scenario review, corrupt video detection, and AI-style operational dashboards.

## YOLO AI Integration

The backend AI analysis can now use a local YOLO-based model for behavior detection. To enable it:

- install Python 3 and the `ultralytics` package
- set the `YOLO_MODEL_PATH` environment variable to your YOLO11 model file
- keep the model file accessible from the Tauri backend process

If `YOLO_MODEL_PATH` is not set or Python is unavailable, the analyzer will fall back to the existing heuristic logic.

## Trusted Build Notes

Windows, browsers, and antivirus systems do not fully trust unsigned desktop installers. To reduce warnings in production builds, release builds should be signed with a real code-signing certificate owned by the publisher.

Recommended release checklist:

- Build only from a clean machine or CI runner.
- Keep the app identifier and product name stable between releases.
- Sign the Windows installer and executable with an Authenticode code-signing certificate.
- Add a trusted timestamp server during signing so the signature remains valid after certificate renewal.
- Distribute downloads through HTTPS from the official domain.
- Submit the signed installer to Microsoft Defender SmartScreen reputation review after the first release.

Unsigned local builds can still show warnings even when the application is safe. This project keeps scanning local-only and does not require external media tools for video analysis.
