# RPC 流 FIFO 实现计划

> **面向智能体工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法进行跟踪。

**目标：** 使 `createRpcTransport()` 以摊还 O(1) 时间出队流式事件，同时验证所有生命周期路径中的事件顺序和清理。

**架构：** 保持现有 `AgentTransport` API 和 Electrobun RPC 协议不变。通过可控的 RPC 边界假对象驱动真实的异步生成器状态机，然后用头游标替换前端移除操作，该游标清除已消费的槽位并定期压缩底层数组。

**技术栈：** TypeScript、Bun 测试运行器、Electrobun 类型化 RPC、`AgentTransport` 异步可迭代对象

## 全局约束

- 仅在 `/Users/minimax/workspace/llm-space/.worktrees/issue-75` 的 `issue-75-rpc-fifo` 分支上工作。
- 保持 `AgentTransport` 接口和 RPC 线上载荷不变。
- 对 Bun 支持的命令使用 `PATH="$HOME/.bun/bin:$PATH"`；不要使用 npm、pnpm 或 yarn。
- 出队操作必须为摊还 O(1) 时间，且已消费的条目不得无限期保留。
- 测试必须驱动真实的传输状态机，而不仅仅是断言假方法调用。
- 不要推送、开启 Pull Request 或修改 GitHub Issue #75。

---

### 任务 1：添加可控的 RPC 生命周期覆盖

**文件：**
- 创建：`apps/desktop/src/client/rpc-transport.test.ts`

**接口：**
- 消费：`createRpcTransport(): AgentTransport` 和 `StreamThreadResponsePayload`。
- 产出：一个可复用的测试内 RPC 假对象，用于捕获已启动的流 ID、发出带键的响应、统计活动监听器数量，并记录 Bun 中止请求。

- [ ] **步骤 1：在导入传输模块之前构建假对象**

使用 `mock.module("@/lib/electrobun", ...)` 创建一个假对象，其 `addMessageListener` 和 `removeMessageListener` 维护一个 `Set`，其 `sendStreamThreadRequest` 记录 `{ streamId, request }`，其 `emit(payload)` 同步调用监听器的快照。在注册 mock 之后动态导入 `createRpcTransport`。使用以下最小请求和事件词汇表：

```ts
const REQUEST: AgentStreamRequest = {
  model: { provider: "test", id: "test" },
  context: { messages: [], tools: [] },
};
const START: AgentEvent = { type: "agent_start" };
const TURN: AgentEvent = { type: "turn_start" };
```

- [ ] **步骤 2：测试完成前有序排空**

启动一个迭代器并调用 `next()`，使 RPC 请求和监听器处于活动状态。在等待挂起的读取之前发出 `START`、`TURN`，然后发出 `done`。断言连续的 `next()` 结果依次为 `START`、`TURN` 和 `{ done: true }`，并断言监听器数量归零。

- [ ] **步骤 3：测试远程错误清理**

启动一个迭代器，发出 `{ type: "error", message: "remote exploded" }`，断言挂起的 `next()` 以该消息拒绝，然后断言监听器为零且无中止请求（远程流已终止）。

- [ ] **步骤 4：测试 AbortSignal 恰好触发一次**

使用 `AbortController` 启动，中止它，断言挂起的 `next()` 以名为 `AbortError` 的 `DOMException` 拒绝，恰好发送了一个匹配的 `abortStreamThread`，并且监听器已被移除。再次中止控制器并断言计数保持为一。

- [ ] **步骤 5：测试消费者提前退出**

启动一个迭代器，发出并消费一个事件，调用 `iterator.return()`，然后断言监听器已被移除且恰好发送了一个匹配的 Bun 中止请求。

- [ ] **步骤 6：测试并发流隔离**

启动两个迭代器，捕获它们不同的流 ID，为每个流发出交错的事件和终止消息，并断言每个迭代器只接收自己的事件。断言两个监听器均被移除，且正常完成后未发送中止请求。

- [ ] **步骤 7：添加 FIFO 回归断言**

