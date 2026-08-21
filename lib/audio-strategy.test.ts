import assert from "node:assert/strict";
import test from "node:test";

import {
  getPrepareAction,
  needsLocalPrepare,
  predictedOutputName,
} from "./audio-strategy.ts";

test("videos extract audio instead of uploading the whole file", () => {
  assert.equal(getPrepareAction("屏幕录制.mp4"), "extract");
  assert.equal(getPrepareAction("talk.webm"), "extract");
  assert.equal(predictedOutputName("屏幕录制.mp4", "extract"), "屏幕录制.aac");
  assert.equal(needsLocalPrepare("a.mp4"), true);
});

test("lossless audio is compressed, already-compressed audio is uploaded as-is", () => {
  assert.equal(getPrepareAction("meeting.wav"), "compress");
  assert.equal(getPrepareAction("meeting.flac"), "compress");
  assert.equal(getPrepareAction("meeting.mp3"), "direct");
  assert.equal(getPrepareAction("meeting.m4a"), "direct");
  assert.equal(predictedOutputName("meeting.wav", "compress"), "meeting.m4a");
});
