import { SettingsForm } from "@/components/settings-form";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">设置</h1>
        <p className="mt-1 text-muted-foreground">
          单机自用：凭证保存在本机 SQLite，不会提交到第三方。使用前请在七牛控制台开通长语音识别。
        </p>
      </div>
      <SettingsForm />
    </div>
  );
}
