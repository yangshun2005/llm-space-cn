# 插件开发指南

English | [中文](./plugins.zh-CN.md)

---

# 插件开发指南

LLM Space 插件是一个 npm 兼容的包，安装在 `LLM_SPACE_HOME/plugins/` 目录下。一个插件可以提供零个或多个扩展，包括技能、MCP 服务器、模型提供商、工具、命令和线程存储。

本指南介绍当前的插件系统：包结构、元数据、设置、支持的扩展、生命周期、诊断和开发实践。

## 1. 概念

**插件**是分发、版本管理、配置、重载、启用和禁用的单元。**扩展**是插件提供的一项能力。

```text
插件
├── 元数据 (package.json)
├── 设置 (可选)
└── 扩展 (零个或多个)
    ├── 技能
    ├── MCP 服务器
    ├── 模型提供商
    ├── 命令
    ├── 插件工具
    └── 线程存储
```

主要规则如下：

- `package.json` 是唯一的元数据文件。其 `name` 字段同时也是稳定的插件 ID。
- 扩展从约定路径中发现，不在 `package.json` 中枚举。
- 新发现的插件默认启用。
- 插件可以整体启用或禁用。插件技能也可以在 设置 → 技能 中单独启用；其他扩展类型目前不能单独切换。
- 插件设置会自动保存。更改设置会重新加载插件。
- 插件文件是只读贡献。LLM Space 不会重写 `mcp.json`、`models.json`、技能文件或可执行的扩展文件。
- 本地插件完全可信。运行时进程隔离不是安全沙箱。

## 2. 安装与发现

`LLM_SPACE_HOME` 默认为 `~/.llm-space`，因此默认安装目录为：

```text
~/.llm-space/plugins/
```

在启动 LLM Space 之前设置 `LLM_SPACE_HOME` 以使用单独的数据目录。

### 2.1 常规包和作用域包

插件扫描器识别以下结构：

```text
plugins/
├── weather-kit/
│   └── package.json
└── @example/
    └── team-tools/
        └── package.json
```

- 常规包：`plugins/<name>/package.json`
- 作用域包：`plugins/@<scope>/<name>/package.json`

常规包扫描一层深度；作用域包扫描两层深度。发现过程不是递归的，并且会忽略 `node_modules`。

目录必须与 `package.json.name` 完全匹配：

| 安装目录                     | 必需的 `name`           |
| ---------------------------- | ----------------------- |
| `plugins/weather-kit/`       | `weather-kit`           |
| `plugins/@example/team-tools/` | `@example/team-tools`   |

插件根目录、扩展目录和发现的文件必须是真实目录或常规文件。拒绝符号链接，发现的路径不能超出插件根目录。

### 2.2 扩展发现

LLM Space 仅在这些路径发现扩展：

| 路径                              | 扩展                        |
| --------------------------------- | --------------------------- |
| `skills/*/SKILL.md`               | 技能                        |
| `mcp.json`                        | MCP 服务器和工具            |
| `models.json`                     | 模型提供商和模型            |
| `tools/*.{ts,js,mjs}`             | 可执行的插件工具            |
| `commands/*.{ts,js,mjs}`          | 命令面板命令                |
| `thread-storages/*.{ts,js,mjs}`   | 线程存储                    |
| `config.schema.json`              | 插件设置表单                |

除了每个技能目录的内容外，扩展发现不是递归的。例如，`commands/open-dashboard.ts` 会被发现，而 `commands/admin/open-dashboard.ts` 不会被发现。

一个完整的插件可能如下所示：

```text
@example/team-tools/
├── package.json
├── icon.png
├── config.schema.json
├── mcp.json
├── models.json
├── tools/
│   └── project-info.ts
├── skills/
│   └── incident-review/
│       ├── SKILL.md
│       └── references/
├── commands/
│   └── open-dashboard.ts
└── thread-storages/
    └── team-library.ts
```

不要仅仅为了满足目录结构而创建空目录。仅包含技能的插件只需要 `package.json` 及其技能目录。

### 2.3 持久化插件数据

插件**必须**将下载的文件、缓存、索引、数据库和其他运行时生成的状态存储在其安装目录之外，位于：

