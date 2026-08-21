import qiniu from "qiniu";

import {
  describeNetworkError,
  downloadProtocols,
  hostFromDomain,
  isNetworkFetchError,
} from "@/lib/network";
import { QINIU_LIMITS, QINIU_UPLOAD_HOSTS } from "@/lib/types";

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
    settings.accessKey && settings.secretKey && settings.bucket && settings.domain,
  );
}

function mac(settings: QiniuSettings) {
  return new qiniu.auth.digest.Mac(settings.accessKey, settings.secretKey);
}

function buildAudioUrlWithProtocol(
  settings: QiniuSettings,
  key: string,
  protocol: "http" | "https",
) {
  const domain = `${protocol}://${hostFromDomain(settings.domain)}`;
  const manager = new qiniu.rs.BucketManager(mac(settings), new qiniu.conf.Config());
  const deadline = Math.floor(Date.now() / 1000) + 60 * 60 * 24;
  return manager.privateDownloadUrl(domain, key, deadline);
}

export function getUploadHost(region: string) {
  return QINIU_UPLOAD_HOSTS[region] ?? QINIU_UPLOAD_HOSTS.z0;
}

export function createUploadToken(settings: QiniuSettings, key: string) {
  const putPolicy = new qiniu.rs.PutPolicy({
    scope: `${settings.bucket}:${key}`,
    expires: 4 * 3600,
    fsizeLimit: QINIU_LIMITS.maxUploadBytes,
    returnBody: '{"key":$(key),"hash":$(etag),"size":$(fsize)}',
  });
  return putPolicy.uploadToken(mac(settings));
}

export function buildAudioUrl(settings: QiniuSettings, key: string) {
  return buildAudioUrlWithProtocol(settings, key, downloadProtocols(settings.domain)[0]);
}

export async function downloadQiniuObject(settings: QiniuSettings, key: string) {
  const protocols = downloadProtocols(settings.domain);
  let lastNetworkError: unknown;

  for (const [index, protocol] of protocols.entries()) {
    const url = buildAudioUrlWithProtocol(settings, key, protocol);
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(
          `无法从七牛下载音频（HTTP ${response.status}）。请确认 AccessKey 有权限，并检查测试域名是否过期或开启了防盗链。`,
        );
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      const fileName = key.split("/").pop() || "audio.bin";
      return {
        buffer,
        fileName,
        contentType: response.headers.get("content-type") || "application/octet-stream",
      };
    } catch (error) {
      if (!isNetworkFetchError(error)) throw error;
      lastNetworkError = error;
      if (index === protocols.length - 1) {
        throw new Error(`无法从七牛下载音频：${describeNetworkError(lastNetworkError)}`);
      }
    }
  }

  throw new Error(`无法从七牛下载音频：${describeNetworkError(lastNetworkError)}`);
}
