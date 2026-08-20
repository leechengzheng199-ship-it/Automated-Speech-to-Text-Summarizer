import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";

import "./globals.css";

export const metadata: Metadata = {
  title: "录音转写总结",
  description: "上传本地录音，经七牛云转写后生成可自定义结构的总结文档。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
