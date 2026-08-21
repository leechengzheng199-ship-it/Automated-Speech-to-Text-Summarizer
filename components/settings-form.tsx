"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MASKED_SECRET, QINIU_REGIONS } from "@/lib/types";

type SettingsForm = {
  qiniuAccessKey: string;
  qiniuSecretKey: string;
  qiniuBucket: string;
  qiniuDomain: string;
  qiniuRegion: string;
  qiniuIsPrivate: boolean;
  dashscopeApiKey: string;
  dashscopeModel: string;
  llmBaseUrl: string;
  llmApiKey: string;
  llmModel: string;
  qiniuConfigured: boolean;
  dashscopeConfigured: boolean;
  llmConfigured: boolean;
};

const EMPTY: SettingsForm = {
  qiniuAccessKey: "",
  qiniuSecretKey: "",
  qiniuBucket: "",
  qiniuDomain: "",
  qiniuRegion: "z0",
  qiniuIsPrivate: false,
  dashscopeApiKey: "",
  dashscopeModel: "paraformer-v2",
  llmBaseUrl: "",
  llmApiKey: "",
  llmModel: "",
  qiniuConfigured: false,
  dashscopeConfigured: false,
  llmConfigured: false,
};

export function SettingsForm() {
  const [form, setForm] = useState<SettingsForm>(EMPTY);
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "saved" | "error">("loading");
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then(async (response) => {
        if (!response.ok) throw new Error("加载失败");
        return response.json();
      })
      .then((data: SettingsForm) => {
        setForm({ ...EMPTY, ...data, dashscopeModel: data.dashscopeModel || "paraformer-v2" });
        setStatus("idle");
      })
      .catch(() => {
        setStatus("error");
        setMessage("无法读取本机配置。请确认已执行 prisma db push。");
      });
  }, []);

  function update<K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus("saving");
    setMessage("");
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok) throw new Error("保存失败");
      const data = (await response.json()) as SettingsForm;
      setForm({ ...EMPTY, ...data, dashscopeModel: data.dashscopeModel || "paraformer-v2" });
      setStatus("saved");
      setMessage("已保存到本机 SQLite。密钥不会下发到浏览器明文。");
    } catch {
      setStatus("error");
      setMessage("保存失败，请检查服务是否在运行。");
    }
  }

  async function testParaformer() {
    setTesting(true);
    setMessage("");
    try {
      const response = await fetch("/api/settings/test-paraformer", { method: "POST" });
      const data = (await response.json()) as { ok?: boolean; message?: string };
      setStatus(data.ok ? "saved" : "error");
      setMessage(data.message || (data.ok ? "检测完成。" : "检测失败。"));
    } catch {
      setStatus("error");
      setMessage("检测失败，请确认开发服务正在运行。");
    } finally {
      setTesting(false);
    }
  }

  const disabled = status === "loading" || status === "saving" || testing;

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>七牛云对象存储</CardTitle>
          <CardDescription>
            用于存放音频并生成外链。SecretKey 只存在服务端。
            {form.qiniuConfigured ? " 当前存储配置已保存。" : " 当前尚未配置完整。"}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="AccessKey">
            <Input
              value={form.qiniuAccessKey}
              onChange={(event) => update("qiniuAccessKey", event.target.value)}
              autoComplete="off"
              disabled={disabled}
            />
          </Field>
          <Field label="SecretKey">
            <Input
              type="password"
              value={form.qiniuSecretKey}
              onChange={(event) => update("qiniuSecretKey", event.target.value)}
              placeholder={form.qiniuConfigured ? MASKED_SECRET : ""}
              autoComplete="off"
              disabled={disabled}
            />
          </Field>
          <Field label="存储空间 Bucket">
            <Input
              value={form.qiniuBucket}
              onChange={(event) => update("qiniuBucket", event.target.value)}
              disabled={disabled}
            />
          </Field>
          <Field label="访问域名">
            <Input
              value={form.qiniuDomain}
              onChange={(event) => update("qiniuDomain", event.target.value)}
              placeholder="https://cdn.example.com"
              disabled={disabled}
            />
          </Field>
          <Field label="存储区域">
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={form.qiniuRegion}
              onChange={(event) => update("qiniuRegion", event.target.value)}
              disabled={disabled}
            >
              {QINIU_REGIONS.map((region) => (
                <option key={region.value} value={region.value}>
                  {region.label}
                </option>
              ))}
            </select>
          </Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input
              type="checkbox"
              checked={form.qiniuIsPrivate}
              onChange={(event) => update("qiniuIsPrivate", event.target.checked)}
              disabled={disabled}
            />
            私有空间（外链会带下载签名，供本机拉取后交给 Paraformer）
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>阿里云 Paraformer 转写</CardTitle>
          <CardDescription>
            使用
            <a
              className="mx-1 underline"
              href="https://help.aliyun.com/zh/model-studio/paraformer-recorded-speech-recognition-restful-api"
              target="_blank"
              rel="noreferrer"
            >
              百炼录音文件识别
            </a>
            ，通过七牛外链异步转写。API Key 在
            <a
              className="mx-1 underline"
              href="https://bailian.console.aliyun.com/"
              target="_blank"
              rel="noreferrer"
            >
              阿里云百炼控制台
            </a>
            创建。
            {form.dashscopeConfigured ? " 当前已配置。" : " 当前尚未配置。"}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="DashScope API Key">
            <Input
              type="password"
              value={form.dashscopeApiKey}
              onChange={(event) => update("dashscopeApiKey", event.target.value)}
              placeholder={form.dashscopeConfigured ? MASKED_SECRET : ""}
              autoComplete="off"
              disabled={disabled}
            />
          </Field>
          <Field label="模型名">
            <Input
              value={form.dashscopeModel}
              onChange={(event) => update("dashscopeModel", event.target.value)}
              placeholder="paraformer-v2"
              disabled={disabled}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>总结模型（OpenAI 兼容）</CardTitle>
          <CardDescription>
            可填 DeepSeek、通义、OpenAI 或本地 Ollama 的兼容接口。
            {form.llmConfigured ? " 当前已配置。" : " 当前尚未配置完整。"}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Base URL" className="md:col-span-2">
            <Input
              value={form.llmBaseUrl}
              onChange={(event) => update("llmBaseUrl", event.target.value)}
              placeholder="https://api.deepseek.com/v1"
              disabled={disabled}
            />
          </Field>
          <Field label="API Key">
            <Input
              type="password"
              value={form.llmApiKey}
              onChange={(event) => update("llmApiKey", event.target.value)}
              placeholder={form.llmConfigured ? MASKED_SECRET : ""}
              autoComplete="off"
              disabled={disabled}
            />
          </Field>
          <Field label="模型名">
            <Input
              value={form.llmModel}
              onChange={(event) => update("llmModel", event.target.value)}
              placeholder="deepseek-chat"
              disabled={disabled}
            />
          </Field>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={disabled}>
          {status === "saving" ? "保存中…" : "保存配置"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={disabled || !form.dashscopeConfigured}
          onClick={testParaformer}
        >
          {testing ? "检测中…" : "检测转写权限"}
        </Button>
        {message ? (
          <p className={status === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
            {message}
          </p>
        ) : null}
      </div>
    </form>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="mb-2 block">{label}</Label>
      {children}
    </div>
  );
}
