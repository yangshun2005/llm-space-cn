# 提供商托管工具实施计划

> **面向智能体工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实施本计划。步骤使用复选框（`- [ ]`）语法进行跟踪。

**目标：** 允许用户配置提供商托管的工具对象，将其原样转发给模型服务，并持久化和展示托管工具的活动、来源和引用，而不将这些工具视为本地可执行的 ReAct 工具。

**架构：** 产品和持久化领域使用 `ProviderHostedTool`、`provider-hosted` 判别式和 `providerHostedToolActivities`；只有打过补丁的 pi Responses 边界使用 `responseApiNativeTools` 和 `nativeToolActivities`。渲染器将托管定义与客户端工具分区，运行时在无能力预检的情况下将其附加到提供商负载中，reducer 将提供商输出映射回提供商中立的线程数据。旧的分支时代字段在验证前被规范化，包括嵌套的运行历史快照。

**技术栈：** TypeScript 6、Bun 1.3、TypeBox、Zod、Zustand、React 19、Electrobun、`@earendil-works/pi-ai` 0.83.0、`@earendil-works/pi-agent-core` 0.83.0、兼容 OpenAI 的响应流式传输。

---

## 文件映射

- `packages/core/src/types/shared/json-value.ts` — 递归 JSON-only 模式，用于不透明工具定义和原始提供商输出。
- `packages/core/src/types/tools/index.ts` — 规范的提供商托管工具契约、身份、旧版规范化和不可执行不变量。
- `packages/core/src/types/messages/provider-hosted-tool.ts` — 提供商托管活动、来源和原始响应输出类型。
- `packages/core/src/types/messages/contents.ts` 和 `packages/core/src/types/messages/messages.ts` — 文本注解和持久化的助手元数据。
- `packages/core/src/types/threads/thread.ts` 和 `packages/core/src/types/threads/thread-zod.ts` — 验证前的当前线程和嵌套运行历史迁移。
- `packages/core/src/client/converters.ts` 和 `packages/core/src/client/reducer.ts` — 产品领域到 pi 边界的双向映射。
- `packages/core/src/server/agent/stream.ts` — 原始提供商负载注入，同时保持托管工具在客户端 ReAct 工具列表之外。
- `packages/runtime/src/models/providers/deepseek.ts` — DeepSeek 提供商，`deepseek-v4-flash` 通过响应适配器路由。
- `patches/@earendil-works%2Fpi-ai@0.83.0.patch` — 用于原始托管定义、终端输出重放、活动和注解的窄依赖桥接。
- `packages/ui/src/components/thread-playground/tool/provider-hosted-tool-config.ts` 和 `packages/ui/src/components/thread-playground/tool/provider-hosted-tool-editor-dialog.tsx` — 通用 JSON 解析器和编辑器。
- `packages/ui/src/components/thread-playground/tool/tool-list-view.tsx` 和 `packages/ui/src/components/thread-playground/tool/tool-list-item.tsx` — 添加/编辑/移除入口点和身份安全芯片。
- `packages/ui/src/components/thread-playground/message/provider-hosted-tool-activity-list.tsx`、`packages/ui/src/components/thread-playground/message/provider-hosted-tool-activity-utils.ts`、`packages/ui/src/components/thread-playground/message/citation-list.tsx`、`packages/ui/src/components/thread-playground/message/text-citation-utils.ts` 和 `packages/ui/src/components/thread-playground/message/use-text-citation-extension.ts` — 只读托管活动和引用展示。
- `packages/core/src/generator/langgraph/index.ts` — 对不支持的导出目标的显式保护。
- `docs/superpowers/specs/2026-08-01-provider-hosted-tools-design.md` — 设计原理、协议边界、所有权、兼容性和非目标。

### 任务 1：定义规范领域和兼容性边界

