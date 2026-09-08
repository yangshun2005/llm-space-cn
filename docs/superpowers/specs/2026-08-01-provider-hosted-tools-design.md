# 提供商托管工具设计

**状态：** 已实现。执行和验证序列见
[`../plans/2026-08-01-provider-hosted-tools.md`](../plans/2026-08-01-provider-hosted-tools.md)。

## 摘要

LLM Space 允许用户在其内置、MCP 和自定义函数工具选项旁边添加原始提供商托管工具配置。提供商托管工具是一个 JSON 对象，例如 `{ "type": "web_search" }`，它与线程一起持久化。其完整的 JSON 对象将原封不动地附加到所选模型服务的工具负载中；字段含义和支持情况仍由提供商决定。

提供商在模型请求内部拥有执行权。LLM Space 不在本地运行这些工具，`自动运行工具`、审批设置和外部 ReAct 循环均不控制它们。当提供商返回托管工具输出时，LLM Space 会保留并渲染活动、来源和文本引用。

该功能特意不维护提供商/模型能力矩阵，也不预检工具定义。提供商验证仍具有权威性；不支持的配置将以提供商错误的形式呈现。

## 术语与分层

- 产品和领域语言：**提供商托管工具**。
- 持久化/运行时领域名称：`ProviderHostedTool`、`ProviderHostedToolConfig`、`providerHostedToolActivities` 以及 `provider-hosted` 判别符。
- pi-ai Responses 适配器边界：`responseApiNativeTools` 和 `nativeToolActivities`。保留这些名称是因为它们是补丁后的 `@earendil-works/pi-ai` 契约中的字段，而非产品概念。
- 旧版兼容性：早期功能分支写入的带有 `response-api-native` 或 `nativeToolActivities` 的线程文件将被接受并规范化，包括 `runHistory` 快照中的消息。

这种区分使 UI 保持提供商中立，同时不掩盖在依赖边界实现的具体的 Responses 协议。

## 目标

- 在 `添加自定义函数工具` 旁边添加 `添加提供商托管工具` 菜单选项。
- 允许用户创建和编辑完整的工具 JSON。
- 仅验证安全传输所需的可移植结构。
- 逐字保留未知字段和未知的托管工具类型。
- 使提供商托管工具不进入本地执行、审批、自动运行和 ReAct 继续路径。
- 持久化并显示托管活动输出，包括网络搜索引用。
- 当规范化字段不可用时，保留原始提供商输出。

## 非目标

- 发现或验证特定模型的托管工具支持。
- 维护受支持的提供商、模型、工具类型或工具特定参数的白名单。
- 将提供商托管工具转换为函数、MCP 或内置工具。
- 自动回退到 LLM Space 的内置 `web_search`。
- 实现提供商托管的 MCP 审批流程。
- 替换 `pi-agent-core` 或更改外部 ReAct 循环协议。

## 面向用户的语义

工具添加菜单包括：

```text
添加内置工具
添加 MCP 工具
------------------
添加提供商托管工具
添加自定义函数工具
```

编辑器初始内容为：

```json
{
  "type": "web_search"
}
```

用户可以添加工具特定的 JSON 字段，例如：

```json
{
  "type": "web_search",
  "search_context_size": "high",
  "user_location": {
    "type": "approximate",
    "country": "CN"
  }
}
```

除 `type` 之外的字段可以包含任何 JSON 值，并将原样传递。例如，一个服务可能为 `web_search` 接受 `search_context_size`，而另一个托管工具可能需要标识符、过滤器、审批设置或其他工具特定数据。LLM Space 验证的是通用外壳，而非特定提供商、模型或工具类型是否支持每个字段。

编辑器配置请求 `tools` 数组中的一个对象。请求级控制，如 `tool_choice`、`include`、`reasoning` 和 `background`，不是该工具对象的字段，也不在此编辑器中配置。将它们放入 JSON 中并不会配置相应的顶级请求选项；提供商反而可能将其作为未知工具字段拒绝。

## 领域模型

```ts
interface ProviderHostedTool {
  type: "provider-hosted";
  config: {
    type: string;
    [key: string]: JsonValue;
  };
}
```

`config.type` 标识提供商工具，所有其他 JSON 字段均被保留。解析器要求一个对象、一个非空字符串 `type`、仅 JSON 值，并拒绝 `function` 和 `custom`，因为它们的输出需要客户端工具结果。稳定标识为 `provider-hosted:${config.type}`。

线程 Zod 边界在验证前将早期的 `response-api-native` 判别符规范化。运行时规范化对已构造的线程对象提供相同的兼容性。

## 运行时架构

`convertToPiContext()` 根据执行所有权对工具进行分区：

```ts
interface PiThreadContext {
  systemPrompt?: string;
  messages: pi.Message[];
  tools: pi.Tool[];
  responseApiNativeTools: ProviderHostedToolConfig[];
}
```

函数、MCP 和内置工具进入 `tools`。提供商托管配置在不重写字段的情况下被复制到面向 pi 的 `responseApiNativeTools` 通道中。因此，`pi-agent-core` 无法在本地执行它们，也无法使用它们来继续客户端 ReAct 循环。

`streamAgent()` 将这些原始配置附加到适配器的最终工具负载中。只要线程具有提供商托管工具，它就会执行此操作：交付不受 `model.api`、提供商元数据、能力标志或本地支持矩阵的限制。适配器/提供商可以接受或拒绝结果。

### 执行所有权

提供商托管的执行发生在模型服务的请求内部。该服务可以在完成响应之前内部执行一个或多个托管调用；这些调用是响应数据，而非要求 LLM Space 执行工具的中断。

