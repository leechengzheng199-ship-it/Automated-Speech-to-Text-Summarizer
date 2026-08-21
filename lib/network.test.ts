import assert from "node:assert/strict";
import test from "node:test";

import { describeNetworkError, downloadProtocols, isNetworkFetchError } from "./network.ts";

test("downloadProtocols prefers HTTP for Qiniu test CDN hosts", () => {
  assert.deepEqual(downloadProtocols("https://tk2mrtelh.hd-bkt.clouddn.com"), ["http", "https"]);
  assert.deepEqual(downloadProtocols("file.qiniucdn.com"), ["http", "https"]);
});

test("downloadProtocols prefers HTTPS for custom domains", () => {
  assert.deepEqual(downloadProtocols("https://audio.example.com"), ["https", "http"]);
  assert.deepEqual(downloadProtocols("audio.example.com"), ["https", "http"]);
});

test("describeNetworkError unwraps undici TLS cause", () => {
  const error = new TypeError("fetch failed", {
    cause: Object.assign(new Error("Hostname/IP does not match certificate's altnames"), {
      code: "ERR_TLS_CERT_ALTNAME_INVALID",
    }),
  });
  assert.equal(isNetworkFetchError(error), true);
  assert.match(describeNetworkError(error), /ERR_TLS_CERT_ALTNAME_INVALID/);
  assert.match(describeNetworkError(error), /certificate's altnames/);
});