```text
~/.llm-space/data/plugins/<plugin-name>/
```

对于作用域插件，路径变为 `~/.llm-space/data/plugins/@scope/<plugin-name>/`。应遵循 `LLM_SPACE_HOME` 而不是硬编码 `~/.llm-space`：

```ts
const home = process.env.LLM_SPACE_HOME?.trim()
  || path.join(os.homedir(), ".llm-space");
const dataDirectory = path.join(
  home,
  "data",
  "plugins",
  ...pluginName.split("/"),
);
```

ZIP 安装程序在更新期间会替换插件安装目录。因此，写入 `LLM_SPACE_HOME/plugins/<name>/` 下的任何运行时数据都可能被覆盖或删除。外部的 `data/plugins/<name>/` 目录不属于包替换的一部分，在安装、更新、重载和禁用操作期间保持不变。不要将运行时数据包含在插件 ZIP 中。

### 2.4 设置中的扩展

设置 → 插件 按类型对发现的扩展进行分组，并显示图标、数量、激活状态和任何加载诊断信息。选择扩展可查看其源文件或目录。添加简洁的描述，以便用户在启用或运行插件之前了解它：

| 扩展            | 描述来源                              |
| --------------- | ------------------------------------- |
| 技能            | `SKILL.md` frontmatter 中的 `description` |
| 设置            | `config.schema.json` 中的顶层 `description` |
| 命令            | 类的 `description` 属性               |
| 插件工具        | 类的 `description` 属性               |
| 线程存储        | 类的 `description` 属性               |
| MCP 服务器 / 模型提供商 | 服务器或提供商的 `name`               |

描述是 UI 文案，不是标识符。稳定 ID 仍然来自插件包名称和声明文件或对象 ID。

### 2.4 内置默认插件

LLM Space 附带一个默认插件，即 Memory 插件（`@llm-space/memory`），它通过 `memory_save`、`memory_search` 和 `memory_forget` 插件工具以及一个告知代理何时使用它们的 `memory` 技能，为代理提供跨项目的持久记忆。

启动时，在插件发现之前，桌面应用会将该插件写入 `<home>/plugins/@llm-space/memory/`（如果该目录尚不存在）。种子写入仅执行一次，且从不覆盖：如果您删除、替换或编辑该插件，您的版本将被保留。代理的记忆存储在 `LLM_SPACE_HOME/data/plugins/@llm-space/memory/memories.jsonl` 中，该文件在插件更新后仍然存在，并由所有工作区共享，从而使记忆在设计上实现跨项目。

## 3. `package.json` 中的元数据

最小元数据：

```json
{
  "name": "@example/team-tools",
  "version": "1.0.0",
  "displayName": "Team Tools",
  "description": "Example collaboration extensions for LLM Space.",
  "author": "Example Team",
  "license": "MIT",
  "homepage": "https://example.com/team-tools",
  "engines": {
    "llm-space": ">=4.7.1"
  }
}
```

必填字段：

- `name`：npm 风格的包名称，也是插件 ID。使用小写字母、数字、点、下划线和连字符，可选作用域。
- `version`：有效的 SemVer 版本。
- `engines["llm-space"]`：支持的 LLM Space SemVer 范围。

建议提供 `displayName`、`description`、`author`、`license` 和 `homepage`。其他 npm 字段可以保留在文件中，但 LLM Space 不会因为包声明了 `scripts`、`main`、`module`、`exports` 或 `bin` 而执行代码。

更改 `name` 会创建不同的插件身份。与旧名称关联的设置和持久化引用不会自动迁移。

### 3.1 图标

将图标放在插件根目录：

```text
icon.png
```

建议使用 512 × 512 的 PNG。文件必须是有效的 PNG，不大于 2 MiB，且任一维度不超过 4096 像素。图标缺失或无效时会回退到默认插件图标，并且不会阻止加载。

## 4. 安装、刷新和重载

### 4.1 打包插件 ZIP

安装程序接受以下任一归档结构：

```text
weather-kit-1.2.3.zip          weather-kit-1.2.3.zip
├── package.json               └── weather-kit/
├── tools/                         ├── package.json
└── ...                            ├── tools/
                                   └── ...
```

