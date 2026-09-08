## 简介

一个用于提示词与智能体开发的工作台——构建、追踪、调试、评估与管理，一站式完成。它以原生**桌面应用**（Electrobun）的形式交付，而非网站。

## 工具链

**mise 是任务入口**——`mise tasks ls` 列出所有入口点；任务主体转发到 package.json 脚本，即实现层。**bun** 是包管理器和 JS 运行时（在 `mise.toml` 中模糊固定版本，精确版本和校验和在 `mise.lock` 中锁定——升级时使用 `mise lock` 重新生成）。不要使用 npm/pnpm/yarn。

| 任务                                   | 命令                                                                     | 说明                                                                                                                  |
| -------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 初始化全新克隆                   | `mise run setup`                                                            | 安装锁定的工具链（`mise install`）+ JS 依赖（`bun install`）                                               |
| 安装依赖                           | `bun install`                                                               | 在仓库根目录执行                                                                                                         |
| 运行桌面应用                        | `mise run dev`                                                              | → `cd apps/desktop && bun run dev:hmr`（Vite HMR 运行在 :5173 + `vite build && electrobun dev`；重启以应用 bun 主进程更改） |
| 使用 CEF/CDP 调试运行桌面应用 | `mise run dev:cef`                                                          | → `cd apps/desktop && bun run dev:cef`；默认在 `127.0.0.1:9333` 暴露 CDP                                     |
| 运行网站（落地页 + 查看器）    | `mise run dev:web`                                                          | → `bun --filter @llm-space/web dev`（Vite 运行在 :5175）。落地页位于 `/llm-space/`，查看器位于 `/llm-space/#/shared/<connectorId>/threads/<threadId>` |
| 构建（金丝雀版）                         | `mise run build:canary`                                                     | → 在 `apps/desktop` 中执行 `vite build && electrobun build --env=canary`                                                      |
| 构建（稳定版）                         | `mise run build:stable`                                                     | → 在 `apps/desktop` 中执行 `vite build && electrobun build --env=stable`                                                      |
| 构建网站                     | `mise run build:web`                                                        | → `bun --filter @llm-space/web build`（静态，`base=/llm-space/`，输出到 `apps/web/dist`）。CI 和 Pages 工作流运行此命令 |
| 本地打包 / 更新测试          | `mise run pack` · `pack:perf` · `pack:adhoc` · `pack:signed` · `pack:feed` + `feed:serve` | 在 `build:canary` 基础上的环境组合（跳过签名 / CEF Performance 版 / 临时签名 / 本地更新源在 :8321）；定义在 `mise.toml` 中 |
| 发布版本                          | `mise run release` / `mise run release:canary`                              | → `bun scripts/release.ts`；参见“发布与自动更新”                                                               |
| 测试                                   | `mise run test`                                                             | 从仓库根目录运行完整的 Bun 测试套件                                                                  |
| 检查变更文件                    | `mise run check:changed`                                                    | 仅对已跟踪的变更和未跟踪的源文件执行 lint 和类型检查                                                       |
| Lint                                   | `mise run lint` / `mise run lint:fix`                                       | `lint` = `eslint .`（只读），`lint:fix` = `eslint --fix .`；扁平配置位于仓库根目录                               |
| 类型检查                              | `mise run typecheck`                                                        | 对根目录、runtime、UI、desktop、web、server 以及 Atlas 插件示例运行 `tsc --noEmit`；添加工作区时在此处添加项目。 |
| 添加依赖                       | `bun add <pkg>`                                                             | 在目标包内运行（`apps/desktop` 或 `packages/core`）                                                      |
| 添加 shadcn/ui 组件              | `bunx --bun shadcn@latest add <component>`                                  | 在 `packages/ui` 内运行（共享设计系统现在位于此处，而非 `apps/desktop`）                                |
| 从根目录运行脚本                 | `bun --filter <pkg> <script>`                                               | 例如 `bun --filter @llm-space/desktop start`                                                                           |

