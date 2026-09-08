English | [中文](./remote-runtime.zh-CN.md)

---

# 基于 SSH 的远程运行时

远程运行时（Remote Runtime）允许桌面 UI 通过 SSH 连接到 Linux 机器，并在该机器上运行 LLM Space 运行时。桌面端保留窗口和交互界面；远程机器则拥有该运行时的工作区、模型设置、MCP 服务器、工具、技能和网络访问权限。

## 推荐的 SSH 配置

使用系统的 OpenSSH 配置。LLM Space 调用 `ssh` 命令，并有意识地复用与终端相同的文件和行为。

在 macOS 和 Linux 上，标准配置文件为：

```text
~/.ssh/config
```

在安装了 OpenSSH 的 Windows 上，用户配置通常位于：

```text
%USERPROFILE%\.ssh\config
```

一个典型的主机别名配置如下：

```sshconfig
Host llm-devbox
  HostName 203.0.113.10
  User qiangenchao
  Port 22
  IdentityFile ~/.ssh/id_ed25519
  # 可选示例：
  # ProxyJump jump-host
  # ForwardAgent yes
```

然后在 LLM Space 中添加远程服务器，配置如下：

- **名称**：任意显示名称，例如 `Devbox`
- **主机**：OpenSSH 主机别名，例如 `llm-devbox`
- **用户**：可选；如果 `~/.ssh/config` 中已设置 `User`，则留空

LLM Space 仅存储这些字段。SSH 级别的选项（如端口、身份文件、跳板主机、代理命令和代理行为）请放在 `~/.ssh/config` 中。

## 密码和口令

LLM Space 不存储 SSH 密码或私钥口令。

如果 SSH 配置需要身份验证，请使用标准的 OpenSSH 机制：ssh-agent、macOS 钥匙串或系统密码/口令提示。快速检查方法如下：

```sh
ssh llm-devbox
```

如果该命令无法从终端连接，请先修复 SSH，再尝试使用 LLM Space。

LLM Space 在检测平台和准备运行时期间可能会调用多个简短的 `ssh` 命令。为了获得最流畅的体验，请确保 `ssh <别名>` 能从终端可靠连接，最好通过 ssh-agent 或系统钥匙串。仅依赖密码的连接可能会触发多次系统提示。

## 连接进度

在连接过程中，LLM Space 会报告主要阶段：

1. 检查 SSH 访问
2. 检测远程平台
3. 准备或下载远程运行时
4. 启动远程运行时
5. 打开 SSH 隧道
6. 验证远程运行时
7. 已连接

远程服务器页面还会显示一个**连接流程**时间线，包含 SSH、主机密钥、平台、安装运行时、启动服务器、隧道和健康检查。如果连接失败，失败的步骤会保留详细消息，以便您判断失败发生在 SSH 身份验证、软件包安装、服务器启动、隧道创建还是运行时健康检查阶段。

在复用已安装的远程运行时软件包之前，LLM Space 会验证 `server-manifest.json` 和可执行文件 `bin/llm-space-server`。如果之前的安装留下了部分版本目录（存在清单文件但二进制文件缺失或不可执行），连接会将其视为不完整，并在安装阶段重新安装该版本。

默认安装目录 `~/.llm-space/remote-runtime` 会在 SSH 服务器上解析为该用户的 `$HOME/.llm-space/remote-runtime`；它不会在本地机器上解析，并且不得在服务器上创建字面意义上的 `~/` 目录。启动和健康检查失败不会触发自动重新安装重试。如果安装后 `bin/llm-space-server` 缺失或不可执行，LLM Space 会报告失败，并附带尽力而为的远程诊断快照，涵盖 `$HOME`、`PWD`、安装目录、入口点是否存在、执行权限、清单内容以及可能的字面 `~/` 安装产物。重新连接前，请检查安装目录权限、磁盘空间、外部清理任务以及任何过期的字面 `~/` 目录。

如果启动或健康检查报告远程运行时端口（通常为 `39123`）已被占用，LLM Space 会检查监听进程是否为来自同一远程安装目录的过期 `llm-space-server`，例如 `~/.llm-space/remote-runtime/versions/<旧版本>/bin/llm-space-server --host 127.0.0.1 --port 39123`。当验证该归属后，LLM Space 会停止该过期服务器并重试当前连接一次。它不会停止未知或非 LLM Space 进程；在这种情况下，请在 SSH 主机上检查该进程并手动停止后再重新连接。

## 主机密钥验证失败

OpenSSH 可保护您免受身份未知或已更改的主机连接。LLM Space 会分别处理这些情况。

首次连接到主机别名或 IP 时，LLM Space 会显示主机密钥类型和 SHA256 指纹。仅在确认该指纹属于预期服务器后，点击**信任并继续**。确认后，LLM Space 会将主机密钥写入 OpenSSH `known_hosts`，以便后续连接静默进行。

如果 LLM Space 报告 SSH 主机密钥已更改，请勿盲目删除 `known_hosts`，也不要寻找“忽略主机密钥”的绕过方式。服务器可能已被重建、IP 可能已被复用，或者可能正在发生真正的中间人攻击。

首先与您的基础设施提供商或管理员确认主机身份。在确认变更是预期情况后，更新 OpenSSH 报告的行，例如：

```text
/Users/bytedance/.ssh/known_hosts line 6
```

在密钥变更对话框中，LLM Space 会显示新指纹、`known_hosts` 文件和冲突行。只有在您确认已验证主机身份后，LLM Space 才能替换过期条目并继续。

有用的诊断命令：

```sh
ssh -vvv llm-devbox
ssh -G llm-devbox
ssh-keygen -F llm-devbox -f ~/.ssh/known_hosts
```

如果 LLM Space 无法自动写入或替换 `known_hosts`，请在终端中运行一次 `ssh llm-devbox` 并完成 OpenSSH 的标准确认流程。在密钥变更的情况下，请先验证主机身份，再处理 OpenSSH 报告的过期条目。

LLM Space 不提供“忽略主机密钥”按钮，因为绕过主机密钥验证可能会掩盖真正的中间人攻击。

## 远程运行时下载超时

如果进度到达**下载远程运行时软件包**后因服务器安装超时而失败，说明 SSH 已正常工作。远程 Linux 机器无法及时下载 `llm-space-server` 发布归档。

较新的 LLM Space 版本会自动使用两步安装路径：首先远程服务器尝试直接下载 GitHub 发布归档；如果远程下载失败，桌面应用会在本地下载同一归档，缓存在本地设置目录下，通过 SSH 上传到远程运行时下载目录，并从该上传的归档继续安装。

请从您的 Mac 上检查：

```sh
ssh llm-devbox 'curl -I -L --connect-timeout 15 https://github.com/deer-flow/llm-space/releases/latest'
```

如果该命令挂起或失败，但 LLM Space 仍能成功连接，说明本地下载/上传回退机制已生效。

如果回退仍然失败，请使用错误详情来确定下一个边界：本地 GitHub 下载失败需要修复桌面机器的网络或代理；上传失败通常意味着 SSH 无法写入远程安装目录；远程安装失败通常意味着缺少 `tar`、磁盘空间不足、`~/.llm-space/remote-runtime` 下的权限问题、外部清理任务或远程安装目录不正确。