import { SettingsForm } from "@/components/settings-form";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">设置</h1>
        <p className="mt-1 text-muted-foreground">
          单机自用：凭证保存在本机 SQLite。七牛只负责存音频，转写走阿里云 Paraformer。
        </p>
      </div>
      <SettingsForm />
    </div>
  );
}
