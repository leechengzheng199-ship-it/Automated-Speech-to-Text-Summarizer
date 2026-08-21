import assert from "node:assert/strict";
import test from "node:test";

import {
  getPrepareAction,
  needsLocalPrepare,
  predictedOutputName,
  shouldCompressAudio,
} from "./audio-strategy.ts";

test("videos extract audio instead of uploading the whole file", () => {
  assert.equal(getPrepareAction("屏幕录制.mp4"), "extract");
  assert.equal(getPrepareAction("talk.webm"), "extract");
  assert.equal(predictedOutputName("屏幕录制.mp4", "extract"), "屏幕录制.m4a");
  assert.equal(needsLocalPrepare("a.mp4"), true);
});

test("lossless and oversized compressed audio are compressed", () => {
  assert.equal(getPrepareAction("meeting.wav"), "compress");
  assert.equal(getPrepareAction("meeting.flac"), "compress");
  assert.equal(getPrepareAction("meeting.mp3"), "direct");
  assert.equal(getPrepareAction("meeting.m4a"), "direct");
  assert.equal(getPrepareAction("meeting.mp3", 30 * 1024 * 1024), "compress");
  assert.equal(predictedOutputName("meeting.wav", "compress"), "meeting.m4a");
  assert.equal(shouldCompressAudio(5 * 1024 * 1024, 60_000), true);
  assert.equal(shouldCompressAudio(200_000, 60_000), false);
});
