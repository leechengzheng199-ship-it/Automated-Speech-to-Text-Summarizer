export const VIDEO_CONTAINER_EXTENSIONS = [".mp4", ".webm", ".mov", ".mkv", ".avi"] as const;
export const LOSSLESS_AUDIO_EXTENSIONS = [".wav", ".flac"] as const;

export type PrepareAction = "direct" | "extract" | "compress";

export function getExtension(fileName: string) {
  const index = fileName.lastIndexOf(".");
  return index >= 0 ? fileName.slice(index).toLowerCase() : "";
}

export function getPrepareAction(fileName: string): PrepareAction {
  const ext = getExtension(fileName);
  if ((VIDEO_CONTAINER_EXTENSIONS as readonly string[]).includes(ext)) return "extract";
  if ((LOSSLESS_AUDIO_EXTENSIONS as readonly string[]).includes(ext)) return "compress";
  return "direct";
}

export function predictedOutputName(fileName: string, action: PrepareAction) {
  if (action === "direct") return fileName;
  const base = fileName.replace(/\.[^.]+$/, "") || "audio";
  const ext = getExtension(fileName);
  if (action === "extract" && ext === ".webm") return `${base}.webm`;
  if (action === "extract") return `${base}.aac`;
  return `${base}.m4a`;
}

export function needsLocalPrepare(fileName: string) {
  return getPrepareAction(fileName) !== "direct";
}

export function isIsoBmffContainer(fileName: string) {
  const ext = getExtension(fileName);
  return ext === ".mp4" || ext === ".mov" || ext === ".m4a";
}
