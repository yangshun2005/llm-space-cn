# 安全外部链接实施计划

> **面向智能体工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实施此计划。步骤使用复选框（`- [ ]`）语法进行跟踪。

**目标：** 防止渲染进程提供的 `openLink` 命令将格式错误或非 HTTP(S) 的 URL 传递给操作系统。

**架构：** 添加一个仅限 Bun 的 URL 解析器，使用平台 `URL` 解析器和显式的 `http:`/`https:` 协议白名单。将 Bun 命令处理器路由到该解析器，并从生产组合根注入原生外部打开器，以便在不调用操作系统的情况下测试处理器。

**技术栈：** TypeScript、Bun 测试运行器、Electrobun Bun 进程 API

## 全局约束

- 验证在 Bun 进程中具有权威性。
- 仅允许 `http:` 和 `https:` 协议。
- 格式错误、`file:`、`javascript:`、自定义协议和协议相对输入绝不能到达 `Utils.openExternal`。
- 拒绝错误和日志不得包含不受信任的 URL。
- 不要更改渲染进程行为或添加对其他协议的支持。
- 使用 `bun` 和 `mise`；不要使用 npm、pnpm 或 yarn。

---

### 任务 1：在 Bun 命令处理器中验证并打开外部 HTTP(S) URL

**文件：**
- 创建：`apps/desktop/src/bun/external-url.ts`
- 创建：`apps/desktop/src/bun/external-url.test.ts`
- 创建：`apps/desktop/src/bun/commands.test.ts`
- 修改：`apps/desktop/src/bun/commands.ts`
- 修改：`apps/desktop/src/bun/app/start-desktop-app.ts`

**接口：**
- 使用：标准 `URL` 解析器、`Command`、`BrowserWindow` 和 Electrobun `Utils.openExternal(url: string)`。
- 生成：`parseExternalUrl(value: string): URL` 和 `BunCommandDependencies.openExternal(url: string): void`。

- [x] **步骤 1：编写失败的 Bun 侧验证器测试**

```ts
import { describe, expect, test } from "bun:test";

import { parseExternalUrl } from "./external-url";

describe("parseExternalUrl", () => {
  test.each(["http://example.com/path", "https://example.com/path"])(
    "允许 %s",
    (value) => expect(parseExternalUrl(value).href).toBe(value)
  );

  test.each([
    "不是 URL",
    "file:///tmp/private.txt",
    "javascript:alert(1)",
    "custom-app://open/secret",
    "//example.com/path",
  ])("拒绝 %s 且不回显", (value) => {
    expect(() => parseExternalUrl(value)).toThrow("不允许外部 URL。");
    try {
      parseExternalUrl(value);
    } catch (error) {
      expect(String(error)).not.toContain(value);
    }
  });
});
```

- [x] **步骤 2：运行验证器测试以确认 RED**

运行：`PATH="$HOME/.bun/bin:$PATH" bun test apps/desktop/src/bun/external-url.test.ts`

预期：失败，因为 `./external-url` 不存在。

- [x] **步骤 3：实现最小权威白名单**

```ts
const ALLOWED_EXTERNAL_URL_PROTOCOLS = new Set(["http:", "https:"]);
const EXTERNAL_URL_REJECTION_MESSAGE = "不允许外部 URL。";

export function parseExternalUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(EXTERNAL_URL_REJECTION_MESSAGE);
  }
  if (!ALLOWED_EXTERNAL_URL_PROTOCOLS.has(url.protocol)) {
    throw new Error(EXTERNAL_URL_REJECTION_MESSAGE);
  }
  return url;
}
```

- [x] **步骤 4：运行验证器测试以确认 GREEN**

运行：`PATH="$HOME/.bun/bin:$PATH" bun test apps/desktop/src/bun/external-url.test.ts`

预期：所有 HTTP/HTTPS 和拒绝输入用例均通过。

- [x] **步骤 5：编写失败的命令处理器测试**

```ts
test.each(["http://example.com/path", "https://example.com/path"])(
  "打开允许的 URL %s",
  (url) => {
    executeCommandInBun(
      { type: "openLink", args: { url } },
      window,
      createDependencies(openedUrls)
    );
    expect(openedUrls).toEqual([url]);
  }
);

test.each([
  "不是 URL",
  "file:///tmp/private.txt",
  "javascript:alert(1)",
  "custom-app://open/secret",
  "//example.com/path",
])("不打开被拒绝的 URL %s", (url) => {
  executeCommandInBun(
    { type: "openLink", args: { url } },
    window,
    createDependencies(openedUrls)
  );
  expect(openedUrls).toEqual([]);
});
```

- [x] **步骤 6：运行命令处理器测试以确认 RED**

运行：`PATH="$HOME/.bun/bin:$PATH" bun test apps/desktop/src/bun/commands.test.ts`

预期：失败，因为 `openLink` 仍直接调用 Electrobun，且依赖接缝不存在。

- [x] **步骤 7：将处理器路由到验证和生产原生打开器**

将 `openExternal: (url: string) => void` 添加到 `BunCommandDependencies`，在 `openLink` 分支内调用 `parseExternalUrl(command.args.url)`，使用常量通用 `console.error("已阻止不安全的外部 URL。")` 捕获拒绝，并返回而不调用 `openExternal`。在 `start-desktop-app.ts` 中，在 `commandDependencies` 上设置 `openExternal: Utils.openExternal`。

- [x] **步骤 8：运行聚焦测试以确认 GREEN**

运行：`PATH="$HOME/.bun/bin:$PATH" bun test apps/desktop/src/bun/external-url.test.ts apps/desktop/src/bun/commands.test.ts`

预期：所有验证器和命令处理器测试均通过，被拒绝的输入永远不会被打开器桩记录。

- [x] **步骤 9：运行仓库验证**

运行：`PATH="$HOME/.bun/bin:$PATH" bun test`

预期：所有测试通过。

运行：`PATH="$HOME/.bun/bin:$PATH" bun run lint`

预期：退出码为 0，无 lint 错误。

运行：`PATH="$HOME/.bun/bin:$PATH" bun run typecheck`

预期：退出码为 0，无 TypeScript 错误。

- [x] **步骤 10：审查并提交**

运行：`git diff --check && git diff --stat && git status --short`

预期：无空白错误，且仅更改了 Issue #73 计划、验证器、测试、命令处理器和组合根接线。

```bash
git add docs/superpowers/plans/2026-07-17-issue-73-safe-external-links.md \
  apps/desktop/src/bun/external-url.ts \
  apps/desktop/src/bun/external-url.test.ts \
  apps/desktop/src/bun/commands.test.ts \
  apps/desktop/src/bun/commands.ts \
  apps/desktop/src/bun/app/start-desktop-app.ts
git commit -m "fix: 限制外部链接协议 (#73)"
```