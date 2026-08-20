export const JOB_STATUSES = [
  "queued",
  "uploaded",
  "transcribing",
  "summarizing",
  "done",
  "failed",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export type SectionFormat = "paragraph" | "bullets" | "table";

export type TemplateSection = {
  id: string;
  title: string;
  instruction: string;
  format: SectionFormat;
};

export const QINIU_REGIONS = [
  { value: "z0", label: "华东-浙江" },
  { value: "z1", label: "华北-河北" },
  { value: "z2", label: "华南-广东" },
  { value: "na0", label: "北美" },
  { value: "as0", label: "东南亚" },
  { value: "cn-east-2", label: "华东-浙江2" },
] as const;

export const MASKED_SECRET = "********";

export const QINIU_LIMITS = {
  maxFileBytes: 512 * 1024 * 1024,
  maxDurationMs: 5 * 60 * 60 * 1000,
  supportedExtensions: [".wav", ".ogg", ".mp3", ".mp4", ".m4a", ".webm", ".aac", ".flac"],
  nativeAsrExtensions: [".wav", ".ogg", ".mp3", ".mp4"],
} as const;
