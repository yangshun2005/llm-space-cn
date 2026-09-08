# Atlas 插件

[English](./README.md) | [简体中文](./README.zh-CN.md)

Atlas 是一个完整的 LLM Space 插件示例，用于项目知识、运维和 Thread 工作流。它特意比最小脚手架更大：当前支持的每个扩展点都有所体现，并且每个可重复类型至少有两个贡献。

## 包含的扩展

| 类型 | 贡献 | 展示内容 |
| --- | ---: | --- |
| 设置 | 1 个 Schema，7 个字段 | 默认值、验证、描述、插值 |
| 技能 | 2 | frontmatter、引用、有界工作流 |
| MCP 服务器 | 2 | 内置 stdio 服务器、设置到环境变量的插值 |
| MCP 工具 | 4 | Zod 输入 Schema、正常结果、受控错误 |
| 模型提供商 | 2 | OpenAI Responses 和 Anthropic Messages 适配器 |
| 模型 | 4 | 每个插件提供商对应多个模型 |
| 插件工具 | 2 | 类型化参数、Thread/变量上下文、工作区读取 |
| 命令 | 2 | 命令面板参数、进度、结果、工作区和 Thread 写入 |
| Thread 存储 | 2 | 持久化工作区存储和进程生命周期内存存储 |

`config.schema.json` 是此列表中唯一的单例：LLM Space 每个插件最多发现一个设置 Schema。因此，Atlas 使用一个包含多个独立字段的 Schema。所有其他扩展类型都有多个贡献。

## 目录结构

```text
atlas-plugin/
├── package.json
├── tsconfig.json
├── config.schema.json
├── mcp.json
├── models.json
├── README.md
├── README.zh-CN.md
├── commands/
│   ├── create-project-brief.ts
│   └── rename-active-thread.ts
├── tools/
│   ├── project-context.ts
│   └── read-workspace-note.ts
├── thread-storages/
│   ├── memory-shelf.ts
│   └── workspace-library.ts
├── servers/
│   ├── catalog-server.ts
│   └── metrics-server.ts
└── skills/
    ├── incident-brief/
    │   ├── SKILL.md
    │   └── references/template.md
    └── release-readiness/
        ├── SKILL.md
        └── references/checklist.md
```

## 本地安装

插件根目录必须是真实目录，因此请复制示例而不是创建符号链接。LLM Space 不会自动安装插件依赖。请在复制的目录中运行 `bun install`，因为两个内置 MCP 服务器使用 MCP SDK。

```sh
mkdir -p ~/.llm-space/plugins
cp -R ./examples/atlas-plugin ~/.llm-space/plugins/atlas-plugin
cd ~/.llm-space/plugins/atlas-plugin
bun install --production
```

然后打开 设置 → 插件 并选择 **刷新插件**。Atlas 需要 LLM Space 4.9.0 或更高版本。

## 配置

在 Atlas 设置选项卡中：

1. 将 **MCP 服务器目录** 设置为绝对安装路径，通常为 `~/.llm-space/plugins/atlas-plugin`，其中 `~` 展开为你的主目录路径。
2. 根据需要调整团队、项目、笔记目录或模型基础 URL。
3. 如果你想使用示例模型提供商，请在启动 LLM Space 之前导出 `OPENAI_API_KEY` 和/或 `ANTHROPIC_API_KEY`。

模型目录条目演示了配置结构。请将其 ID、限制和成本元数据替换为你实际使用的提供商已验证的值。切勿将 API 密钥放在 `models.json` 中。

## 尝试示例

### 命令

打开命令面板并尝试：

```text
Rename active Thread Release 4.9
rename-active-thread "Release 4.9"
Create project brief Atlas Web
create-project-brief "Atlas Website"
```

重命名命令会暂存整个 Thread 的更新并返回明确的终端反馈。简报命令会写入 `atlas/<name>-brief.md` 并刷新工作区树。

### 插件工具

将这些工具添加到本地 Thread：

- `atlas_project_context` 读取插件设置、所属 Thread 和已解析的提示变量。
- `atlas_read_workspace_note` 安全读取配置的 Atlas 笔记目录下的笔记，并应用输出大小限制。

### MCP

打开 设置 → MCP 下的 **插件中的 MCP**，然后测试两个 Atlas 服务器：

- **Atlas Catalog** 暴露 `list_resources` 和 `get_resource`。
- **Atlas Metrics** 暴露 `get_project_health` 和 `compare_metric`。

数据是确定性的且位于本地，因此这些服务器不需要凭据或网络访问。

### 模型提供商

Atlas 贡献了一个兼容 OpenAI Responses 的提供商和一个兼容 Anthropic Messages 的提供商，每个提供商都有两个示例模型。在尝试运行之前，请导出相应的 API 密钥，验证基础 URL，并替换示例模型 ID 和元数据。

### Thread 存储

- **Atlas Workspace Library** 将 JSON 持久化到 `<notesDirectory>/thread-library/` 下，并支持导入、保存和 `llm-space://threads/atlas-library/<id>` 深链接。
- **Atlas Memory Shelf** 演示了具有进程生命周期状态的相同读/写契约。当插件重新加载或应用退出时，其内容会消失。

### 技能

这两个技能演示了不同的有界工作流和本地引用文件：发布证据审查和事件简报编写。从 设置 → 技能 中启用它们，并让 Agent 执行匹配的任务。

## 生产注意事项

此目录是一个教学示例，不是生产集成。在发布衍生插件之前：

- 替换示例模型元数据并测试每个配置的提供商；
- 在外部 Thread 存储中验证完整的 Thread 载荷；
- 为网络操作添加请求超时和取消机制；
- 将机密信息远离文件、结果、报告和日志；
- 为命令、工具、MCP 服务器和存储行为添加自动化测试；
- 将已安装的运行时依赖与插件目录一起发布。