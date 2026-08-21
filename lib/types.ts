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

export const QINIU_UPLOAD_HOSTS: Record<string, string> = {
  z0: "https://upload.qiniup.com",
  z1: "https://upload-z1.qiniup.com",
  z2: "https://upload-z2.qiniup.com",
  na0: "https://upload-na0.qiniup.com",
  as0: "https://upload-as0.qiniup.com",
  "cn-east-2": "https://upload-cn-east-2.qiniup.com",
};

export const QINIU_LIMITS = {
  maxFileBytes: 2 * 1024 * 1024 * 1024 - 1,
  maxDurationMs: 12 * 60 * 60 * 1000,
  maxFileLabel: "2GB",
  maxDurationLabel: "12 小时",
  supportedExtensions: [".wav", ".ogg", ".mp3", ".mp4", ".m4a", ".webm", ".aac", ".flac"],
} as const;
