# 核心概念

LLM Space 是一个用于开发、调试和评估提示词与代理的桌面工作台。你可以将 Thread 视为一个已保存的实验文件：它记录了对话上下文、所选模型、可用工具，以及运行过程中产生的消息和工具调用结果。

# Thread

Thread 是 LLM Space 中的基本工作单元。一个 Thread 通常包含：

- 标题：显示在文件树和标签栏中。
- 模型：该 Thread 运行时所使用的默认模型。
- 系统提示词：发送给模型的全局指令。
- 变量：可在系统提示词、消息和工具结果中引用的占位符。
- 工具：模型可以调用的工具定义。
- 消息：由用户和助手消息组成的对话历史。
- 工具调用：记录在助手消息上的工具调用请求和结果。
- 运行历史：用于回放、比较和调试的历史运行快照。
- 评估：用于比较不同运行结果的手动评估记录。

在界面中，创建、打开、复制、移动和删除 Thread 本质上就是在工作区中管理 Thread 文件。

你还可以通过[共享 Thread](./sharing.md) 发布只读副本，或通过[生成项目](./generating-projects.md)将 Thread 转换为可编辑的代理代码库。

# 评估标准

运行历史允许你选择两次持久化运行并比较其已保存的证据。你可以保留简单的总体判定和备注工作流，或选择当前 Thread 拥有的可复用评估标准。

一个评估标准包含 2-6 个有序的评判标准。每个标准都有名称和可选描述，每次被比较的运行都会获得 1（差）到 5（优秀）的分数。LLM Space 会计算运行 A 和运行 B 的未加权平均值以及 `B - A` 的差值；总体判定仍由人工单独决定。

已保存的评估包含评估标准和分数的不可变快照，并以稳定的运行 ID 为键。编辑或删除可复用的评估标准定义不会重写历史评估。评估标准、快照、分数、判定和备注都保存在本地 Thread JSON 中，不会触发另一次模型调用。

# 模型

模型是运行期间实际调用的语言模型，例如 OpenAI、Anthropic、Ark 下的模型 ID，或自定义兼容 API。

Thread 可以保存自己的模型配置：

| 字段 | 含义 |
| --- | --- |
| `provider` | 模型提供商 ID。 |
| `id` | 模型 ID。 |
| `params.maxTokens` | 运行时可生成的最大 token 数。 |
| `params.temperature` | 采样温度。 |
| `params.reasoning` | 推理级别或推理努力程度，取决于模型支持情况。 |
| `params.responseType` | 响应类型，如纯文本或结构化输出。 |
| `params.extra` | 传递给特定模型的额外参数。 |

如果 Thread 未保存模型，界面会回退到当前可用的模型进行显示和运行。一旦你手动选择模型，该模型配置将与 Thread 一起保存。

# 模型提供商

模型提供商是一种提供商配置。它告诉 LLM Space 在哪里调用模型、使用哪种 API 兼容模式、使用哪个 API 密钥，以及哪些模型可用。

常见的提供商信息包括：

| 配置 | 描述 |
| --- | --- |
| 提供商名称和 ID | 用于在模型选择器和配置文件中标识提供商。 |
| API 密钥 | 调用该提供商模型所需的密钥。 |
| Base URL | 自定义 API 端点。留空则使用默认端点。 |
| API 兼容模式 | 例如 Anthropic Messages、OpenAI Chat Completions 或 OpenAI Responses。 |
| 模型 | 该提供商下可用的模型。 |
| 已禁用模型 | 被用户隐藏或禁用的模型。 |
| 自定义模型 | 用户手动添加的模型 ID。 |

模型提供商是全局设置。模型是特定 Thread 选择的具体运行时模型。

# 工具

工具是模型可以请求调用的能力。工具定义会发送给模型，模型根据其名称、描述和参数 Schema 决定是否调用它们。

LLM Space 有三种主要类型的工具：

