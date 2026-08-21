import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

import { extractAacFromMp4 } from "@/lib/mp4-audio";
import {
  getExtension,
  getPrepareAction,
  isIsoBmffContainer,
  needsLocalPrepare,
  shouldRecompressExtracted,
  type PrepareAction,
} from "@/lib/audio-strategy";

export { getPrepareAction, needsLocalPrepare } from "@/lib/audio-strategy";

export function needsTranscode(fileName: string, fileSize = 0) {
  return needsLocalPrepare(fileName, fileSize);
}

const FFMPEG_SAFE_BYTES = 380 * 1024 * 1024;

export async function readMediaDurationMs(file: File) {
  return new Promise<number | null>((resolve) => {
    const url = URL.createObjectURL(file);
    const element = document.createElement("video");
    element.preload = "metadata";
    element.onloadedmetadata = () => {
      const duration = Number.isFinite(element.duration) ? Math.round(element.duration * 1000) : null;
      URL.revokeObjectURL(url);
      resolve(duration);
    };
    element.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    element.src = url;
  });
}

let ffmpegLoader: Promise<FFmpeg> | null = null;
let ffmpegLock: Promise<void> = Promise.resolve();

async function loadFfmpeg() {
  if (!ffmpegLoader) {
    ffmpegLoader = (async () => {
      const base = `${window.location.origin}/ffmpeg`;
      try {
        const ffmpeg = new FFmpeg();
        await ffmpeg.load({
          coreURL: `${base}/ffmpeg-core.js`,
          wasmURL: `${base}/ffmpeg-core.wasm`,
        });
        return ffmpeg;
      } catch {
        const ffmpeg = new FFmpeg();
        const { toBlobURL } = await import("@ffmpeg/util");
        await ffmpeg.load({
          coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
          wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm"),
        });
        return ffmpeg;
      }
    })();
  }
  return ffmpegLoader;
}

export function preloadFfmpeg(fileName: string, fileSize = 0) {
  if (getPrepareAction(fileName, fileSize) === "compress") {
    void loadFfmpeg();
  }
}

function withFfmpeg<T>(fn: (ffmpeg: FFmpeg) => Promise<T>) {
  const run = ffmpegLock.then(async () => fn(await loadFfmpeg()));
  ffmpegLock = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function copyBytes(data: Uint8Array) {
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  return copy;
}

async function runFfmpeg(params: {
  file: File;
  args: string[];
  outputName: string;
  outputType: string;
  onProgress?: (ratio: number) => void;
}) {
  if (params.file.size > FFMPEG_SAFE_BYTES) {
    throw new Error("文件较大，浏览器无法在本地转码。请先导出为 mp3 / m4a 后再上传。");
  }

  return withFfmpeg(async (ffmpeg) => {
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const inputName = `in-${stamp}${getExtension(params.file.name) || ".bin"}`;
    const outputName = `${stamp}-${params.outputName}`;
    const onProgress = ({ progress }: { progress: number }) => {
      params.onProgress?.(Math.min(0.99, Math.max(0, progress)));
    };

    await ffmpeg.writeFile(inputName, await fetchFile(params.file));
    ffmpeg.on("progress", onProgress);
    try {
      const code = await ffmpeg.exec(["-hide_banner", "-loglevel", "error", "-threads", "1", "-i", inputName, ...params.args, outputName]);
      if (code !== 0) {
        throw new Error("音频转码失败。");
      }
      const data = await ffmpeg.readFile(outputName);
      const bytes = data instanceof Uint8Array ? copyBytes(data) : new TextEncoder().encode(String(data));
      params.onProgress?.(1);
      return new File([bytes], params.file.name.replace(/\.[^.]+$/, "") + getExtension(params.outputName), {
        type: params.outputType,
      });
    } finally {
      ffmpeg.off("progress", onProgress);
      await ffmpeg.deleteFile(inputName).catch(() => undefined);
      await ffmpeg.deleteFile(outputName).catch(() => undefined);
    }
  });
}

async function remuxAudioTrack(file: File, onLog?: (message: string) => void, onProgress?: (ratio: number) => void) {
  const ext = getExtension(file.name);
  const outputName = ext === ".webm" ? "output.webm" : "output.m4a";
  const outputType = ext === ".webm" ? "audio/webm" : "audio/mp4";
  onLog?.("正在剥离视频、只保留音轨…");
  return runFfmpeg({
    file,
    args: ["-map", "0:a:0", "-vn", "-c:a", "copy"],
    outputName,
    outputType,
    onProgress,
  });
}

async function compressToSpeechAac(file: File, onLog?: (message: string) => void, onProgress?: (ratio: number) => void) {
  onLog?.("正在压缩为 16kHz 单声道 24kbps AAC…");
  try {
    return await runFfmpeg({
      file,
      args: ["-map", "0:a:0", "-vn", "-ac", "1", "-ar", "16000", "-c:a", "aac", "-b:a", "24k", "-movflags", "+faststart"],
      outputName: "output.m4a",
      outputType: "audio/mp4",
      onProgress,
    });
  } catch {
    onLog?.("正在压缩为 16kHz 单声道 24kbps mp3…");
    return runFfmpeg({
      file,
      args: ["-map", "0:a:0", "-vn", "-ac", "1", "-ar", "16000", "-c:a", "libmp3lame", "-b:a", "24k", "-compression_level", "7"],
      outputName: "output.mp3",
      outputType: "audio/mpeg",
      onProgress,
    });
  }
}

function canRecompress(file: File) {
  return file.size <= FFMPEG_SAFE_BYTES;
}

async function resolveDuration(durationMs?: number | null | Promise<number | null>) {
  if (durationMs == null) return null;
  return durationMs;
}

export async function prepareUploadFile(
  file: File,
  onLog?: (message: string) => void,
  onProgress?: (ratio: number) => void,
  durationMs?: number | null | Promise<number | null>,
): Promise<File> {
  const sizeOnlyAction: PrepareAction = getPrepareAction(file.name, file.size);

  try {
    if (sizeOnlyAction === "extract") {
      let extracted: File | null = null;
      if (isIsoBmffContainer(file.name)) {
        onLog?.("正在从视频中提取音轨…");
        extracted = await extractAacFromMp4(file, (ratio) => onProgress?.(ratio * 0.7));
      }
      const duration = await resolveDuration(durationMs);
      if (!extracted && canRecompress(file)) {
        extracted = await remuxAudioTrack(file, onLog, (ratio) => onProgress?.(ratio * 0.7));
      }
      if (!extracted) {
        throw new Error("无法从视频中提取音轨。");
      }
      if (canRecompress(extracted) && shouldRecompressExtracted(extracted.size, duration)) {
        return compressToSpeechAac(extracted, onLog, (ratio) => onProgress?.(0.7 + ratio * 0.3));
      }
      onLog?.("音轨已足够小，跳过二次压缩。");
      onProgress?.(1);
      return extracted;
    }

    const duration = await resolveDuration(durationMs);
    const action: PrepareAction = getPrepareAction(file.name, file.size, duration);
    if (action === "direct") {
      onProgress?.(1);
      return file;
    }

    if (!canRecompress(file)) {
      throw new Error("文件较大，浏览器无法在本地转码。");
    }
    return compressToSpeechAac(file, onLog, onProgress);
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `${error.message} 请先将文件转为较小的 mp3/m4a 后再上传。`
        : "转码失败，请先将文件转为较小的 mp3/m4a 后再上传。",
    );
  }
}