Bun 内置的测试运行器通过 `mise run test` 发现仓库中的 `*.test.ts` 文件。CI（`.github/workflows/ci.yml`）在 PR 和推送到 main 分支时运行测试 + lint + 类型检查 + 生产环境 `vite build` + 工作流 YAML 验证。最后两项存在的原因是这两种故障模式在发布标签被推送之前都是不可见的，而一旦推送就会导致发布失败：渲染器包超出运行器的 V8 堆内存（`build:view` 设置了 `--max-old-space-size=4096`；默认约 2 GB 在 14701 个模块时已不够用）以及格式错误的工作流文件。请留意渲染器包的大小——如果 `vite build` 再次出现 OOM，请在 `build:view` 中提高上限或缩减包体积，不要等到发布时才发现问题。

对于普通的编码智能体工作，运行 `mise run check:changed` 而不是仓库范围的 `mise run lint` 和 `mise run typecheck` 任务。变更文件检查使用 Git 跟踪的更改加上未跟踪的源文件，仅对这些文件运行 ESLint，并且仅报告这些文件的 TypeScript 诊断。将完整的 lint 和 typecheck 任务保留用于 CI 一致性、发布准备或用户明确要求。当 `mise` 不可用时，底层命令为 `bun run check:changed`、`bun run lint:changed`、`bun run lint:changed:fix` 和 `bun run typecheck:changed`。

包测试位于 `packages/<package>/tests/` 中，与 `src/` 并列，其内部路径镜像 `src/`（例如，`src/thread/history.ts` 映射到 `tests/thread/history.test.ts`）。不要将测试文件放在 `src/` 下。

GUI 提交（VS Code、Fork）失败并显示 `bun: command not found`：husky 钩子需要 bun 在 PATH 中——将 `export PATH="$HOME/.local/share/mise/shims:$PATH"` 添加到 `~/.config/husky/init.sh`（husky 针对版本管理器的官方修复方案）。

共享依赖版本位于根目录 `package.json` 的 `catalog` 中（引用为 `"catalog:"`）——在此处升级，而不是在每个包中单独升级。目录当前固定了 `@earendil-works/pi-ai`、`@earendil-works/pi-agent-core`、`react`、`react-dom` 和 `typebox`。

### Electrobun 页面调试

当您需要检查或调试真实的桌面渲染器时，请使用位于 `./.agents/skills/electrobun-cdp-debug/SKILL.md` 的项目技能。**不要**在浏览器中模拟 `electrobun.rpc`。

从 `mise run dev:cef` 开始；普通的 `mise run dev` 保留原生 WebView 渲染器且不暴露 CDP。

当 CEF/CDP 验证需要隔离的应用数据根目录时，默认将运行时沙箱数据放在系统临时目录中，而不是放在 `.agents/` 或仓库内：

```sh
TMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/llm-space-XXXXXX")"
LLM_SPACE_HOME="$TMP_ROOT" mise run dev:cef
```

仅在仓库中保留持久性证据，如审计截图、笔记、日志和小型脱敏 JSON 片段。除非有意保留夹具供审查且记录了原因，否则不要将常规的 `workspace/`、`settings/`、缓存或生成的应用数据提交或留在 `.agents/kaizen-loop/` 下。

## 架构

Bun 工作区 monorepo。工作区为 `packages/*` 和 `apps/*`（静态站点现在位于 `apps/web`）。

