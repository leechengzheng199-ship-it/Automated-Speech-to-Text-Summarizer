import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

import { extractAacFromMp4 } from "@/lib/mp4-audio";
import {
  getExtension,
  getPrepareAction,
  isIsoBmffContainer,
  needsLocalPrepare,
  type PrepareAction,
} from "@/lib/audio-strategy";

export { getPrepareAction, needsLocalPrepare } from "@/lib/audio-strategy";

export function needsTranscode(fileName: string) {
  return needsLocalPrepare(fileName);
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

export function preloadFfmpeg(fileName: string) {
  const action = getPrepareAction(fileName);
  if (action === "compress" || (action === "extract" && !isIsoBmffContainer(fileName))) {
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
  onLog?.("正在压缩为 16kHz 单声道 AAC…");
  try {
    return await runFfmpeg({
      file,
      args: ["-map", "0:a:0", "-vn", "-ac", "1", "-ar", "16000", "-c:a", "aac", "-b:a", "48k", "-movflags", "+faststart"],
      outputName: "output.m4a",
      outputType: "audio/mp4",
      onProgress,
    });
  } catch {
    onLog?.("正在压缩为 16kHz 单声道 mp3…");
    return runFfmpeg({
      file,
      args: ["-map", "0:a:0", "-vn", "-ac", "1", "-ar", "16000", "-c:a", "libmp3lame", "-b:a", "48k", "-compression_level", "7"],
      outputName: "output.mp3",
      outputType: "audio/mpeg",
      onProgress,
    });
  }
}

function tooPcmLike(file: File, durationMs: number | null) {
  if (!durationMs || durationMs < 1000) return file.size > 40 * 1024 * 1024;
  return file.size / (durationMs / 1000) > 40_000;
}

export async function prepareUploadFile(
  file: File,
  onLog?: (message: string) => void,
  onProgress?: (ratio: number) => void,
  durationMs?: number | null,
): Promise<File> {
  const action: PrepareAction = getPrepareAction(file.name);

  if (action === "direct") {
    onProgress?.(1);
    return file;
  }

  try {
    if (action === "extract" && isIsoBmffContainer(file.name)) {
      onLog?.("正在从视频中提取音轨…");
      const extracted = await extractAacFromMp4(file, onProgress);
      if (extracted) {
        if (tooPcmLike(extracted, durationMs ?? null)) {
          return compressToSpeechAac(extracted, onLog, onProgress);
        }
        return extracted;
      }
    }

    if (action === "extract") {
      try {
        const remuxed = await remuxAudioTrack(file, onLog, onProgress);
        if (tooPcmLike(remuxed, durationMs ?? null)) {
          return compressToSpeechAac(remuxed, onLog, onProgress);
        }
        return remuxed;
      } catch {
        return compressToSpeechAac(file, onLog, onProgress);
      }
    }

    return compressToSpeechAac(file, onLog, onProgress);
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `${error.message} 请先将文件转为 mp3/m4a 后再上传。`
        : "转码失败，请先将文件转为 mp3/m4a 后再上传。",
    );
  }
}
