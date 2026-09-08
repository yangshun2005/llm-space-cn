# 懒加载 Trace 侧边栏实施计划

> **供智能体工作者使用：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实施本计划。步骤使用复选框（`- [ ]`）语法进行跟踪。

**目标：** 将 Trace 侧边栏从初始渲染器图中移除，仅在启用追踪的用户首次选择 Traces 后加载它，同时在模式切换期间保持其挂载状态。

**架构：** 将页面组合中的静态 `TracePanel` 导入替换为 `React.lazy`，并仅在有效侧边栏模式变为 `"traces"` 后通过现有的 `Suspense` 边界渲染它。渲染时的 ref 在其首次选择后锁存面板，因此切换回 Files 时隐藏而非卸载它，从而保留 Trace 项目、标签页、查询、侧边栏和持久化行为。

**技术栈：** React 19（`lazy`、`Suspense`、`useRef`）、TypeScript、Vite/Rollup 生产包检查、Bun、ESLint。

## 全局约束

- 仅在 `/Users/minimax/workspace/llm-space/.worktrees/issue-72` 的 `issue-72-lazy-trace` 分支上工作。
- 使用 Bun 和 mise；不要使用 npm、pnpm 或 yarn。
- 不要添加脆弱的源码字符串测试；使用生产包图/输出作为 RED/GREEN 证明。
- 在追踪被禁用时，不要加载或挂载 `TracePanel`。
- 优先仅在首次选择 Traces 时加载 `TracePanel`。
- 在模式切换期间保留 Trace 项目、标签页、侧边栏状态和持久化行为。
- 保持 Files 模式和首屏渲染不变，且不引入生产环境 Vite 块警告。

---

### 任务 1：建立生产包回归基线

**文件：**

- 检查：`apps/desktop/src/app/page.tsx`
- 检查：`apps/desktop/dist/assets/*`

**接口：**

- 消费：以 `apps/desktop/src/mainview/main.tsx` 为根的 Vite 模块图。
- 产出：记录的 RED 证据，证明当前静态 `TracePanel` 导入将独特的 Trace 侧边栏代码放置在初始 HTML 引用的 JavaScript 块中。

- [ ] **步骤 1：构建未修改的渲染器包**

运行：

```bash
PATH="$HOME/.bun/bin:$PATH" bun --filter @llm-space/desktop build:view
```

预期：生产构建成功并打印其生成的块。

- [ ] **步骤 2：识别初始块和包含 Trace 的块**

运行：

```bash
rg -o 'src="[^"]+\.js"' apps/desktop/dist/index.html
rg -l 'No trace projects|Add trace project|Search remote Langfuse traces' apps/desktop/dist/assets/*.js
```

预期 RED：至少一个被 `index.html` 引用的 JavaScript 文件包含独特的 `TracePanel` UI 文案，证明 Trace 侧边栏代码位于初始静态图中。

### 任务 2：懒加载并锁存 Trace 侧边栏

**文件：**

- 修改：`apps/desktop/src/app/page.tsx`

**接口：**

- 消费：来自 `@/components/trace-panel` 的命名导出 `TracePanel`、`tracingEnabled: boolean` 和 `effectiveSidebarMode: "files" | "traces"`。
- 产出：`LazyTracePanel`，一个 `React.lazy` 组件，其模块仅在有效模式首次变为 `"traces"` 时被请求；`tracePanelMounted.current`，一个在首次挂载后保留组件的单向锁存器。

- [ ] **步骤 1：将静态导入替换为命名导出的懒导入**

在现有的懒加载覆盖层定义旁边添加：

```tsx
const LazyTracePanel = lazy(() =>
  import("@/components/trace-panel").then((m) => ({
    default: m.TracePanel,
  }))
);
```

移除：

```tsx
import { TracePanel } from "@/components/trace-panel";
```

- [ ] **步骤 2：添加渲染时的首次选择锁存器**

在计算 `effectiveSidebarMode` 之后立即添加：