- **`@llm-space/core`**（`packages/core`）——领域库，**无构建步骤**；其 TypeScript 通过 `exports` 映射直接消费。入口点：
  - `.` → 重新导出内部的 `client`、`parsers`、`types` 和 `utils` 目录（均浏览器安全）。
  - `./client` — 浏览器安全部分：`streamThread()` 客户端（`client/api`）、`reduceMessages()` 流式归约器（`client/reducer`）以及 `AgentTransport` 接口（`client/transport`）。
  - `./thread` — 无头、框架无关的线程语义，由两个运行时上下文共享：运行历史 + 评估评分（`thread/history`、`thread/run-history-utils`、`thread/run-evaluation-utils`）、提示词变量 + 显示解析（`thread/prompt-variables`、`thread/prompt-variable-display`）以及 Jinja2 模板渲染（`thread/template-render` — `{% if %}`/`{% for %}`/过滤器加上 `@include("path")` 宏，深度/数量由 `MAX_INCLUDE_DEPTH`/`MAX_INCLUDE_COUNT` 限制；`TEMPLATE_MARKER_RE` 决定文本是否作为模板渲染）、用量聚合 + 格式化（`thread/usage`、`thread/token-usage`）以及工具调用状态（`thread/tool-call-status`）。纯线程领域逻辑（无 React/DOM）属于此处——**而非** `@llm-space/ui` 的线程游乐场，后者的辅助函数应保持纯展示性。
  - `./server` — 仅限 Node/Bun 的实现：`streamAgent()`（`server/agent/stream`）、文件系统路径（`server/paths` — `getLlmSpaceHomePath()`、`getSettingsDir()`）、`LocalFileSystem` 线程存储（`server/storage`）以及窗口状态持久化（`server/window-state`）。
  - `./types` — `Thread`/`Message`/`ModelConfig`/`Tool`/`FileNode`/`ModelProviderGroup`、跨 RPC 边界共享的网络/搜索设置形状（`types/network`、`types/search`）以及与 `@earendil-works/pi-*` 格式互转的转换器。
- **`@llm-space/ui`**（`packages/ui`）— 共享 React 设计系统 + **线程游乐场**，**无构建步骤**（通过 `exports` 映射作为 TS 消费），且**不依赖 Electrobun**，因此桌面渲染器和静态 Web 应用渲染相同的 UI。包含：shadcn 原语（`./ui/*`）、`cn` + 纯辅助函数（`./lib/*`）、设计令牌（`./styles/globals.css`，Tailwind v4）、应用级组件（`./components/*` — 线程游乐场、模型提供商、代码编辑器、工具提示、确认对话框、Markdown、预览对话框等）以及 **`HostServices` 接缝**（`./host`）。内部文件使用**相对导入**（绝不使用 `@/`，桌面打包器会劫持该别名）；`exports` 对 `./components/*` 使用 `.tsx` 通配符，加上 `thread-playground` 桶文件、`examples/prompts`（`.ts` 子路径）和 `code-editor` 的显式条目（tsc 和 Vite 都必须解析它们）。shadcn `ui/` 被 ESLint 忽略（`packages/ui/src/ui/**`）；使用 `packages/ui/components.json` 添加组件。
  - **`HostServices` 接缝**（`packages/ui/src/host/`）是游乐场保持解耦的方式：所有特定于宿主的内容——`transport`、`executeTool`、`skills`/`mcp`/`builtinTools`/`paths` 客户端、`actions`（导航，替代桌面命令总线）以及 `presentational` 标志——都通过 `HostServicesProvider` + `useHostServices()` 注入。模型访问是单独注入的 `ModelClient`，提供给 `ModelProvider`。**桌面端**在 `apps/desktop/src/host/host-services.tsx` 中提供真实的、基于 Electrobun 的实现（`DesktopHostProvider` + `createElectrobunModelClient`）；**Web 端**提供仅展示的无操作桩。绝不要在 `packages/ui` 内部导入 `@/client`/`@/commands`/`electrobun`。
- **`@llm-space/desktop`**（`apps/desktop`）— Electrobun 应用。使用 Vite（React 19）构建渲染器，使用 `electrobun` 构建外壳。两个运行时上下文通过单一类型化 RPC 通道桥接：
  - **bun 主进程**（`src/bun/`）— 拥有原生窗口、菜单、文件系统、模型配置和智能体流式传输。
  - **webview 渲染器**（`src/app`、`src/components`、`src/mainview`）— React UI。线程游乐场和设计系统现在位于 `@llm-space/ui` 中；渲染器导入它们并提供桌面 `HostServices`/`ModelClient`。
