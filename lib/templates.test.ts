import assert from "node:assert/strict";
import test from "node:test";

import { parseTemplateInput } from "./templates.ts";

test("parseTemplateInput requires name, prompt and at least one complete section", () => {
  assert.throws(() => parseTemplateInput({}), /模板名称/);
  assert.throws(
    () => parseTemplateInput({ name: "A", systemPrompt: "B", sections: [] }),
    /总结章节/,
  );
  const parsed = parseTemplateInput({
    name: " 客户访谈 ",
    description: " 每周 ",
    systemPrompt: " 用中文，不要编造。 ",
    sections: [{ title: " 诉求 ", instruction: " 列出明确提出的需求。 ", format: "bullets" }],
  });
  assert.equal(parsed.name, "客户访谈");
  assert.equal(parsed.sections[0].format, "bullets");
  assert.equal(parsed.sections[0].title, "诉求");
});
