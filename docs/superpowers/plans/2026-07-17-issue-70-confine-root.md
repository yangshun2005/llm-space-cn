# 将 ensureRootDir 限制在 LLM_SPACE_HOME 范围内的实施计划

> **给智能体工作者的提示：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实施此计划。步骤使用复选框（`- [ ]`）语法进行跟踪。

**目标：** 防止渲染器提供的路径使 `ensureRootDir` 在 `LLM_SPACE_HOME` 之外创建或返回目录，同时保留有效的嵌套路径。

**架构：** 添加一个 Bun 端的路径解析器，将输入视为可移植的相对路径，拒绝 POSIX 和 Windows 绝对路径以及父级遍历，从规范的主目录根解析目标，并执行最终的原生包含检查。将文件系统变更保留在现有的 RPC 处理器中，该处理器将在 `mkdirSync` 之前调用解析器。

**技术栈：** TypeScript、Bun 运行时、`node:path`、`bun:test`、Electrobun 类型化 RPC。

## 全局约束

- 仅在分支 `issue-70-confine-root` 上的 `/Users/minimax/workspace/llm-space/.worktrees/issue-70` 中工作。
- 使用 Bun，并将 `$HOME/.bun/bin` 添加到 `PATH`；不要使用 npm、pnpm 或 yarn。
- 在文件系统变更之前拒绝 `../outside`、更深层次的遍历、POSIX 绝对路径、Windows 驱动器路径、UNC 路径和反斜杠遍历。
- 保留有效的嵌套路径，包括 `workspace` 和 `tmp/deep-research`。
- `ensureRootDir` 返回的每个路径都必须解析为 `LLM_SPACE_HOME` 本身或其子路径之一。
- 遵循严格的 RED-GREEN TDD：在更改生产代码之前，运行聚焦测试并观察预期的限制失败。

---

### 任务 1：添加并接入受限根目录解析器

**文件：**
- 创建：`apps/desktop/src/bun/rpc/root-path.ts`
- 创建：`apps/desktop/src/bun/rpc/root-path.test.ts`
- 修改：`apps/desktop/src/bun/rpc/index.ts:1-4,177-181`

**接口：**
- 使用：`node:path` 可移植（`posix`、`win32`）和原生路径解析 API。
- 产出：`resolveRootDir(homePath: string, relativePath: string): string`，返回规范的主目录根或包含的子路径，并对转义尝试抛出 `Error("Path escapes LLM_SPACE_HOME: <input>")`。

- [x] **步骤 1：为有效路径和转义路径编写聚焦的失败测试**

```typescript
import path from "node:path";

import { describe, expect, test } from "bun:test";

import { resolveRootDir } from "./root-path";

const HOME_PATH = path.resolve("/tmp/llm-space-home");

describe("resolveRootDir", () => {
  test.each(["workspace", "tmp/deep-research"])(
    "将有效嵌套路径 %s 保留在 LLM_SPACE_HOME 内",
    (relativePath) => {
      const resolved = resolveRootDir(HOME_PATH, relativePath);

      expect(resolved).toBe(path.join(HOME_PATH, relativePath));
      expect(
        resolved === HOME_PATH || resolved.startsWith(HOME_PATH + path.sep)
      ).toBe(true);
    }
  );

  test.each([
    "../outside",
    "tmp/../../outside",
    "/tmp/outside",
    String.raw`..\\outside`,
    String.raw`C:\\outside`,
    String.raw`\\\\server\\share`,
  ])("拒绝转义尝试 %s", (relativePath) => {
    expect(() => resolveRootDir(HOME_PATH, relativePath)).toThrow(
      `Path escapes LLM_SPACE_HOME: ${relativePath}`
    );
  });
});
```

- [x] **步骤 2：运行聚焦测试并验证 RED**

运行：`export PATH="$HOME/.bun/bin:$PATH" && bun test apps/desktop/src/bun/rpc/root-path.test.ts`

预期：在添加具有处理器当前 `path.join` 行为的解析器后，FAIL，因为每个转义尝试都返回路径而不是抛出异常，证明限制行为尚未实现。

- [x] **步骤 3：实现最小的可移植限制解析器**

```typescript
import path from "node:path";

export function resolveRootDir(
  homePath: string,
  relativePath: string
): string {
  const root = path.resolve(homePath);
  const portablePath = relativePath.replaceAll("\\", "/");
  const hasParentTraversal = portablePath.split("/").includes("..");

  if (
    path.posix.isAbsolute(relativePath) ||
    path.win32.isAbsolute(relativePath) ||
    hasParentTraversal
  ) {
    throw new Error(`Path escapes LLM_SPACE_HOME: ${relativePath}`);
  }

  const target = path.resolve(root, relativePath);
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new Error(`Path escapes LLM_SPACE_HOME: ${relativePath}`);
  }
  return target;
}
```

- [x] **步骤 4：在 mkdir 之前将 RPC 处理器接入解析器**

```typescript
import { resolveRootDir } from "./root-path";

// 在 ensureRootDir 中：
const dir = resolveRootDir(homePath, relativePath);
mkdirSync(dir, { recursive: true });
return Promise.resolve({ path: dir });
```

- [x] **步骤 5：运行聚焦测试和仓库验证**

运行：

```bash
export PATH="$HOME/.bun/bin:$PATH"
bun test apps/desktop/src/bun/rpc/root-path.test.ts
bun test
bun run lint
bun run typecheck
git diff --check
```

预期：聚焦测试、完整测试套件、lint 和 `git diff --check` 均通过。在此工作树中，已知 typecheck 仍被 `apps/desktop/src/bun/models/model-manager.ts:655` 处不相关的基线错误阻塞，其中 `model` 不属于已安装的 `pi-ai` 认证输入类型；不要扩展 #70 来修改该文件。

- [x] **步骤 6：审查并提交完整的 Issue 变更**

运行：

```bash
git diff -- apps/desktop/src/bun/rpc/root-path.ts apps/desktop/src/bun/rpc/root-path.test.ts apps/desktop/src/bun/rpc/index.ts docs/superpowers/plans/2026-07-17-issue-70-confine-root.md
git add apps/desktop/src/bun/rpc/root-path.ts apps/desktop/src/bun/rpc/root-path.test.ts apps/desktop/src/bun/rpc/index.ts docs/superpowers/plans/2026-07-17-issue-70-confine-root.md
git commit -m "fix: confine root directory creation (#70)"
```

预期：一个引用 `#70` 的提交，仅暂存上述四个 Issue 文件。