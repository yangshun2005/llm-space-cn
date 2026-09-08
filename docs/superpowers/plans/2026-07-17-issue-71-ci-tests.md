# CI 测试门禁实施计划

> **面向智能体工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实施此计划。步骤使用复选框（`- [ ]`）语法进行跟踪。

**目标：** 将仓库完整的 Bun 测试套件设为受支持的根任务，并作为 Pull Request/主分支必需的 CI 门禁。

**架构：** 保留 `package.json` 作为命令实施层，并通过现有的 `mise.toml` 任务前门将其暴露。在不更改或移除 lint、typecheck、workflow-validation 或生产构建门禁的前提下，将测试任务插入现有 CI 检查任务中，然后更新仓库的贡献者说明，以描述真实的测试框架和门禁。

**技术栈：** Bun 1.3 测试运行器、mise 任务、GitHub Actions YAML、Markdown。

## 全局约束

- 仅在 `issue-71-ci-tests` 分支的 `/Users/minimax/workspace/llm-space/.worktrees/issue-71` 目录下工作。
- 保持 Bun/mise 作为受支持的工具路径；不要添加 npm、pnpm、yarn 或其他测试框架。
- 保留所有现有的 lint、typecheck、workflow-validation 和生产构建门禁。
- 不要推送、创建 Pull Request 或修改 GitHub Issue #71。
- 此机器没有 `mise`；请静态验证 Bun 命令和配置，不要声称已在本地执行 `mise run test`。

---

### 任务 1：通过根任务和 mise 任务暴露现有 Bun 套件

**文件：**
- 修改：`package.json`
- 修改：`mise.toml`

**接口：**
- 消费：Bun 对 `*.test.ts` 文件的仓库根目录测试发现机制。
- 产出：根脚本 `bun run test` 和面向用户的任务 `mise run test`。

- [ ] **步骤 1：记录缺失入口点的 RED 状态**

在仓库根目录运行：

```bash
PATH="$HOME/.bun/bin:$PATH" bun run test
```

预期：由于 `package.json` 中没有 `test` 脚本，退出码非零。同时检查 `mise.toml`、`.github/workflows/ci.yml` 和 `AGENTS.md`，确认任务、CI 门禁和准确文档均不存在。

- [ ] **步骤 2：添加最小根脚本**

在 `package.json` 的根 `scripts` 对象中添加此条目：

```json
"test": "bun test"
```

- [ ] **步骤 3：添加 mise 任务**

在 `mise.toml` 中，将此任务添加到 lint 和 typecheck 任务旁边：

```toml
[tasks.test]
description = "运行所有 Bun 测试"
run = "bun run test"
```

- [ ] **步骤 4：验证 GREEN 实施层和静态任务接线**

运行：

```bash
PATH="$HOME/.bun/bin:$PATH" bun run test
```

预期：当前全部 11 个测试文件及所有测试用例均通过。然后使用 Python 的 `tomllib` 解析 `mise.toml`，并断言 `tasks.test.run == "bun run test"`，因为本地没有 `mise`。

### 任务 2：在 CI 中要求测试而不削弱现有门禁

**文件：**
- 修改：`.github/workflows/ci.yml`

**接口：**
- 消费：任务 1 中依赖安装后的 `mise run test` 任务。
- 产出：在现有 `check` 任务中，针对推送到 `main` 和 Pull Request 的失败测试敏感步骤。

- [ ] **步骤 1：添加 CI 测试步骤**

在 `bun install --frozen-lockfile` 之后、其他代码质量门禁之前插入此步骤：

```yaml
      - run: mise run test
```

- [ ] **步骤 2：验证 CI 接线和保留的门禁**

使用 PyYAML 解析所有 `.github/workflows/*.yml` 文件，然后静态断言 `.github/workflows/ci.yml` 的 `check` 任务中仍包含 workflow 验证、`mise run test`、`mise run lint`、`mise run typecheck` 和 `bun --filter @llm-space/desktop build:view`。

### 任务 3：修正贡献者文档

**文件：**
- 修改：`AGENTS.md`

**接口：**
- 消费：任务 1 和 2 中受支持的 `mise run test` 任务和 CI 行为。
- 产出：与本地和 CI 门禁匹配的面向贡献者的说明。

- [ ] **步骤 1：记录测试任务**

添加一行工具表格，描述 `mise run test` 为从仓库根目录运行完整的 Bun 测试套件。

- [ ] **步骤 2：替换过时的框架和 CI 声明**

将不存在测试框架的声明替换为以下内容：Bun 内置测试运行器会发现仓库中的 `*.test.ts` 文件，CI 会运行测试、lint、typecheck、workflow-YAML 验证和生产渲染器构建。

- [ ] **步骤 3：验证文档一致性**

在受跟踪的 Markdown 文件中搜索过时短语 `There is **no test framework**`，确认其不存在，然后确认 `AGENTS.md` 同时提及 `mise run test` 和 CI 测试门禁。

### 任务 4：完整验证、审查和提交

**文件：**
- 审查：任务 1-3 和本计划更改的所有文件。

**接口：**
- 消费：完整实施。
- 产出：全新的验证证据和一个引用 Issue #71 的本地提交。

- [ ] **步骤 1：运行完整的可用验证套件**

运行：

```bash
PATH="$HOME/.bun/bin:$PATH" bun run test
PATH="$HOME/.bun/bin:$PATH" bun run lint
PATH="$HOME/.bun/bin:$PATH" bun run typecheck
```

预期：每个命令均以 0 退出。解析 workflow YAML 和 `mise.toml`，并运行先前任务中的静态门禁断言。不要声称已执行 `mise run test`、`mise run lint` 或 `mise run typecheck`，因为 `mise` 不可用。

- [ ] **步骤 2：自审补丁**

运行 `git diff --check`，检查 `git diff`，并确认 `git status --short` 仅包含预期的计划、根脚本、mise 任务、CI 步骤和 AGENTS 文档更改。

- [ ] **步骤 3：提交已验证的更改**

运行：

```bash
git add docs/superpowers/plans/2026-07-17-issue-71-ci-tests.md package.json mise.toml .github/workflows/ci.yml AGENTS.md
git commit -m "ci: 在 CI 中运行 Bun 测试 (#71)"
```

记录提交 SHA，不要推送。