**文件：**
- 创建：`packages/core/src/types/shared/json-value.ts`
- 创建：`packages/core/tests/types/shared/json-value.test.ts`
- 修改：`packages/core/src/types/shared/index.ts`
- 修改：`packages/core/src/types/tools/index.ts`
- 修改：`packages/core/tests/types/tools/index.test.ts`
- 创建：`packages/core/src/types/messages/provider-hosted-tool.ts`
- 修改：`packages/core/src/types/messages/index.ts`
- 修改：`packages/core/src/types/messages/contents.ts`
- 修改：`packages/core/src/types/messages/messages.ts`
- 修改：`packages/core/src/types/threads/thread.ts`
- 修改：`packages/core/src/types/threads/thread-zod.ts`
- 修改：`packages/core/tests/types/threads/thread.test.ts`
- 修改：`packages/core/tests/types/threads/thread-zod.test.ts`

- [ ] **步骤 1：编写失败的架构和迁移测试**

添加一个带有嵌套、提供商特定 JSON 的规范工具夹具，并断言其被接受、保留、唯一键控且永不可执行：

在 `packages/core/tests/types/tools/index.test.ts` 中，添加
`import { Compile } from "typebox/compile";`，并将 `getToolKey` 和 `Tool` 添加到
现有的 `./index` 值导入中，然后插入夹具：

```ts
const tool = {
  type: "provider-hosted",
  config: {
    type: "web_search",
    search_context_size: "high",
    user_location: { type: "approximate", country: "CN" },
    external_web_access: false,
  },
} as const;

expect(Compile(Tool).Check(tool)).toBe(true);
expect(normalizeTool(tool)).toBe(tool);
expect(isExecutableTool(tool)).toBe(false);
expect(getToolKey(tool)).toBe("provider-hosted:web_search");
```

将这些兼容性测试添加到
`packages/core/tests/types/threads/thread-zod.test.ts`：

```ts
test("在验证前规范化旧版提供商托管字段", () => {
  const parsed = ThreadZodSchema.parse({
    context: {
      tools: [
        {
          type: "response-api-native",
          config: { type: "web_search", search_context_size: "high" },
        },
      ],
      messages: [
        {
          id: "assistant-legacy",
          role: "assistant",
          content: [],
          nativeToolActivities: [
            {
              type: "web_search_call",
              raw: { type: "web_search_call" },
            },
          ],
        },
      ],
    },
    runHistory: [
      {
        timestamp: 1,
        thread: {
          context: {
            messages: [
              {
                id: "assistant-run",
                role: "assistant",
                content: [],
                nativeToolActivities: [
                  {
                    type: "web_search_call",
                    raw: { type: "web_search_call" },
                  },
                ],
              },
            ],
          },
        },
      },
    ],
  });

  expect(parsed.context?.tools?.[0]?.type).toBe("provider-hosted");
  expect(parsed.context?.messages?.[0]).toHaveProperty(
    "providerHostedToolActivities"
  );
  expect(
    parsed.runHistory?.[0]?.thread.context?.messages?.[0]
  ).toHaveProperty("providerHostedToolActivities");
  expect(JSON.stringify(parsed)).not.toContain("nativeToolActivities");
});

test("当两个字段名都存在时保留规范活动", () => {
  const currentActivity = {
    type: "current_web_search_call",
    raw: { type: "current_web_search_call" },
  };
  const parsed = ThreadZodSchema.parse({
    context: {
      messages: [
        {
          id: "assistant-mixed",
          role: "assistant",
          content: [],
          providerHostedToolActivities: [currentActivity],
          nativeToolActivities: [
            {
              type: "legacy_web_search_call",
              raw: { type: "legacy_web_search_call" },
            },
          ],
        },
      ],
    },
  });

  expect(
    parsed.context?.messages?.[0]?.role === "assistant"
      ? parsed.context.messages[0].providerHostedToolActivities
      : undefined
  ).toEqual([currentActivity]);
  expect(JSON.stringify(parsed)).not.toContain("nativeToolActivities");
});
```

将此运行时规范化器回归测试添加到 `thread.test.ts`：

将 `normalizeThread` 添加到现有的 `./thread` 值导入中；该文件
已导入下方转换使用的 `Thread` 架构。

