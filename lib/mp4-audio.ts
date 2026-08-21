import { createFile } from "mp4box";

const CHUNK_BYTES = 16 * 1024 * 1024;
const SAMPLE_RATES = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000];

function tagBuffer(buffer: ArrayBuffer, fileStart: number) {
  const tagged = buffer as ArrayBuffer & { fileStart: number };
  tagged.fileStart = fileStart;
  return tagged;
}

function sampleRateIndex(rate: number) {
  const exact = SAMPLE_RATES.indexOf(rate);
  if (exact >= 0) return exact;
  let best = 4;
  let delta = Number.POSITIVE_INFINITY;
  for (const [index, value] of SAMPLE_RATES.entries()) {
    const next = Math.abs(value - rate);
    if (next < delta) {
      best = index;
      delta = next;
    }
  }
  return best;
}

function aacObjectType(codec: string) {
  const matched = codec.match(/mp4a\.40\.(\d+)/i);
  const type = matched ? Number(matched[1]) : 2;
  return Number.isFinite(type) && type >= 1 && type <= 31 ? type : 2;
}

function adtsHeader(frameLength: number, objectType: number, rate: number, channels: number) {
  const packet = frameLength + 7;
  const header = new Uint8Array(7);
  const profile = Math.min(Math.max(objectType, 1), 4);
  const rateIndex = sampleRateIndex(rate);
  const channelConfig = Math.min(Math.max(channels, 1), 7);
  header[0] = 0xff;
  header[1] = 0xf1;
  header[2] = ((profile - 1) << 6) | (rateIndex << 2) | ((channelConfig >> 2) & 1);
  header[3] = ((channelConfig & 3) << 6) | ((packet >> 11) & 3);
  header[4] = (packet >> 3) & 0xff;
  header[5] = ((packet & 7) << 5) | 0x1f;
  header[6] = 0xfc;
  return header;
}

export async function extractAacFromMp4(
  file: File,
  onProgress?: (ratio: number) => void,
): Promise<File | null> {
  const mp4 = createFile(false);
  const chunks: Uint8Array[] = [];
  let audioId: number | null = null;
  let objectType = 2;
  let sampleRate = 44100;
  let channels = 1;
  let codecSupported: boolean | null = null;

  mp4.onReady = (info) => {
    const track = info.audioTracks[0];
    if (!track?.codec || !/mp4a\.40/i.test(track.codec)) {
      codecSupported = false;
      return;
    }
    codecSupported = true;
    audioId = track.id;
    objectType = aacObjectType(track.codec);
    sampleRate = track.audio?.sample_rate || 44100;
    channels = track.audio?.channel_count || 1;
    mp4.setExtractionOptions(track.id, undefined, { nbSamples: 400 });
    mp4.start();
  };

  mp4.onSamples = (id, _user, samples) => {
    if (audioId !== id) return;
    for (const sample of samples) {
      if (!sample.data || sample.data.byteLength === 0) continue;
      const frame = sample.data.slice();
      chunks.push(adtsHeader(frame.byteLength, objectType, sampleRate, channels), frame);
    }
    const last = samples[samples.length - 1];
    if (last) mp4.releaseUsedSamples(id, last.number);
  };

  let offset = 0;
  let steps = 0;
  while (offset < file.size && steps < 100_000 && codecSupported !== false) {
    const end = Math.min(offset + CHUNK_BYTES, file.size);
    const buffer = tagBuffer(await file.slice(offset, end).arrayBuffer(), offset);
    const next = mp4.appendBuffer(buffer as never);
    onProgress?.(Math.min(0.99, end / file.size));
    offset = typeof next === "number" ? next : end;
    steps += 1;
  }
  mp4.flush();
  mp4.stop();

  if (codecSupported === false || chunks.length === 0) return null;
  onProgress?.(1);
  return new File(chunks, file.name.replace(/\.[^.]+$/, "") + ".aac", { type: "audio/aac" });
}
