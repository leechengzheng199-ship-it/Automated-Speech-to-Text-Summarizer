export const VIDEO_CONTAINER_EXTENSIONS = [".mp4", ".webm", ".mov", ".mkv", ".avi"] as const;
export const LOSSLESS_AUDIO_EXTENSIONS = [".wav", ".flac"] as const;

export type PrepareAction = "direct" | "extract" | "compress";

export function getExtension(fileName: string) {
  const index = fileName.lastIndexOf(".");
  return index >= 0 ? fileName.slice(index).toLowerCase() : "";
}

export function shouldCompressAudio(fileSize: number, durationMs: number | null = null) {
  if (fileSize > 20 * 1024 * 1024) return true;
  if (durationMs && durationMs >= 1000) {
    return fileSize / (durationMs / 1000) > 4000;
  }
  return false;
}

export function getPrepareAction(fileName: string, fileSize = 0, durationMs: number | null = null): PrepareAction {
  const ext = getExtension(fileName);
  if ((VIDEO_CONTAINER_EXTENSIONS as readonly string[]).includes(ext)) return "extract";
  if ((LOSSLESS_AUDIO_EXTENSIONS as readonly string[]).includes(ext)) return "compress";
  if (shouldCompressAudio(fileSize, durationMs)) return "compress";
  return "direct";
}

export function predictedOutputName(fileName: string, action: PrepareAction) {
  if (action === "direct") return fileName;
  const base = fileName.replace(/\.[^.]+$/, "") || "audio";
  return `${base}.m4a`;
}

export function needsLocalPrepare(fileName: string, fileSize = 0, durationMs: number | null = null) {
  return getPrepareAction(fileName, fileSize, durationMs) !== "direct";
}

export function isIsoBmffContainer(fileName: string) {
  const ext = getExtension(fileName);
  return ext === ".mp4" || ext === ".mov" || ext === ".m4a";
}