```ts
test("递归规范化旧版工具和活动字段", () => {
  const legacyMessage = {
    id: "assistant-legacy",
    role: "assistant" as const,
    content: [{ type: "text" as const, text: "Result" }],
    nativeToolActivities: [
      {
        id: "ws_1",
        type: "web_search_call",
        raw: { id: "ws_1", type: "web_search_call" },
      },
    ],
  };
  const legacyContext = {
    tools: [
      {
        type: "response-api-native" as const,
        config: { type: "web_search", search_context_size: "high" },
      },
    ],
    messages: [legacyMessage],
  };
  const normalized = normalizeThread({
    context: legacyContext,
    runHistory: [{ thread: { context: legacyContext }, timestamp: 1 }],
  } as unknown as Thread);

  expect(normalized.context?.tools?.[0]).toEqual({
    type: "provider-hosted",
    config: { type: "web_search", search_context_size: "high" },
  });
  expect(normalized.context?.messages?.[0]).toMatchObject({
    providerHostedToolActivities: legacyMessage.nativeToolActivities,
  });
  expect(
    normalized.runHistory?.[0]?.thread.context?.messages?.[0]
  ).toMatchObject({
    providerHostedToolActivities: legacyMessage.nativeToolActivities,
  });
  expect(JSON.stringify(normalized)).not.toContain("nativeToolActivities");
});
```

- [ ] **步骤 2：运行聚焦测试并验证 RED**

运行：

```bash
bun test packages/core/tests/types/shared/json-value.test.ts packages/core/tests/types/tools/index.test.ts packages/core/tests/types/threads/thread.test.ts packages/core/tests/types/threads/thread-zod.test.ts
```

预期：非零退出，因为规范的提供商托管架构和递归兼容性规范化尚不存在。

- [ ] **步骤 3：实现仅 JSON 的工具和响应架构**

创建 `packages/core/src/types/shared/json-value.ts`，内容精确如下，以便
编辑器可以接受任意 JSON 字段，而不接受 `undefined`、函数、符号或 `bigint`：

```ts
import { Type, type Static } from "typebox";

const JSON_VALUE_REF = "#/$defs/JsonValue";

export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

const JSON_VALUE_DEFINITIONS = {
  JsonValue: Type.Union([
    Type.Null(),
    Type.Boolean(),
    Type.Number(),
    Type.String(),
    Type.Array(Type.Ref(JSON_VALUE_REF)),
    Type.Record(Type.String(), Type.Ref(JSON_VALUE_REF)),
  ]),
};

export const JsonValue = Type.Unsafe<JsonValue>({
  $defs: JSON_VALUE_DEFINITIONS,
  $ref: JSON_VALUE_REF,
});

export const JsonObject = Type.Record(Type.String(), JsonValue);
export type JsonObject = Static<typeof JsonObject>;
```

从 `packages/core/src/types/shared/index.ts` 导出新的共享架构：

```ts
export * from "./json-value";
```

在 `packages/core/src/types/tools/index.ts` 中，扩展共享导入并在 `BuiltinToolCallResponse` 之后插入规范的工具信封：

```ts
import { JSONSchema, JsonValue } from "../shared";

export const ProviderHostedToolConfig = Type.Intersect([
  Type.Object({
    type: Type.String({
      minLength: 1,
      pattern: "^(?!(?:function|custom)$)\\S(?:.*\\S)?$",
    }),
  }),
  Type.Record(Type.String(), JsonValue),
]);
export type ProviderHostedToolConfig = Static<
  typeof ProviderHostedToolConfig
> &
  Record<string, JsonValue>;

export const ProviderHostedTool = Type.Object({
  type: Type.Literal("provider-hosted"),
  config: ProviderHostedToolConfig,
});
export type ProviderHostedTool = Omit<
  Static<typeof ProviderHostedTool>,
  "config"
> & {
  config: ProviderHostedToolConfig;
};

export interface LegacyResponseApiNativeTool {
  type: "response-api-native";
  config: ProviderHostedToolConfig;
}
```

替换 TypeBox 和 TypeScript 的 `Tool` 联合类型，以便步骤 1 的夹具
可以针对公共工具契约进行编译和验证：

```ts
export const Tool = Type.Union([
  FunctionTool,
  McpTool,
  BuiltinTool,
  ProviderHostedTool,
]);
export type Tool =
  | FunctionTool
  | McpTool
  | BuiltinTool
  | ProviderHostedTool;
```

创建 `packages/core/src/types/messages/provider-hosted-tool.ts`，内容精确如下：

