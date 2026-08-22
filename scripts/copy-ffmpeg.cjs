// ffmpeg.wasm is loaded from jsDelivr CDN (see lib/audio-client.ts).
// Do not copy the ~31MB wasm into public/ — Cloudflare Workers assets max out at 25 MiB.
console.log("skip local ffmpeg copy; using CDN @ffmpeg/core@0.12.10");
