const fs = require("fs");
const path = require("path");

const coreJs = require.resolve("@ffmpeg/core");
const umdDir = path.dirname(coreJs);
const destDir = path.join(__dirname, "..", "public", "ffmpeg");

fs.mkdirSync(destDir, { recursive: true });
for (const file of ["ffmpeg-core.js", "ffmpeg-core.wasm"]) {
  fs.copyFileSync(path.join(umdDir, file), path.join(destDir, file));
}