换句话说，`package.json` 可以位于 ZIP 根目录或恰好一个顶层包目录内。其 `name` 决定安装目录；ZIP 文件名和包装目录名称不决定安装目录。

从插件根目录创建发布归档：

```sh
zip -r ../weather-kit-1.2.3.zip . \
  -x "data/*" ".git/*" ".DS_Store" "__MACOSX/*"
```

将 ZIP 写在插件根目录之外，以免包含自身。不要打包 `data/`：特定于安装的状态属于 `LLM_SPACE_HOME/data/plugins/<plugin-name>/`。包含插件所需的所有扩展源文件、资源和运行时依赖。LLM Space 在解压后不会运行包管理器安装。

当前归档限制为压缩后 50 MiB、解压后 200 MiB 和 10,000 个条目。不安全的绝对路径、`..` 遍历、反斜杠路径以及具有多个包根的归档将被拒绝。常见的 macOS 元数据将被忽略。

### 4.2 通过拖拽 ZIP 安装或更新

1. 启动 LLM Space，将一个或多个 `.zip` 文件拖到主窗口上。
2. 等待 **Drop plugin ZIP to install** 覆盖层出现，然后释放文件。
3. 安装后，使用成功通知中的 **View plugin** 操作，或打开 设置 → 插件。

成功通知包含插件 ID 和已安装版本。`package.json.name` 与已安装插件匹配的 ZIP 将替换该插件的包文件并重新加载它。存储在 `LLM_SPACE_HOME/data/plugins/<plugin-name>/` 的数据保持不变。不同的包名称将作为单独的插件安装；更改 `name` 不是升级或迁移，也不会迁移旧插件的数据。

### 4.3 手动安装

要手动安装未打包的插件：

1. 将完整的插件目录复制到 `LLM_SPACE_HOME/plugins/` 下的正确位置。
2. 打开 设置 → 插件。
3. 选择 **Refresh plugins** 以发现新增、删除或重命名的包。
4. 选择插件并在“常规”选项卡上检查兼容性、位置、扩展和诊断信息。

### 4.4 刷新和重载

编辑已发现插件中的文件后，在该插件上选择 **Reload**。

- **Refresh plugins** 重新扫描安装目录。用于添加、删除和重命名。
- **Reload** 重新加载一个现有插件。在更改其元数据、架构、配置或扩展文件后使用。

LLM Space 不会从注册表获取插件、运行 `npm install`、解析依赖、比较版本或回滚版本。任何运行时依赖必须随插件 ZIP 或目录一起提供。

## 5. 设置

插件启用和配置存储在：

```text
LLM_SPACE_HOME/settings/plugins.json
```

```json
{
  "schemaVersion": 1,
  "plugins": {
    "@example/team-tools": {
      "enabled": true,
      "settings": {
        "endpoint": "https://api.example.com",
        "workspace": "demo"
      }
    }
  }
}
```

没有存储条目的插件行为如同具有：

```json
{
  "enabled": true,
  "settings": {}
}
```

设置会自动保存。禁用或移除插件不会删除其设置，因此重新安装或重新启用同一插件会恢复这些设置。

如果设置文件损坏且无法恢复，第三方插件将在该次启动时被禁用。应用程序本身继续启动。

### 5.1 使用 JSON Schema 的设置表单

添加 `config.schema.json` 以生成插件的“设置”选项卡。当前表单渲染器支持：

- 嵌套对象；
- `string`、`number`、`integer` 和 `boolean`；
- `enum`；
- 原始值数组；
- `required`、`default`、`title` 和 `description`。

示例：

```json
{
  "type": "object",
  "required": ["endpoint"],
  "properties": {
    "endpoint": {
      "type": "string",
      "title": "Service endpoint",
      "description": "Base URL of the example service.",
      "default": "https://api.example.com"
    },
    "requestTimeout": {
      "type": "integer",
      "title": "Request timeout (seconds)",
      "default": 30
    },
    "mode": {
      "type": "string",
      "title": "Mode",
      "enum": ["standard", "strict"],
      "default": "standard"
    },
    "notifications": {
      "type": "object",
      "properties": {
        "enabled": {
          "type": "boolean",
          "title": "Show notifications",
          "default": true
        }
      }
    }
  }
}
```