```tsx
const tracePanelMounted = useRef(false);
if (effectiveSidebarMode === "traces") tracePanelMounted.current = true;
```

这有意基于有效模式，因此即使记住的本地组件状态为 `"traces"`，禁用追踪也永远不会触发导入。

- [ ] **步骤 3：仅在锁存器设置后渲染懒面板**

将急切渲染的 Trace 面板分支替换为：

```tsx
{
  tracingEnabled && tracePanelMounted.current && (
    <Suspense fallback={null}>
      <LazyTracePanel
        className={
          effectiveSidebarMode === "traces" ? "min-h-0 flex-1" : "hidden"
        }
        onOpenTrace={handleOpenTrace}
      />
    </Suspense>
  );
}
```

预期：当块不存在时 Files 保持可见；选择 Traces 启动动态导入并挂载面板；返回 Files 时保留已挂载的实例及现有的 `hidden` 类。

- [ ] **步骤 4：格式化修改后的文件**

运行：

```bash
PATH="$HOME/.bun/bin:$PATH" bunx prettier --write apps/desktop/src/app/page.tsx docs/superpowers/plans/2026-07-17-issue-72-lazy-trace.md
```

预期：两个文件均被格式化，无语义变化。

### 任务 3：证明懒块并验证分支

**文件：**

- 检查：`apps/desktop/dist/index.html`
- 检查：`apps/desktop/dist/assets/*`
- 通过 `git diff` 检查所有更改的文件

**接口：**

- 消费：任务 2 引入的懒加载边界。
- 产出：GREEN 构建图证据、仓库检查、可选的真实渲染器证据，以及一个引用 issue #72 的提交。

- [x] **步骤 1：构建并检查生产包**

运行：

```bash
PATH="$HOME/.bun/bin:$PATH" bun --filter @llm-space/desktop build:view
rg -o 'src="[^"]+\.js"' apps/desktop/dist/index.html
rg -l 'No trace projects|Add trace project|Search remote Langfuse traces' apps/desktop/dist/assets/*.js
```

预期 GREEN：Trace 侧边栏文案存在于生成的懒块中，且该块不被 `index.html` 引用；Vite 不打印新的块警告。

- [x] **步骤 2：运行完整的请求验证套件**

运行：

```bash
PATH="$HOME/.bun/bin:$PATH" bun test
PATH="$HOME/.bun/bin:$PATH" bun run lint
PATH="$HOME/.bun/bin:$PATH" bun run typecheck
PATH="$HOME/.bun/bin:$PATH" bun --filter @llm-space/desktop build:view
```

预期：所有四个命令均以退出码 0 结束，最终构建生成相同的懒 Trace 块且无警告。

- [x] **步骤 3：在安全时验证真实渲染器**

遵循 `.agents/skills/electrobun-cdp-debug/SKILL.md`，使用隔离的系统临时数据根启动，并验证：禁用追踪时从不暴露或加载 Trace 面板；启用追踪时保持 Files 为初始模式；首次选择渲染 Traces；Files/Traces 切换保留面板状态。如果环境无法安全运行 CEF/CDP，记录确切未验证的行为，而不是替换为模拟浏览器。

已于 2026-07-18 通过真实的 Electrobun CEF 渲染器验证：禁用模式未暴露 Traces 控件或 Trace 内容；启用模式以 Files 启动且未挂载 Trace；首次选择 Traces 渲染了空的 Trace 项目状态；切换到 Files 保留了隐藏的已挂载面板，切换回来时恢复；渲染器控制台未报告应用错误。

- [ ] **步骤 4：自审并提交**

运行：

```bash
git diff --check
git diff --stat
git diff
git status --short
git add apps/desktop/src/app/page.tsx docs/superpowers/plans/2026-07-17-issue-72-lazy-trace.md
git commit -m "perf: lazy-load trace sidebar (#72)"
git status --short --branch
```

预期：差异审查未发现无关更改；提交成功；分支干净且领先一个提交。