```ts
import { Type, type Static } from "typebox";

import { JsonObject, JsonValue } from "../shared";

export const ProviderHostedToolSource = Type.Object({
  url: Type.String(),
  title: Type.Optional(Type.String()),
});
export type ProviderHostedToolSource = Static<typeof ProviderHostedToolSource>;

export const ProviderHostedToolActivity = Type.Object({
  id: Type.Optional(Type.String()),
  type: Type.String(),
  status: Type.Optional(Type.String()),
  action: Type.Optional(JsonObject),
  result: Type.Optional(JsonValue),
  sources: Type.Optional(Type.Array(ProviderHostedToolSource)),
  raw: JsonObject,
});
export type ProviderHostedToolActivity = Static<
  typeof ProviderHostedToolActivity
>;

export const ResponseOutputItem = JsonObject;
export type ResponseOutputItem = Static<typeof ResponseOutputItem>;
```

从 `packages/core/src/types/messages/index.ts` 导出消息架构：

```ts
export * from "./provider-hosted-tool";
```

在 `packages/core/src/types/messages/contents.ts` 中添加注解架构和精确的 `TextContent` 字段：

```ts
import { JsonObject } from "../shared";

export const TextAnnotation = Type.Object({
  type: Type.String(),
  url: Type.Optional(Type.String()),
  title: Type.Optional(Type.String()),
  startIndex: Type.Optional(Type.Number({ minimum: 0 })),
  endIndex: Type.Optional(Type.Number({ minimum: 0 })),
  raw: JsonObject,
});
export type TextAnnotation = Static<typeof TextAnnotation>;

annotations: Type.Optional(Type.Array(TextAnnotation)),
```

在 `packages/core/src/types/messages/messages.ts` 中，导入 `ProviderHostedToolActivity` 和 `ResponseOutputItem`，然后在 `toolCalls` 之后添加这些精确的助手字段：

```ts
providerHostedToolActivities: Type.Optional(
  Type.Array(ProviderHostedToolActivity)
),
responseOutputItems: Type.Optional(Type.Array(ResponseOutputItem)),
```

- [ ] **步骤 4：实现规范身份和旧版读取迁移**

仅将旧版名称保留为接受的输入，并立即规范化它们：

```ts
export function normalizeTool(
  tool: Tool | LegacyTool | LegacyResponseApiNativeTool
): Tool {
  if (tool.type === "response-api-native") {
    return { type: "provider-hosted", config: tool.config };
  }
  if (tool.type === "provider-hosted") {
    return tool;
  }
  if (tool.type === "builtin") {
    if (tool.name === "ask_user_question" && tool.terminate !== true) {
      return { ...tool, terminate: true };
    }
    return tool;
  }
  if (tool.type === "mcp") {
    return tool;
  }
  const legacySource = _getLegacyMcpSource(tool);
  if (legacySource) {
    return {
      type: "mcp",
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
      ...(tool.strict === undefined ? {} : { strict: tool.strict }),
      serverId: legacySource.serverId,
      serverName: legacySource.serverName,
      toolName: legacySource.toolName,
    };
  }
  if (tool.type === "function" && !("source" in tool)) {
    return tool as FunctionTool;
  }
  return {
    type: "function",
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    ...(tool.strict === undefined ? {} : { strict: tool.strict }),
  };
}

export function isProviderHostedTool(
  tool: Tool
): tool is ProviderHostedTool {
  return tool.type === "provider-hosted";
}

export function getToolKey(tool: Tool): string {
  return isProviderHostedTool(tool)
    ? `provider-hosted:${tool.config.type}`
    : tool.name;
}
```

在 `packages/core/src/types/threads/thread.ts` 中，在添加规范化器之前扩展消息导入：

```diff
-import { Message, ModelUsage } from "../messages";
+import {
+  type AssistantMessage,
+  Message,
+  ModelUsage,
+  type ProviderHostedToolActivity,
+} from "../messages";
```

在 `packages/core/src/types/threads/thread.ts` 中，使用此路径感知的运行时规范化。它仅访问线程上下文和运行快照，因此不透明的提供商配置、`raw` 和 `action` JSON 保持不变：

```ts
export function normalizeThread(thread: Thread): Thread {
  const context = thread.context;
  const runHistory = thread.runHistory;
  let next = thread;

  if (context) {
    const normalizedContext =
```