| 类型 | 描述 | 结果来源 |
| --- | --- | --- |
| 内置 | 由应用运行时实现的能力，如文件、命令和网络搜索。其定义遵循常见的代理实现模式。 | 在 LLM Space 内部实现。应用可以自动运行它们，或在需要确认时由用户触发。 |
| 自定义函数工具 | 用户自定义的函数工具定义。它们描述了工具名称、用途和参数，但没有内置的执行后端。 | 用户手动填写结果，或由外部工作流提供。 |
| MCP | 来自 MCP 服务器的工具。LLM Space 连接到 MCP 服务器后，会将服务器提供的工具暴露给模型。 | 由相应的 MCP 服务器执行。 |

一个工具通常包含：

| 字段 | 含义 |
| --- | --- |
| `type` | `builtin`、`function` 或 `mcp`。 |
| `name` | 暴露给模型的工具名称。 |
| `description` | 告知模型何时使用此工具。 |
| `parameters` | 描述工具参数的 JSON Schema。 |

MCP 工具还会保存其来源的 MCP 服务器信息，如 `serverId`、`serverName` 和原始 `toolName`。

# 系统提示词

系统提示词是 Thread 的全局指令。它通常用于定义助手的身份、目标、约束、输出格式和工具使用策略。

系统提示词不会作为普通用户消息显示，但会作为上下文的一部分发送给模型。与在每条用户消息中重复规则相比，将稳定的行为要求放在系统提示词中更易于复用和比较。

# 变量

变量是可以在系统提示词、消息和工具结果中复用的占位符。你在文本中编写 `{{variable_name}}`，运行时 LLM Space 会将其替换为变量的实际值。这让你可以将变化或复用的内容（当前日期、可用技能列表、常用片段等）提取出来，在单一位置进行管理，而不是在多个位置手动编写和维护。

引用语法始终是双大括号，例如 `{{current_date}}`。变量有两种类型：内置变量和自定义变量。

## 内置变量

内置变量会根据当前环境或配置自动计算其值。你只需引用它们，无需填写值：

| 变量 | 描述 | 选项 |
| --- | --- | --- |
| `current_date` | 当前系统日期和时间，使用本地时区。 | 格式：可读日期、ISO 日期或本地日期和时间。 |
| `available_skills` | 当前已启用的技能列表（名称和描述），让模型知道有哪些可用能力。 | 格式：Markdown 列表或 XML；缩进；默认包含所有已启用的技能，也可以只选择部分。 |

`available_skills` 默认展开为所有已启用的技能。如果只想暴露子集，请在变量设置中选择特定技能；空选择表示“所有已启用的技能”。

## 自定义变量

自定义变量是你手动定义的“名称 → 值”对，其中值是固定的文本片段。它适用于在多个位置复用的片段，如共享的语气说明、公司信息或常见约束。定义后，你也可以使用 `{{variable_name}}` 引用它。

变量名必须以字母或下划线开头，且只能包含字母、数字和下划线。

## 解析与存储

- 运行时，文本中的 `{{variable_name}}` 会被替换为变量的当前值，而存储的 Thread 模板保持不变。
- 内置变量定义存储在 `context.variables` 下，自定义变量值存储在 `context.variableVariants` 下。
- 如果引用了不存在或值为空的变量，界面会显示提示。

除了纯文本替换，你还可以添加逻辑——文件包含（`@include`）、条件语句和循环。有关模板语言，请参阅[变量与模板](./variables-and-templates.md)。

# 消息

消息是 Thread 的对话历史。LLM Space 目前使用两种主要的消息角色：

| 角色 | 描述 | 内容 |
| --- | --- | --- |
| 用户 | 用户输入的消息。 | 文本，以及可选的图像数据。 |
| 助手 | 模型生成的消息。 | 文本、推理内容、工具调用和 token 用量。 |

用户消息内容可以是：

- 文本：`{ "type": "text", "text": "..." }`
- 图像数据：`{ "type": "image", "mimeType": "image/png", "data": "..." }`

助手消息内容主要是文本，也可能包含：

- `thinking`：模型返回的推理或思考内容，取决于提供商支持情况。
- `toolCalls`：模型请求的工具调用记录。
- `usage`：模型提供商返回的 token 用量。

当 Thread 变得很长时，[对话压缩](./compaction.md) 可以用结构化检查点替换较旧的对话轮次，同时保持最近的轮次不变。压缩会先预览，然后应用到新的 Thread 文件中，因此源对话仍然可用。

# 工具调用

工具调用是记录在助手消息上的工具调用记录。它表示模型决定调用某个工具并提供了参数。

