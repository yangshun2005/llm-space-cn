

> **[中文化] llm-space**
>
> 此项目是 [deer-flow/llm-space](https://github.com/deer-flow/llm-space) 的中文翻译版本。
> - 原项目 Stars: 0
> - 主语言: 
> - 许可证: 
> - 翻译日期: 2026-09-08
> - 原始 README: [README_en.md](README_en.md)
>
> 如有翻译不准确之处，欢迎提 Issue 或 PR。

---


---

English | [中文](./README.zh-CN.md)

[![CI](https://github.com/deer-flow/llm-space/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/deer-flow/llm-space/actions/workflows/ci.yml)
[![Version](https://img.shields.io/github/v/release/deer-flow/llm-space?label=version)](https://github.com/deer-flow/llm-space/releases)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.x-3178C6?logo=typescript&logoColor=white](./package.json)
[![Bun](https://img.shields.io/badge/Bun-1.3+-000000?logo=bun&logoColor=white)](./mise.toml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

---

# LLM Space 4

<a href="https://trendshift.io/repositories/83147?utm_source=trendshift-badge&amp;utm_medium=badge&amp;utm_campaign=badge-trendshift-83147" target="_blank" rel="noopener noreferrer"><img src="https://trendshift.io/api/badge/trendshift/repositories/83147/daily?language=TypeScript" alt="deer-flow%2Fllm-space | Trendshift" width="250" height="55"/></a>

![截图](https://github.com/user-attachments/assets/e207bc62-4dab-4b13-a541-d176a8f96c40)

https://github.com/user-attachments/assets/2ba7a600-1f1a-44c0-b9f1-34ad42100213

[**LLM Space** v4](https://github.com/deer-flow/llm-space) 是一款面向智能体构建者的桌面应用——在一个地方即可原型化你的下一个智能体创意、检查工具执行的每一步、调试失败并评估性能。

**官方网站：** https://deer-flow.github.io/llm-space/

LLM Space 是 [DeerFlow](https://github.com/bytedance/deer-flow) 的姊妹项目，我们大量使用它进行自举开发：每个版本的 DeerFlow 都是使用 LLM Space 构建和调试的。该项目始于 2023 年 3 月，v4 是其第四次重大迭代。

## 目录

- [功能特性](#功能特性)
- [技术栈](#技术栈)
- [项目结构](#项目结构)
- [下载](#下载)
- [安装](#安装)
- [运行应用](#运行应用)
- [用户指南](#用户指南)
- [贡献](#贡献)
- [赞助商](#赞助商)
- [捐赠](#捐赠)
- [许可证](#许可证)

## 功能特性

- **构建** — 编写并版本化管理你的提示词、系统消息、工具和模型设置。
- **追踪** — 实时查看智能体循环中的每一次模型调用和工具运行。
- **调试** — 从历史记录中重放运行并逐步执行，找出问题所在。
- **评估** — 衡量你的智能体在多次运行中的表现。
- **管理** — 将你的线程作为文件保存在本地机器上，保持有序。
- **生成** — 让 AI 为你编写提示词和工具，甚至可以将任何线程转换为可运行的 [LangGraph](https://github.com/langchain-ai/langgraph) 智能体。

你的文件和 API 密钥始终保存在本地计算机上。LLM Space 会收集少量匿名使用数据以改进应用——请参阅 [TELEMETRY.md](./TELEMETRY.md) 了解具体收集内容及如何选择退出。

## 技术栈

- **语言与工具** — TypeScript，使用 [Bun](https://bun.com) 构建和管理。
- **桌面外壳** — [Electrobun](https://electrobun.dev)，一种轻量级的原生应用发布方式。
- **UI** — React，搭配 Tailwind CSS 和 shadcn/ui。
- **智能体框架** — [Pi Agent Core](https://github.com/earendil-works/pi)，一个用于构建智能体的轻量级框架。

## 项目结构

LLM Space 是一个 Bun monorepo：

```
packages/
  core/       # 共享领域类型、客户端、存储和生成器
  runtime/    # 本地运行时、模型、工具、技能、MCP 和插件
  ui/         # 共享 React 设计系统和线程 Playground
apps/
  desktop/    # 桌面应用（Electrobun 外壳 + React UI）
examples/
  atlas-plugin/ # 完整的插件示例，涵盖所有扩展类型
```

每个包在 `src/` 旁边都有一个 `tests/` 目录。测试路径与源码路径对应，例如 `packages/core/src/thread/history.ts` 对应 `packages/core/tests/thread/history.test.ts`。

## 下载

从[最新发布版本](https://github.com/deer-flow/llm-space/releases/latest)获取 DMG——支持 macOS、Apple Silicon 和 Intel。提供两个版本：

- **LLM Space** — 使用系统 WebView。下载体积小（约 27 MB），内存和电池占用低。
- **LLM Space Performance** — 内置独立渲染引擎（约 130 MB）。在不同 macOS 版本上渲染保持一致，且通常性能更佳。

可以安装任一版本，也可以两者都装。它们共享相同的 `~/.llm-space` 数据目录，因此切换版本不会丢失线程和设置，并且两者都能自动更新。

## 安装

想从源码构建？首先需要安装 [Bun](https://bun.com)。Bun 是一个快速、全功能的 JavaScript 运行时和包管理器——可以将其视为 Node.js 和 npm 的直接替代品。请遵循[官方安装指南](https://bun.com/docs/installation)。

Bun 就绪后，在仓库根目录安装项目：

```bash
bun install
```

想参与贡献，或希望使用与 CI 完全一致的工具链？请安装 [mise](https://mise.jdx.dev) 并运行 `mise run setup` 代替——它会一步安装锁定版本的 Bun（来自 `mise.lock`）以及 JS 依赖。

## 运行应用

启动桌面应用进行本地开发：

```bash
mise run dev
```

构建 canary 发布版本：

```bash
mise run build:canary
```

## 用户指南

用户指南位于本仓库中：

- [快速开始](./docs/get-started.md)
- [用户手册](./docs/index.md)
- [核心概念](./docs/core-concepts.md)
- [对话压缩](./docs/compaction.md)
- [共享线程](./docs/sharing.md)
- [生成项目](./docs/generating-projects.md)
- [插件开发指南](./docs/plugins.md)
- [完整 Atlas 插件示例](./examples/atlas-plugin/README.md) — 包含两个技能、MCP 服务器、模型提供商、插件工具、命令和线程存储，以及多字段设置 Schema。

## 贡献

目前，我们只合并来自 [DeerFlow](https://github.com/bytedance/deer-flow) 核心团队成员的 Pull Request。

非常欢迎其他所有人通过[提交 Issue](https://github.com/deer-flow/llm-space/issues) 来帮助改进项目——错误报告、想法和反馈都能让项目变得更好。

## 赞助商

LLM Space 是免费且开源的，这得益于我们的赞助商。我们为获得他们的支持感到自豪和感激。

### 🏆 白金赞助商

<p align="center">
  <a href="https://superdesign.dev" target="_blank" rel="noopener">
    <img src="./docs/images/sponsor-superdesign.svg" alt="Superdesign - 可将提示词转化为无限画布上的设计的 AI 产品设计智能体（白金赞助商）" width="600" />
  </a>
</p>

<p align="center">
  <strong><a href="https://superdesign.dev">Superdesign</a></strong> 是一款 AI 产品设计智能体，可将自然语言提示词转化为 UI 原型、组件以及无限画布上的完整设计。感谢你们让 LLM Space 成为可能。💜
</p>

希望在这里看到你的 Logo？我们很乐意洽谈——[通过提交 Issue 联系我们](https://github.com/deer-flow/llm-space/issues)或[支持本项目](#捐赠)。

### 🏅 金牌赞助商
我们强烈推荐使用火山引擎 Coding Plan 作为你的默认模型提供商：

<p align="center">
  <a href="https://www.byteplus.com/en/activity/codingplan?utm_campaign=LLM_Space&utm_content=LLM_Space&utm_medium=devrel&utm_source=OWO&utm_term=LLM_Space" target="_blank" rel="noopener">
    <img width="600" height="150" alt="图片" src="https://github.com/user-attachments/assets/e6c62cad-a798-4dc4-9beb-c96503526458" />
  </a>
</p>

- [字节跳动的 BytePlus Coding Plan](https://www.byteplus.com/en/activity/codingplan?utm_campaign=LLM_Space&utm_content=LLM_Space&utm_medium=devrel&utm_source=OWO&utm_term=LLM_Space)
- [火山引擎 Coding Plan - 中国大陆地区](https://ai.volcengine.com/activity/agentplan?utm_campaign=LLM_Space&utm_content=LLM_Space&utm_medium=devrel&utm_source=OWO&utm_term=LLM_Space)

## 捐赠

如果 LLM Space 对你有用，并且你愿意支持其开发，可以在此处捐赠：

**[支持 LLM Space →](https://my.feishu.cn/wiki/OvLBwVuSkiCR1ik5wGEcBXZfnye)**

谢谢。

## 许可证

LLM Space 根据 [MIT 许可证](LICENSE) 发布。