在通过真实迭代器驱动排队的多事件流时，临时用包装器替换 `Array.prototype.shift`，该包装器记录来自 `rpc-transport.ts` 的调用，并在 `finally` 中恢复。断言传输排空执行零次前端移除。这是针对现有实现的有意 RED 断言；生命周期断言继续验证行为而非假调用接线。

- [ ] **步骤 8：运行聚焦测试并记录 RED**

运行：

```bash
PATH="$HOME/.bun/bin:$PATH" bun test apps/desktop/src/client/rpc-transport.test.ts
```

预期：生命周期用例通过，而 FIFO 回归失败，因为当前传输对每个已消费事件调用 `events.shift()`。

---

### 任务 2：用释放游标队列替换前端移除

**文件：**
- 修改：`apps/desktop/src/client/rpc-transport.ts`
- 测试：`apps/desktop/src/client/rpc-transport.test.ts`

**接口：**
- 消费：不变的 `createRpcTransport(): AgentTransport` 公共工厂。
- 产出：相同的有序 `AsyncIterable<AgentEvent>` 和终止语义，具有摊还 O(1) 出队。

- [ ] **步骤 1：实现基于游标的出队**

将缓冲区表示为 `(AgentEvent | undefined)[]` 加上 `eventHead`。使用 `events.push(message.event)` 入队。不使用 shift 进行出队：

```ts
const event = events[eventHead];
events[eventHead] = undefined;
eventHead += 1;
yield event!;
```

清除槽位会立即释放已消费的事件。当队列变为空时，重置 `events.length = 0` 和 `eventHead = 0`；这会释放底层引用并防止头部增长。如果生产者和消费者交错且尾部非空，则仅在超过阈值且已消费前缀至少为数组一半时进行压缩，使压缩摊还 O(1)。

- [ ] **步骤 2：运行聚焦测试并记录 GREEN**

运行：

```bash
PATH="$HOME/.bun/bin:$PATH" bun test apps/desktop/src/client/rpc-transport.test.ts
```

预期：所有传输生命周期和 FIFO 测试均通过，零失败。

- [ ] **步骤 3：仅在绿色状态下重构**

仅当提取小的模块私有辅助函数/常量有助于阐明游标重置/压缩不变量时才进行提取。不要更改 RPC 载荷、终止顺序、监听器设置、中止行为或 `AgentTransport` 签名。

- [ ] **步骤 4：重构后重新运行聚焦测试**

运行相同的聚焦命令。预期：所有测试通过且无警告/错误输出。

---

### 任务 3：验证、自我审查并提交

**文件：**
- 审查：`apps/desktop/src/client/rpc-transport.ts`
- 审查：`apps/desktop/src/client/rpc-transport.test.ts`
- 审查：`docs/superpowers/plans/2026-07-17-issue-75-rpc-fifo.md`

**接口：**
- 消费：仓库 Bun、ESLint 和 TypeScript 任务。
- 产出：一个引用 Issue #75 的已验证本地提交。

- [ ] **步骤 1：运行完整测试套件**

```bash
PATH="$HOME/.bun/bin:$PATH" bun test
```

预期：所有测试通过，零失败。

- [ ] **步骤 2：运行 lint 和类型检查**

```bash
PATH="$HOME/.bun/bin:$PATH" mise run lint
PATH="$HOME/.bun/bin:$PATH" mise run typecheck
```

预期：两个命令均以退出码 0 结束。

- [ ] **步骤 3：对照每个验收标准审查差异**

确认顺序、完成前排空、远程拒绝、一次性信号中止、提前退出监听器移除加 Bun 中止、流 ID 隔离、终止清理、摊还 O(1) 出队以及已清除的已消费槽位。确认 `git diff --check` 报告无空白错误且无无关文件更改。

- [ ] **步骤 4：提交已验证的更改**

```bash
git add apps/desktop/src/client/rpc-transport.ts apps/desktop/src/client/rpc-transport.test.ts docs/superpowers/plans/2026-07-17-issue-75-rpc-fifo.md
git commit -m "perf: make RPC stream queue amortized O(1) (#75)"
```

预期：在 `issue-75-rpc-fifo` 上创建一个提交；不推送任何内容。