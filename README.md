# 录音转写与个性化总结

上传本地录音，在浏览器解析并压缩，经七牛云长语音识别转为文字，再按自定义模板生成结构化总结文档。

当前仓库是可运行的应用骨架：页面、数据模型和设置读写已经接通，**实际上传、转写与 LLM 总结将在后续迭代接入**。

## 技术栈

- Next.js（App Router）+ TypeScript
- Tailwind CSS + shadcn/ui
- SQLite + Prisma（本机单库，无账号体系）
- 计划接入：浏览器 ffmpeg.wasm、七牛 Kodo / LASR、OpenAI 兼容 LLM

## 环境要求

- Node.js 20 或更高（建议 22+）
- pnpm 9+（仓库 `packageManager` 为 pnpm 11）
- 七牛云账号，并开通[长语音识别](https://developer.qiniu.com/dora/11175/long-speech-recognition)
- 任意 OpenAI 兼容模型服务（DeepSeek、通义、OpenAI、Ollama 等），用于总结

## 启动

```bash
pnpm install
cp .env.example .env
pnpm db:push
pnpm dev
```

Windows PowerShell 若没有 `cp`，可执行：

```powershell
Copy-Item .env.example .env
```

浏览器打开 [http://localhost:3000](http://localhost:3000)。

`.env` 里只有数据库路径，**不要把七牛或模型密钥写进环境变量**。到页面「设置」中填写，密钥保存在本机 `prisma/dev.db`。

## 设置页必填项

七牛云：

- AccessKey / SecretKey
- 存储空间 Bucket
- 访问域名（公开空间用 CDN 域名；私有空间请勾选「私有空间」）
- 存储区域

总结模型：

- Base URL（需为 OpenAI 兼容的 `/v1` 接口）
- API Key
- 模型名

SecretKey 与 LLM API Key 不会以明文返回给浏览器；未改动时提交会保留原值。

## 页面

| 路径 | 说明 |
| --- | --- |
| `/` | 工作台：选择音频、查看最近任务 |
| `/jobs/[id]` | 任务进度、转写原文、总结文档 |
| `/templates` | 内置与自定义总结结构 |
| `/settings` | 七牛云与 LLM 配置 |

首次访问会自动写入 3 套内置模板：会议纪要、访谈整理、课程笔记。

## 七牛限制（上传校验已按此实现）

- 识别格式：wav、ogg、mp3、mp4（其他常见格式后续会先转成 mp3）
- 时长不超过 5 小时
- 体积不超过 512MB
- 转写为异步任务：提交后轮询 `taskId`（自建环境默认不用公网回调）

## 常用脚本

```bash
pnpm dev          # 开发
pnpm db:push      # 同步 Prisma schema 到 SQLite
pnpm db:generate  # 生成 Prisma Client
pnpm build        # 生产构建
pnpm lint         # ESLint
```
