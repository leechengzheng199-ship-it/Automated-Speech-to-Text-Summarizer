const BLOCK_SIZE = 4 * 1024 * 1024;
const CONCURRENCY = 4;

function urlSafeBase64(text: string) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_");
}

async function postBinary(url: string, token: string, body: Blob | string, contentType: string) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `UpToken ${token}`,
      "Content-Type": contentType,
    },
    body,
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(text.slice(0, 300) || `上传失败（HTTP ${response.status}）`);
  }
  return text;
}

async function mkblk(uploadUrl: string, token: string, chunk: Blob) {
  const host = uploadUrl.replace(/\/+$/, "");
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const text = await postBinary(`${host}/mkblk/${chunk.size}`, token, chunk, "application/octet-stream");
      const parsed = JSON.parse(text) as { ctx?: string };
      if (!parsed.ctx) throw new Error("七牛分片上传未返回 ctx。");
      return parsed.ctx;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("分片上传失败。");
    }
  }
  throw lastError ?? new Error("分片上传失败。");
}

async function mapPool<T, R>(items: T[], limit: number, worker: (item: T, index: number) => Promise<R>) {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  return results;
}

function uploadByForm(params: {
  file: File;
  token: string;
  key: string;
  uploadUrl: string;
  onProgress: (ratio: number) => void;
}) {
  return new Promise<void>((resolve, reject) => {
    const form = new FormData();
    form.append("token", params.token);
    form.append("key", params.key);
    form.append("file", params.file);

    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) params.onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      reject(new Error(xhr.responseText.slice(0, 300) || `上传失败（HTTP ${xhr.status}）`));
    };
    xhr.onerror = () => reject(new Error("上传到七牛云时网络出错。"));
    xhr.open("POST", params.uploadUrl);
    xhr.send(form);
  });
}

async function uploadByChunks(params: {
  file: File;
  token: string;
  key: string;
  uploadUrl: string;
  onProgress: (ratio: number) => void;
}) {
  const blockCount = Math.ceil(params.file.size / BLOCK_SIZE);
  const blocks = Array.from({ length: blockCount }, (_, index) => index);
  let uploaded = 0;

  const ctxs = await mapPool(blocks, CONCURRENCY, async (index) => {
    const start = index * BLOCK_SIZE;
    const chunk = params.file.slice(start, Math.min(start + BLOCK_SIZE, params.file.size));
    const ctx = await mkblk(params.uploadUrl, params.token, chunk);
    uploaded += chunk.size;
    params.onProgress(Math.min(0.99, uploaded / params.file.size));
    return ctx;
  });

  const host = params.uploadUrl.replace(/\/+$/, "");
  const keyToken = urlSafeBase64(params.key);
  await postBinary(
    `${host}/mkfile/${params.file.size}/key/${keyToken}`,
    params.token,
    ctxs.join(","),
    "text/plain",
  );
  params.onProgress(1);
}

export async function uploadToQiniu(params: {
  file: File;
  token: string;
  key: string;
  uploadUrl: string;
  onProgress: (ratio: number) => void;
}) {
  if (params.file.size <= BLOCK_SIZE) {
    await uploadByForm(params);
    return;
  }
  await uploadByChunks(params);
}