- **`@llm-space/web`**（`apps/web/`）— **静态站点**：位于 `/llm-space/` 的营销**落地页**和位于 `/llm-space/#/shared/<connectorId>/threads/<threadId>` 的**仅展示共享线程查看器**（通过 `@llm-space/core/storage` 中的 `ThreadConnector` 读取线程——gist 连接器使用 `GistThreadReader.readShared` 获取线程 + 作者/描述/文件名元数据——并以只读方式渲染 `@llm-space/ui` 的 `ThreadPlayground`，使用桩 `HostServices`，`presentational: true`）。**路由使用 `HashRouter`**（react-router），以便深层链接在 Pages 上以 HTTP 200 解析，无需 `404.html` 回退；站点**仅深色模式**（主题在 `main.tsx` 中固定）。桌面的“在 LLM Space 中打开”深层链接镜像路由为 `llm-space://shared/<connectorId>/threads/<threadId>`。无 Electrobun，无后端。`base: "/llm-space/"`；CodeMirror 在 `apps/web/vite.config.ts` 中**未**去重（无直接依赖——一份副本已通过包解析）。落地页在 `apps/web/src/landing/` 下**供应商化**（自包含，使用自己的单引号风格——ESLint 忽略，仍进行类型检查）；其额外 CSS 在 `apps/web/src/landing/index.css` 中为增量式（shadcn 令牌位于 `@llm-space/ui/styles/globals.css` 中；近黑色背景限定在落地页根元素内）。**部署：** `.github/workflows/pages.yml` 在推送到 `main` 时构建 `apps/web/` 并通过 `actions/deploy-pages` 发布（仓库 Pages 源为 **GitHub Actions**）。CI（`ci.yml`）也构建 `apps/web/`，以便 PR 捕获问题。

### RPC 桥接

类型化契约位于 `src/shared/rpc.ts`（`DesktopRPCType`）。bun 侧在 `src/bun/rpc/index.ts` 中创建处理器（`createMainWindowRPC()`）；渲染器在 `src/lib/electrobun.ts`（`electrobun.rpc`）中持有客户端。两个方向：

- **请求**（webview → bun，请求/响应）：`availableModels`、`addProvider`/`updateProvider`/`removeProvider`/`setModelEnabled`/…、文件系统操作 `fsLs`/`fsRead`/`fsWrite`/`fsMkdir`/`fsCp`/`fsMv`/`fsRm`/`fsReveal`（镜像原 HTTP 路由）、提示词模板辅助函数 `fsReadText`（为 `@include` 宏读取任意文本文件；`~` 展开，缺失 → `""`）、`fsPickFile`（用于 File 内容变量的原生操作系统文件选择器）以及 `ensureRootDir`（在 llm-space 根目录下解析/创建目录——渲染器无法访问文件系统），加上一次性功能提醒 `featureReminderNext`（下一个未见的提醒或 `null`；纯读取）/ `featureReminderMarkSeen`（在关闭/点击时记录为已见——记录被延迟，因此从未显示过的提醒不会被消耗）。
- **消息**（即发即弃，双向）：智能体流式传输（`sendStreamThreadRequest` / `receiveStreamThreadResponse` / `abortStreamThread`）、全屏同步、更新状态（`updateStatusChanged`）以及 `executeCommand`（参见命令层）。

Electrobun RPC 没有原生流式传输，因此智能体运行**通过即发即弃消息模拟流**，由每次运行的 `streamId`（uuid）关联：

1. 渲染器 `createRpcTransport()`（`src/client/rpc-transport.ts`）发送 `sendStreamThreadRequest { streamId, request }`。
2. Bun `StreamThreadController.run()`（`bun/streaming/stream-thread.ts`）迭代 `streamAgent()` 并发送以 `streamId` 为键的 `receiveStreamThreadResponse` 消息：每个事件一个 `{ type: "event" }`，然后是终止性的 `{ type: "done" }` 或 `{ type: "error", message }`。
3. 传输层