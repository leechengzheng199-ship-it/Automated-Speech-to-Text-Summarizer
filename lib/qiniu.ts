/**
 * Qiniu Kodo upload tokens and long-speech recognition (LASR).
 * Real AK/SK signing will be wired in a later iteration.
 */

export type QiniuSettings = {
  accessKey: string;
  secretKey: string;
  bucket: string;
  domain: string;
  region: string;
  isPrivate: boolean;
};

export function isQiniuConfigured(settings: QiniuSettings) {
  return Boolean(
    settings.accessKey &&
      settings.secretKey &&
      settings.bucket &&
      settings.domain,
  );
}

export function createUploadToken(_settings: QiniuSettings, _key: string): string {
  throw new Error("七牛上传凭证尚未接入，请等待后续迭代。");
}

export function buildAudioUrl(_settings: QiniuSettings, _key: string): string {
  throw new Error("七牛资源 URL 尚未接入，请等待后续迭代。");
}

export async function submitLasrTask(_params: {
  settings: QiniuSettings;
  audioUrl: string;
  fileName: string;
}): Promise<{ taskId: string }> {
  throw new Error("七牛长语音识别尚未接入，请等待后续迭代。");
}

export async function queryLasrTask(_params: {
  settings: QiniuSettings;
  taskId: string;
}): Promise<{ statusCode: number; statusText: string; resultText?: string; detail?: unknown }> {
  throw new Error("七牛转写查询尚未接入，请等待后续迭代。");
}