默认值与之前保存的值合并。代码扩展在每次调用时接收只读的设置快照。无效的架构会禁用表单并记录扩展错误，而不会覆盖现有设置。

### 5.2 环境变量和设置插值

`mcp.json` 和 `models.json` 中的字符串支持：

```json
{
  "token": "$EXAMPLE_API_TOKEN",
  "url": "${settings.endpoint}/v1",
  "label": "Workspace: ${settings.workspace}"
}
```

- 形式为 `$ENV_NAME` 的完整字符串读取该环境变量。缺失的变量解析为空字符串。
- `${settings.key}` 读取插件设置，并支持嵌套路径，如 `${settings.network.endpoint}`。
- 非字符串的设置值在插值前会进行 JSON 序列化。

将密码、API 密钥和令牌保存在环境变量中。不要将它们提交到插件目录。

## 6. 技能

插件技能使用代理技能目录格式：

```text
skills/
└── release-checklist/
    ├── SKILL.md
    ├── references/
    │   └── checklist.md
    └── scripts/
        └── verify.ts
```

最小 `SKILL.md`：

```md
---
name: release-checklist
description: Check a release candidate against the team's public checklist.
---

# Release checklist

1. Read `references/checklist.md`.
2. Compare every item with the supplied release notes.
3. Report missing evidence without changing external systems.
```

插件技能在 设置 → 技能 中显示为插件来源。该来源无法移除，但其菜单支持显示目录以及启用或禁用其所有技能。每个技能也可以单独启用或禁用。

这些选择作为用户覆盖存储在 LLM Space 的技能设置中；插件文件永远不会被修改。被禁用的插件技能在设置中仍然可见，但会从 `available_skills` 中排除，并且无法被内置的 `skill()` 工具加载。禁用整个插件会将其所有技能从新的代理运行中移除。重新启用插件会恢复之前的每技能选择。

## 7. MCP 服务器

`mcp.json` 可以声明一个或多个 MCP 服务器。它们显示在 设置 → MCP 的 **MCPs in Plugins** 下，并与用户管理的服务器保持分离。

### 7.1 Stdio 示例

```json
{
  "servers": [
    {
      "id": "weather",
      "name": "Example Weather",
      "transport": "stdio",
      "command": "bun",
      "args": ["run", "./servers/weather.mjs"],
      "cwd": "${settings.serverDirectory}",
      "env": {
        "WEATHER_API_TOKEN": "$EXAMPLE_WEATHER_TOKEN"
      }
    }
  ]
}
```

### 7.2 Streamable HTTP 示例

```json
{
  "servers": [
    {
      "id": "knowledge-base",
      "name": "Example Knowledge Base",
      "transport": "streamableHttp",
      "url": "${settings.endpoint}/mcp",
      "headers": {
        "Authorization": "$EXAMPLE_API_TOKEN"
      }
    }
  ]
}
```

每个服务器需要：

- `id`：插件内唯一的稳定 ID；
- `name`：显示名称；
- `transport`：`stdio`、`streamableHttp` 或 `sse`。

LLM Space 通过添加插件命名空间来派生最终 ID：

```text
plugin:@example/team-tools:mcp:knowledge-base
```

不要在 `mcp.json` 中包含此前缀。插件 MCP 定义无法在 MCP 页面中编辑或移除；请使用插件设置或环境变量进行配置。禁用插件会关闭其 MCP 连接并拒绝新的调用。

MCP 页面标识所属插件，并显示连接详情、就绪状态、发现的工具数量和工具名称。LLM Space 缓存成功的就绪和工具发现结果，以避免在每次 UI 刷新时重新连接。插件配置更改会将该快照标记为过期；下一次连接测试或工具发现会从服务器刷新它。

插件可以通过 `tools/*.{ts,js,mjs}` 贡献本地可执行工具，或通过 MCP 暴露远程和共享工具。

## 8. 模型

`models.json` 可以使用 LLM Space 已支持的 API 适配器声明提供商和模型：

- `anthropic-messages`
- `openai-completions`
- `openai-responses`

示例：

```json
{
  "providers": [
    {
      "id": "example-cloud",
      "name": "Example Cloud",
      "api": "openai-completions
```