外部 `pi-agent-core` ReAct 循环只能看到客户端函数、MCP 和内置工具。因此，`自动运行工具`、本地可执行工具谓词、手动工具结果输入和本地审批控制既不会启动也不会停止提供商托管的调用。这种分离也防止了提供商输出（如 `web_search_call`）导致额外的客户端 ReAct 继续。

## pi-ai 补丁边界

锁定的 `@earendil-works/pi-ai@0.83.0` 版本未公开所需的托管工具输入和 Responses 输出元数据，因此 LLM Space 携带精确版本的 Bun 补丁 `patches/@earendil-works%2Fpi-ai@0.83.0.patch`。该补丁：

- 在 pi 流式边界接受 `responseApiNativeTools`；
- 将原始定义附加到 Responses 请求的 `params.tools`；
- 为无状态重放保留终端 Responses 输出；并且
- 公开 pi 助手的 `nativeToolActivities` 和响应注解。

这些依赖字段名称保持不变。LLM Space 在 `converters.ts` 和 `reducer.ts` 中将它们与提供商托管领域进行映射。类似的上游请求 [earendil-works/pi#4955](https://github.com/earendil-works/pi/issues/4955) 已关闭，目前没有计划支持此类行为，因此此功能不等待单独的 pi Pull Request。

每次 pi-ai 升级都必须重新评估补丁，而不是盲目地沿用：

1. 在未注册旧补丁的情况下安装候选依赖。
2. 运行直接的 pi 契约、运行时负载、转换器和 reducer 测试。
3. 如果上游现在提供等效的原始输入、终端输出重放、活动和注解契约，则删除补丁。
4. 否则，针对确切的已安装版本重新生成补丁，更新 `patchedDependencies`，运行 `bun install`，并重新运行重点和完整门禁。

## 响应规范化与持久化

pi 适配器收集非客户端的 Responses 输出项，如 `web_search_call`。完整的原始项被保留，并在可用时规范化常见字段。`responseOutputItems` 保留终端提供商的顺序，以供后续无状态重放。

在边界处，pi 的 `nativeToolActivities` 变为 LLM Space 的 `providerHostedToolActivities`。助手文本注解和 `responseOutputItems` 与线程一起持久化。重放已保存的线程会将活动字段映射回 pi 的依赖契约，而不会创建本地的 `ToolCall` 或 `ToolResultMessage`。

旧的 `nativeToolActivities` 字段在线程验证/持久化之前，会在当前消息和嵌套的 run-history 快照中都被规范化。早期的 `response-api-native` 判别符同样被重写为 `provider-hosted`。如果新旧活动键共存，则规范字段优先，新保存仅包含规范领域名称。

## 提供商特定行为

- 配置了 `openai-responses` 适配器的 OpenAI GPT 模型可以通过兼容 Responses 的请求接收提供商托管的定义。该补丁理解诸如 `web_search_call` 之类的 Responses 输出项，但这并不意味着每个 GPT 模型都支持每种托管工具类型或参数。
- `deepseek-v4-flash` 在本地注册了 `openai-responses` 传输。这只是一个传输决策；并不声称 DeepSeek 服务支持 OpenAI 的托管 `web_search`、接受相同的工具字段或返回每个 OpenAI 输出形状。
- 其他适配器在其提供商特定的工具负载位置接收原始对象。成功行为完全取决于该模型服务；不支持的对象或字段预计会以其提供商错误失败。

LLM Space 特意不从提供商名称、模型 ID 或 Responses 传输选择中推断能力。这保持了存储配置的可移植性，同时避免了对 OpenAI、DeepSeek 或兼容的第三方服务做出虚假声明。

## 展示

- 已配置的提供商托管工具使用云图标，显示 `config.type`，并在工具提示中显示其完整的格式化 JSON。
- 其编辑器说明提供商在模型请求内部运行该工具，并且自动运行工具不控制它。
- 助手活动呈现紧凑的状态/来源视图，并带有可展开的原始 JSON。未知活动类型使用相同的通用表示。
- URL 引用使用现有的安全外部链接行为。
- 提供商托管的活动从不呈现本地执行按钮或缺失结果状态。
- 文本引用在有效时使用规范化的注解范围，并在范围缺失或无效时回退到安全来源列表。

## 错误处理

- 无效的 JSON 或通用结构：保持编辑器打开并显示可操作的验证消息。
- 不支持的工具类型或参数：呈现提供商错误，不重试或静默移除配置。
- 未知输出项：将其保留为通用活动。
- 提供商托管的 MCP 审批请求：在可能的情况下保留/显示返回的数据，但不启动交互式审批流程；该工作流明确不在本功能范围内。
- LangGraph 导出：明确失败，因为生成的 Python 运行时与 TypeScript 适配器不共享。

## 测试策略

所需覆盖范围包括：

1. 解析保留任意 JSON 字段（如 `search_context_size` 和 `user_location`），并拒绝无效的通用结构。
2. 新线程往返 `provider-hosted` 判别符和 `providerHostedToolActivities`。
3. 旧版当前和 run-history 数据在 Zod 验证前规范化。
4. `convertToPiContext()` 分离本地工具并通过 `responseApiNativeTools` 转发完整的原始配置。
5. reducer 将 pi 的 `nativeToolActivities` 映射到领域字段。
6. 提供商输出、响应重放元数据、引用和通用活动渲染保持完整。
7. 提供商托管工具从不进入本地执行或 ReAct 继续。
8. 完整的测试、类型检查、lint 和构建验证保持干净。

## 参考

- [OpenAI 工具指南](https://developers.openai.com/api/docs/guides/tools)
- [OpenAI 网络搜索指南](https://developers.openai.com/api/docs/guides/tools-web-search)
- [OpenAI Responses API 参考](https://developers.openai.com/api/reference/resources/responses/methods/create)
- [DeepSeek Responses API 指南](https://api-docs.deepseek.com/guides/responses_api/)