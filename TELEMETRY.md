# 遥测

llm-space 会收集少量**匿名的、仅行为层面的**使用数据，以了解哪些功能被使用以及应用在何处出现故障。本文档准确描述了发送了什么、绝不会发送什么，以及如何关闭它。

该实现刻意保持可审计性：每个事件都必须在 [`apps/desktop/src/shared/analytics.ts`](apps/desktop/src/shared/analytics.ts) 的类型化映射中声明，而**唯一**与网络通信的代码是 bun 主进程模块 [`apps/desktop/src/bun/analytics/`](apps/desktop/src/bun/analytics/)。事件发送至 PostHog（欧盟云，`eu.i.posthog.com`）。

## 如何识别您

通过首次启动时生成并存储在 `~/.llm-space/settings/analytics.json` 中的随机 UUID 进行识别。该 UUID 不基于您机器上的任何信息派生，也绝不会关联到用户身份。PostHog 人物画像功能已禁用（`$process_person_profile: false`），且 GeoIP 查找已关闭。删除该文件（或整个 `~/.llm-space` 目录）将重置此 ID。

## 发送的内容

每个事件都携带三项匿名的构建/平台信息：应用版本、`process.platform`（例如 `darwin`）和 `process.arch`（例如 `arm64`），此外还有：

| 事件 | 属性 |
|---|---|
| `app_opened` | `isFirstOpen` - 本次启动是否生成了安装 ID |
| `thread_run` | `provider`、`model`（见下方说明）、`outcome`（`completed` / `error` / `aborted`）、`durationMs`、`messageCount`、`toolCount`、`hasSystemPrompt` |
| `provider_added` | `providerId`（内置 ID，或自定义提供方生成的 UUID）、`kind`（`builtin` / `custom`） |
| `mcp_server_added` | 无 |
| `settings_opened` | 无 |
| `onboarding_choice` | `choice`（点击了哪个引导按钮） |

**关于 `provider` / `model` 的说明：** 仅当这些值来自随附的内置目录（例如 `openai` / `gpt-4o`）时，才会原样上报。任何您自行输入的内容——无论是自定义提供方，还是为内置提供方添加的自定义模型——在捕获前都会被折叠为字面字符串 `"custom"`。

## 绝不会发送的内容

- 提示文本、消息正文、系统提示或模型响应
- 您工作区中的文件名或文件内容
- API 密钥、基础 URL 或请求头
- 您输入的名称（自定义提供方名称、自定义模型 ID）
- 基于 IP 的位置信息（捕获时已禁用 GeoIP）

## 如何选择退出

以下任一方式，按便利程度排列：

1. **设置 › 通用 › “共享匿名使用分析”** - 关闭开关。设置会立即持久化；客户端会被关闭，且不再发送任何内容。
2. 设置环境变量 `LLM_SPACE_ANALYTICS_DISABLED=1` - 这是一个硬性覆盖选项，优先级高于其他所有设置。
3. 设置 `LLM_SPACE_POSTHOG_KEY=""`（空值）- 没有密钥，就永远不会创建客户端。

## 针对 Fork 版本

内置的 PostHog 密钥是一个仅写入的客户端项目密钥。如果您 Fork 了 llm-space，可通过 `LLM_SPACE_POSTHOG_KEY` 将遥测指向您自己的项目，或按上述方式完全禁用它。