一个工具调用通常包含：

| 字段 | 含义 |
| --- | --- |
| `id` | 工具调用 ID，用于匹配请求和结果。 |
| `input.name` | 要调用的工具名称。 |
| `input.arguments` | 工具参数对象。 |
| `input.partialArguments` | 无法完全解析的原始参数文本，通常保留用于调试。 |
| `output.content` | 工具返回的文本。 |
| `output.isError` | 工具运行时是否报告了错误。 |

工具调用结果保存在 Thread 中，因此你可以检查模型为何调用工具、使用了哪些参数，以及工具返回了什么。

# 文件存储

LLM Space 是桌面应用，用户数据存储在本地。默认根目录为：

```text
~/.llm-space
```

你可以通过环境变量覆盖它：

```text
LLM_SPACE_HOME=/path/to/data
```

常见目录：

| 路径 | 内容 |
| --- | --- |
| `workspace/` | Thread 文件。 |
| `settings/models.json` | 模型提供商和模型设置。 |
| `settings/mcp.json` | MCP 服务器设置。 |
| `settings/window.json` | 桌面窗口状态。 |
| `settings/skills.json` | 技能发现设置。 |
| `traces/` | 追踪和调试工作台数据。 |

Thread 文件存储在：

```text
~/.llm-space/workspace/
```

工作区中的子目录对应应用左侧的文件树。Thread 文件使用 `.json` 扩展名。文件名是界面中显示标题的来源；保存时，应用会保持 Thread `title` 与文件名一致。

# Thread JSON 格式

原生 Thread 文件是格式化 JSON。核心结构如下所示：

```json
{
  "title": "core-concepts",
  "model": {
    "provider": "openai",
    "id": "gpt-4.1",
    "params": {
      "temperature": 0.7,
      "maxTokens": 4096
    }
  },
  "context": {
    "systemPrompt": "You are a helpful assistant.",
    "tools": [
      {
        "type": "function",
        "name": "lookup_order",
        "description": "Look up an order by ID.",
        "parameters": {
          "type": "object",
          "properties": {
            "orderId": {
              "type": "string"
            }
          },
          "required": ["orderId"]
        }
      }
    ],
    "messages": [
      {
        "id": "msg_1",
        "role": "user",
        "content": [
          {
            "type": "text",
            "text": "Look up order A123 for me."
          }
        ]
      },
      {
        "id": "msg_2",
        "role": "assistant",
        "content": [
          {
            "type": "text",
            "text": "I will look it up."
          }
        ],
        "toolCalls": [
          {
            "id": "call_1",
            "input": {
              "name": "lookup_order",
              "arguments": {
                "orderId": "A123"
              }
            },
            "output": {
              "content": [
                {
                  "type": "text",
                  "text": "Order A123 has shipped."
                }
              ]
            }
          }
        ]
      }
    ]
  }
}
```

实际文件还可能包含 `runHistory`、`evaluationRubrics` 和 `evaluations`。这些字段主要用于调试、回放和手动评估，通常由应用自动维护。基于评估标准的评估会保存自己的评估标准快照，因此后续定义更改不会改变历史结果。

# 支持的导入格式

导入入口根据文件扩展名选择解析器。支持 `.json` 和 `.jsonl`。LLM Space 会尝试识别并规范化以下格式：

| 格式 | 描述 |
| --- | --- |
| 原生 Thread JSON | 已匹配 LLM Space Thread 结构的 JSON。 |
| OpenAI Chat Completions 风格 JSON | 包含 `messages`、`role`、`content` 和 `tool_calls` 等字段的聊天导出。 |
| Anthropic Messages 风格 JSON | 包含 `system`、`messages`、内容块、`tool_use`、`tool_result` 和 `input_schema` 等字段的聊天导出。 |
| Aurora 风格 JSON | 包含 `Messages` 和 `Tools` 的 Aurora Thread 导出。 |
| DeerFlow 运行事件 JSONL | 包含人类、助手和工具消息的持久化运行事件。 |

导入后，外部格式会转换为 LLM Space Thread 结构，并作为新的 `.json` 文件写入当前工作区目录。无法生成消息、系统提示词、工具或模型信息的文件将被跳过。