"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  builtinDefaultsFor,
  defaultNewTemplate,
  newSection,
  SECTION_FORMATS,
} from "@/lib/templates";
import type { SectionFormat, TemplateSection } from "@/lib/types";

export type TemplateRecord = {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  outputLanguage: string;
  isBuiltin: boolean;
  sections: TemplateSection[];
};

type Draft = {
  name: string;
  description: string;
  systemPrompt: string;
  sections: TemplateSection[];
};

function formatLabel(format: SectionFormat) {
  return SECTION_FORMATS.find((item) => item.value === format)?.label ?? format;
}

function toDraft(template: TemplateRecord): Draft {
  return {
    name: template.name,
    description: template.description,
    systemPrompt: template.systemPrompt,
    sections: template.sections.map((section) => ({ ...section })),
  };
}

async function readError(response: Response) {
  try {
    const data = (await response.json()) as { error?: string };
    return data.error || `请求失败（HTTP ${response.status}）`;
  } catch {
    return `请求失败（HTTP ${response.status}）`;
  }
}

function TemplateCard({
  template,
  editing,
  canDelete,
  onEdit,
  onClose,
  onChanged,
}: {
  template: TemplateRecord;
  editing: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(template));
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [message, setMessage] = useState("");
  const canReset = template.isBuiltin && Boolean(builtinDefaultsFor(template.name));

  function beginEdit() {
    setDraft(toDraft(template));
    setStatus("idle");
    setMessage("");
    onEdit();
  }

  function cancel() {
    setDraft(toDraft(template));
    setStatus("idle");
    setMessage("");
    onClose();
  }

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setStatus("idle");
    setMessage("");
  }

  function updateSection(index: number, patch: Partial<TemplateSection>) {
    setDraft((current) => ({
      ...current,
      sections: current.sections.map((section, i) => (i === index ? { ...section, ...patch } : section)),
    }));
    setStatus("idle");
    setMessage("");
  }

  function moveSection(index: number, direction: -1 | 1) {
    const next = index + direction;
    if (next < 0 || next >= draft.sections.length) return;
    setDraft((current) => {
      const sections = [...current.sections];
      const [item] = sections.splice(index, 1);
      sections.splice(next, 0, item);
      return { ...current, sections };
    });
  }

  async function save(payload?: Draft | { reset: true }) {
    setStatus("saving");
    setMessage("");
    try {
      const response = await fetch(`/api/templates/${template.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload ?? { ...draft, outputLanguage: template.outputLanguage }),
      });
      if (!response.ok) throw new Error(await readError(response));
      await onChanged();
      onClose();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "保存失败。");
    }
  }

  async function remove() {
    if (!canDelete) return;
    if (!window.confirm(`确定删除「${draft.name}」？`)) return;
    setStatus("saving");
    try {
      const response = await fetch(`/api/templates/${template.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await readError(response));
      await onChanged();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "删除失败。");
    }
  }

  return (
    <Card className={editing ? "md:col-span-2" : undefined}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle>{editing ? draft.name || "未命名模板" : template.name}</CardTitle>
              {template.isBuiltin ? <Badge variant="secondary">内置</Badge> : <Badge variant="outline">自定义</Badge>}
            </div>
            {!editing ? (
              <CardDescription className="mt-1">{template.description || "未填写说明"}</CardDescription>
            ) : null}
          </div>
          {!editing ? (
            <Button type="button" variant="outline" size="sm" onClick={beginEdit}>
              编辑
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {!editing ? (
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            {template.sections.map((section) => (
              <li key={section.id}>
                <span className="font-medium">{section.title}</span>
                <span className="text-muted-foreground"> · {formatLabel(section.format)}</span>
                <p className="mt-0.5 text-muted-foreground">{section.instruction}</p>
              </li>
            ))}
          </ol>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label className="mb-1.5 block">名称</Label>
                <Input value={draft.name} onChange={(event) => update("name", event.target.value)} />
              </div>
              <div>
                <Label className="mb-1.5 block">说明</Label>
                <Input
                  value={draft.description}
                  onChange={(event) => update("description", event.target.value)}
                  placeholder="什么时候用这个模板"
                />
              </div>
            </div>

            <div>
              <Label className="mb-1.5 block">总体要求</Label>
              <Textarea
                value={draft.systemPrompt}
                onChange={(event) => update("systemPrompt", event.target.value)}
                className="min-h-20"
              />
            </div>

            <div className="space-y-2">
              {draft.sections.map((section, index) => (
                <div key={section.id} className="grid gap-2 rounded-md border p-3 md:grid-cols-[1fr_120px_auto]">
                  <Input
                    value={section.title}
                    onChange={(event) => updateSection(index, { title: event.target.value })}
                    placeholder="章节标题"
                  />
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                    value={section.format}
                    onChange={(event) => updateSection(index, { format: event.target.value as SectionFormat })}
                  >
                    {SECTION_FORMATS.map((format) => (
                      <option key={format.value} value={format.value}>
                        {format.label}
                      </option>
                    ))}
                  </select>
                  <div className="flex justify-end gap-1">
                    <Button type="button" variant="ghost" size="icon" disabled={index === 0} onClick={() => moveSection(index, -1)}>
                      <ArrowUp />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={index === draft.sections.length - 1}
                      onClick={() => moveSection(index, 1)}
                    >
                      <ArrowDown />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={draft.sections.length <= 1}
                      onClick={() => update("sections", draft.sections.filter((_, i) => i !== index))}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                  <Textarea
                    className="min-h-16 md:col-span-3"
                    value={section.instruction}
                    onChange={(event) => updateSection(index, { instruction: event.target.value })}
                    placeholder="这一段要提取什么"
                  />
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => update("sections", [...draft.sections, newSection({ title: "新章节" })])}
              >
                <Plus />
                添加章节
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" onClick={() => void save()} disabled={status === "saving"}>
                {status === "saving" ? "保存中…" : "保存"}
              </Button>
              <Button type="button" variant="outline" onClick={cancel} disabled={status === "saving"}>
                取消
              </Button>
              {canReset ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => void save({ reset: true })} disabled={status === "saving"}>
                  恢复默认
                </Button>
              ) : null}
              {canDelete ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => void remove()} disabled={status === "saving"}>
                  删除模板
                </Button>
              ) : null}
              {message ? <p className="text-sm text-destructive">{message}</p> : null}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function TemplateManager({ initialTemplates }: { initialTemplates: TemplateRecord[] }) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function reload() {
    const response = await fetch("/api/templates", { cache: "no-store" });
    if (!response.ok) throw new Error(await readError(response));
    setTemplates((await response.json()) as TemplateRecord[]);
  }

  async function createTemplate() {
    setCreating(true);
    setError("");
    try {
      const response = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(defaultNewTemplate()),
      });
      if (!response.ok) throw new Error(await readError(response));
      const created = (await response.json()) as TemplateRecord;
      setTemplates((current) => [created, ...current]);
      setEditingId(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败。");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button type="button" onClick={() => void createTemplate()} disabled={creating}>
          <Plus />
          {creating ? "创建中…" : "新建模板"}
        </Button>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="grid gap-4 md:grid-cols-2">
        {templates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            editing={editingId === template.id}
            canDelete={templates.length > 1}
            onEdit={() => setEditingId(template.id)}
            onClose={() => setEditingId(null)}
            onChanged={reload}
          />
        ))}
      </div>
    </div>
  );
}
