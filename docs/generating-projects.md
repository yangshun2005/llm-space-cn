# 生成项目

**生成项目** 功能可将 Thread 导出为可编辑、可运行的智能体项目。它会将 Thread 的提示词、模型、变量、所选工具、消息及运行时上下文从 Playground 中导出到可进行版本控制和扩展的源文件中。

该功能目前为桌面版专属 Beta 版本。可用的目标项目为使用 LangGraph、LangChain 和 `uv` 的 Python 3.12 项目。

## 前提条件

- Thread 必须能够解析到模型。生成的项目将使用其提供商、模型 ID 及兼容的运行时包。
- `PATH` 中必须包含 [`uv`](https://docs.astral.sh/uv/)。若缺失，向导会提供官方安装指南的链接。
- 目标目录必须可写。
- LangGraph 导出器目前不支持提供商托管的工具和 Plugin 工具。

## 如何生成

1. 打开 Thread。
2. 打开 **更多操作**（`...`）并选择 **生成项目**。
3. 确认导出格式。当前版本仅支持 LangGraph/Python 格式。
4. 选择父目录和项目名称。
5. 决定是否将第一条用户消息用作元用户提示词。LLM Space 会根据 Thread 内容给出建议值；若不存在第一条用户消息，则禁用该选项。
6. 选择 **生成**，并在进度视图中查看文件生成情况。
7. 查看完成说明，打开文件夹，并决定 LLM Space 是否应创建包含已解析凭据的 `.env` 文件。

源 Thread 不会被修改。生成操作会创建并写入一个独立的项目目录。

## 生成的项目

生成的项目包含类似以下文件：

```text
my-agent/
├── pyproject.toml
├── langgraph.json
├── Makefile
├── .env.example
├── PLAN.md
├── src/
│   ├── agents/agent.py
│   ├── models/create_model.py
│   ├── prompting/system_prompt.md
│   ├── prompting/apply_template.py
│   └── tools/
└── references/
    ├── system-prompt.md
    ├── messages/
    ├── tools/
    └── variables.json
```

支持的内置工具会以可运行的 Python 实现形式复制。函数工具会生成类型化存根，需要您自行完善。MCP 工具会连同其解析后的服务器配置和允许的工具名称一起导出。`PLAN.md` 中会列出剩余工作。

提示词模板保持可编辑状态，并在运行时渲染。当前日期和已启用的 Skills 等内置值在支持的情况下保持动态；导出的引用文件会保留面向模型的提示词、初始消息、变量以及自定义或 MCP 工具定义，供您查阅。

## 元用户提示词

当启用 **使用元用户提示词** 时，第一条用户消息将成为运行时上下文，在每次生成的智能体模型调用之前注入，而非作为普通请求。这对于可复用的工作区指令、日期、Skills 或工作目录上下文非常有用。当第一条用户消息是智能体只需回答一次的实际任务时，请保持该选项禁用。

## 依赖项和凭据

生成过程会尽力执行 `uv sync`。如果安装失败或超时，项目仍会创建；您可以手动完成安装：

```sh
cd /path/to/my-agent
uv sync
```

项目始终包含 `.env.example`。当必需值已配置为字面量密钥时，生成过程也可能写入 `.env`。之后，LLM Space 可以选择性地解析模型、搜索和 MCP 环境引用，并将完整结果写入 `.env`。请检查此文件，切勿将其提交到版本控制中。

## 运行项目

```sh
cd /path/to/my-agent
cp .env.example .env  # 如果 LLM Space 未创建 .env
uv run langgraph dev
```

然后打开 LangGraph Studio 即可运行、检查和追踪智能体。如果 Thread 使用了函数工具，请先完成 `PLAN.md` 中描述的存根。

## 生成原理

LangGraph 导出器是确定性的，不会额外调用 LLM。它通过 LLM Space 的提示词语义渲染 Thread 模板，解析有效的模型和工具配置，写入脚手架和引用文件，并通过向导的进度流报告每个文件。

实现主要位于 `packages/core/src/generator/langgraph/` 和 `packages/ui/src/components/thread-playground/codegen/` 中。