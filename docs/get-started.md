English | [中文](./get-started.zh-CN.md)

---

# LLM Space 4 快速入门

欢迎使用 LLM Space 4。

LLM Space 始于 2023 年 3 月，现已完成第三次重大升级。它是一款专为 Agent 开发者、产品经理和测试工程师设计的桌面开发工具。您可以使用它来试验新的 Agent 想法、观察运行过程、调试行为以及评估 Agent 性能。

LLM Space 是开源的。如果它对您有帮助，请在 [GitHub 仓库](https://github.com/deer-flow/llm-space) 中为该项目点个 Star 以支持我们。

![LLM Space 欢迎界面](./images/get-started-02-ready-to-run.png)

# 常用文档和链接

- [GitHub 仓库](https://github.com/deer-flow/llm-space)：Star 是对该项目最好的支持。
- [支持与捐赠](https://my.feishu.cn/wiki/OvLBwVuSkiCR1ik5wGEcBXZfnye)：如果您喜欢该项目，请给予支持。
- [Harness 课程系列](https://my.feishu.cn/wiki/L082wubkdie8uMkRUjgceKYQnIe)：学习 Agent 开发、调试和评估的系统方法。

# 下载、安装和更新

从项目发布渠道下载适用于您操作系统的安装程序，然后像安装普通桌面应用程序一样进行安装。未来的更新可以直接覆盖安装到现有应用上。如果您需要保留当前的配置和 Threads，请不要删除本地 LLM Space 数据目录。

默认情况下，LLM Space 将用户数据存储在：

```text
~/.llm-space
```

`workspace/` 存储 Thread 文件，`settings/` 存储模型、MCP、窗口及其他设置。有关存储格式的更多详细信息，请参阅 [核心概念](./core-concepts.md)。

# 快速配置模型

当您首次打开 LLM Space 时，将看到引导屏幕。LLM Space 会从您当前的环境变量中读取可能的 API Key 值，并推荐可用的模型提供商。

![检测到的模型提供商](./images/get-started-01-providers-detected.png)

如果右侧出现 `检测到的提供商` 列表，点击任意提供商即可快速添加。提供商成功添加后，欢迎页面会显示 `准备运行`，这表示当前工作区至少有一个模型可用。

![模型已配置并准备运行](./images/get-started-02-ready-to-run.png)

如果没有出现检测到的提供商，请点击 `配置模型` 打开模型设置对话框。您可以在其中手动添加提供商、API Key、Base URL 和模型列表。您也可以稍后打开设置来添加或修改更多模型提供商。详情请参阅 [设置](./settings.md)。

配置模型后，点击 `开始使用` 进入主界面。

# 运行您的第一个 Thread

Thread 是 Agent 的完整上下文。它包含模型、模型参数、工具、系统提示词和消息列表。它是一个可保存、可复制、可调试的对话实验。

常见的 Thread 内容包括：

| 内容 | 描述 |
| --- | --- |
| 模型 | 当前 Thread 使用的模型和提供商。 |
| 模型参数 | 运行时参数，如 `temperature`、`max_tokens` 和 `reasoning_effort`。 |
| 工具 | Agent 可以调用的工具，如内置工具、自定义函数工具和 MCP 工具。 |
| 系统提示词 | Agent 的全局行为指令。 |
| 消息列表 | 用户/助手消息，以及助手消息发起的工具调用。 |

有关更完整的术语指南，请参阅 [核心概念](./core-concepts.md)。

## 从示例创建 Thread

在主界面中，点击 `从示例开始` 并选择一个示例来创建新的 Thread。

![从示例创建 Thread](./images/get-started-03-start-from-examples.png)

选择 `通用 Agent` 作为您的第一个 Thread。它包含一组常用工具和系统提示词，是尝试 Agent 调试工作流的良好起点。

![通用 Agent Thread](./images/get-started-04-general-agent-thread.png)

## 运行 Thread

点击右上角的 `运行` 按钮来运行当前 Thread。

![首次 Thread 运行](./images/get-started-05-first-tool-call.png)

运行开始后，右侧会出现一条助手消息。在上面的截图中，助手消息包含对 `skill()` 工具的调用。由于 `skill()` 是 LLM Space 的内置工具，您可以点击工具卡片上的播放按钮，或点击底部的 `调用工具` 来执行该工具并获取响应。

![执行工具并获取响应](./images/get-started-06-tool-response.png)

工具返回结果后，点击 `继续` 进入下一轮，从而继续 ReAct 循环。

## 调试多个工具调用

随着运行继续，您可能会看到包含多个工具调用的助手消息。

![多个工具调用](./images/get-started-07-multiple-tool-calls.png)

有两种方式可以调试此类消息：

- 点击 `调用工具` 并行运行所有待处理的工具调用。
- 点击单个工具调用卡片上的播放按钮，仅运行该工具调用。

这有助于您检查模型为何选择某个工具、传递了哪些参数，以及工具结果如何影响后续推理。

## 启用 ReAct 循环

除了逐步调试之外，您还可以让 LLM Space 自动继续 ReAct 循环。

点击右上角 `运行` 按钮旁的下拉菜单，打开运行设置，并启用 `启用 ReAct 循环`。

![启用 ReAct 循环](./images/get-started-08-react-loop-settings.png)

启用后，找到您希望作为起点的用户消息或助手消息，然后点击 `继续` 或 `从此消息运行`。LLM Space 将自动继续后续的 ReAct 循环步骤，直到运行结束或到达需要手动处理的步骤。

![从特定消息继续运行](./images/get-started-09-run-from-message.png)

# 继续调试您的 Agent

LLM Space 的核心价值不仅仅是“让一次对话运行起来”。它允许您直接编辑 Agent 的运行时状态：

- 更改模型和模型参数，以比较不同模型之间的行为。
- 更改工具，观察工具列表如何影响模型决策。
- 更改系统提示词，快速迭代 Agent 行为。
- 更改用户消息和助手消息，以复现实验条件。
- 更改工具调用的参数或响应，以验证错误、边界情况和不同的工具输出。
- 使用可复用的评估标准、逐项评分和明确的分数差异来比较运行历史，以决定哪个版本更好。

这就是 LLM Space 中的 Agent 调试：将 Agent 运行转变为可观察、可编辑、可重放的上下文。

---

完成本快速入门后，请继续阅读：

- [核心概念](./core-concepts.md)
- [变量和模板](./variables-and-templates.md)
- [对话压缩](./compaction.md)
- [共享 Threads](./sharing.md)
- [生成项目](./generating-projects.md)
- [界面布局](./ui-layout.md)
- [设置](./settings.md)
- [快捷键](./shortcut-keys.md)