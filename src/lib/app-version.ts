import packageJson from '../../package.json';

/**
 * Single Source of Truth versi aplikasi Web WMVAA AI Grader Pro.
 * Otomatis berubah mengikuti field "version" di package.json setiap kali diperbarui.
 */
export const APP_VERSION = packageJson.version;

/**
 * Metadata rilis APK Android resmi yang dipublikasikan.
 */
export const ANDROID_APK_RELEASE = {
  version: '2.0.9',
  sizeLabel: '3.26 MB',
  downloadUrl:
    'https://github.com/AiWerek-Tech/ai-grader-pro-mobile/releases/download/v2.0.9/wmvaa-ai-grader-pro-v2.0.9-android.apk',
  releaseUrl:
    'https://github.com/AiWerek-Tech/ai-grader-pro-mobile/releases/tag/v2.0.9',
} as const;

export const WEB_REPO_URL = 'https://github.com/AiWerek-Tech/ai-grader-pro';
