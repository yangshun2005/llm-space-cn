# 原子线程写入实现计划

> **面向代理型工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法进行跟踪。

**目标：** 使 `LocalFileSystem.write()` 原子性地发布完整线程 JSON，同时保留现有的单文件图片 blob 表示形式。

**架构：** 在与目标位置交互之前，完全在内存中规范化、打包和字符串化线程。通过独占创建的、以 UUID 命名的同级文件句柄写入序列化字节，同步并关闭该句柄，然后使用平台文件系统重命名操作原子性地发布新文件；在每次失败时，尽力关闭并移除临时同级文件，同时重新抛出原始错误。

**技术栈：** TypeScript、Bun 1.3 测试运行器、Node 兼容的 `node:fs/promises`、`node:crypto`、POSIX/macOS 原子重命名语义。

## 全局约束

- 仅在分支 `issue-74-atomic-thread-write` 上的 `/Users/minimax/workspace/llm-space/.worktrees/issue-74` 中工作。
- 使用 Bun 和 mise 入口点；不要使用 npm、pnpm 或 yarn。
- 保留双空格格式化的 JSON 和当前的单文件 `blobs` 表。
- 不要添加仅用于生产测试的方法或广泛的文件系统抽象。
- 临时文件必须是目标位置的唯一同级文件，并且必须尽力清理，且不能掩盖原始失败。
- 验证聚焦的 LocalFileSystem 测试、完整 Bun 套件、lint 和类型检查。

---

### 任务 1：通过可观察的文件系统行为指定原子发布

**文件：**

- 修改：`packages/core/tests/server/storage/local/file-system.test.ts`

**接口：**

- 使用：`new LocalFileSystem(root)`、`LocalFileSystem.write(path, thread)`、`LocalFileSystem.read(path)` 和 `LocalFileSystem.realpath(path)`。
- 产出：针对新文件、替换文件、临时写入失败、发布失败后的清理以及图片打包/解包的回归覆盖。

- [x] **步骤 1：添加真实文件系统成功和失败测试**

添加一个带有小型线程夹具的 `LocalFileSystem.write` describe 块。断言新文件已格式化且可读，替换现有文件仅发布新的完整线程，只读父目录导致临时同级文件创建被拒绝，同时保留旧的目标字节，并且目标目录重命名失败不会留下 UUID 临时同级文件。在测试清理之前，在 `finally` 中恢复目录权限。

```ts
describe("LocalFileSystem.write", () => {
  test("写入一个新的格式化线程文件", async () => {
    const fileSystem = await _createFileSystem();
    await fileSystem.write("threads/new.json", { title: "新线程" });

    const raw = await fs.readFile(
      fileSystem.realpath("threads/new.json"),
      "utf8"
    );
    expect(raw).toBe('{\n  "title": "新线程"\n}');
    expect(await fileSystem.read("threads/new.json")).toMatchObject({
      title: "新线程",
    });
  });

  test("原子性地替换现有的完整线程", async () => {
    const fileSystem = await _createFileSystem();
    await fileSystem.write("thread.json", { title: "旧线程" });
    await fileSystem.write("thread.json", { title: "新线程" });

    expect(await fileSystem.read("thread.json")).toMatchObject({
      title: "新线程",
    });
  });

  test("当临时写入无法开始时保持现有目标不变", async () => {
    const fileSystem = await _createFileSystem();
    const target = fileSystem.realpath("thread.json");
    const original = '{\n  "title": "旧线程"\n}';
    await fs.writeFile(target, original);
    await fs.chmod(path.dirname(target), 0o500);

    try {
      let writeError: unknown;
      try {
        await fileSystem.write("thread.json", { title: "新线程" });
      } catch (error) {
        writeError = error;
      }
      expect(writeError).toBeInstanceOf(Error);
      expect(await fs.readFile(target, "utf8")).toBe(original);
    } finally {
      await fs.chmod(path.dirname(target), 0o700);
    }
  });

  test("当发布失败时清理其临时同级文件", async () => {
    const fileSystem = await _createFileSystem();
    await fs.mkdir(fileSystem.realpath("thread.json"));

    let writeError: unknown;
    try {
      await fileSystem.write("thread.json", { title: "新线程" });
    } catch (error) {
      writeError = error;
    }

    expect(writeError).toBeInstanceOf(Error);
    expect(await fs.readdir(fileSystem.realpath("."))).toEqual(["thread.json"]);
  });
});
```

- [x] **步骤 2：添加图片打包回归覆盖**

编写一个线程，其中包含至少 1,024 个字符长的相同图片载荷两次。断言原始文件保留一个 `blobs` 条目和两个 `blob:sha256:` 引用，然后断言 `read()` 恢复原始的内联图片数据。

```ts
test("保留单文件图片打包和解包", async () => {
  const fileSystem = await _createFileSystem();
  const imageData = "a".repeat(1024);
  const thread = {
    title: "图片",
    context: {
      messages: [
        {
          id: "user-1",
          role: "user" as const,
          content: [
            {
              type: "image_data" as const,
              data: imageData,
              mimeType: "image/png",
            },
            {
              type: "image_data" as const,
              data: imageData,
              mimeType: "image/png",
            },
          ],
        },
      ],
    },
  };

  await fileSystem.write("thread.json", thread);
  const raw = JSON.parse(
    await fs.readFile(fileSystem.realpath("thread.json"), "utf8")
  ) as Record<string, unknown>;
  expect(Object.keys(raw.blobs as Record<string, string>)).toHaveLength(1);
  expect(JSON.stringify(raw).match(/blob:sha256:/g)).toHaveLength(2);
  expect(await fileSystem.read("thread.json")).toEqual(thread);
});
```

- [x] **步骤 3：运行聚焦测试并记录 RED**

运行：`PATH="$HOME/.bun/bin:$PATH" bun test packages/core/tests/server/storage/local/file-system.test.ts`

预期：新文件、替换和图片兼容性用例在当前行为下通过，而 `当临时写入无法开始时保持现有目标不变` 失败，因为旧实现直接写入已可打开的目标位置，而不是创建同级文件。

---

### 任务 2：使用原子同级替换发布序列化线程

**文件：**

- 修改：`packages/core/src/server/storage/local/file-system.ts`
- 测试：`packages/core/tests/server/storage/local/file-system.test.ts`

**接口：**

- 使用：`fs.open(path, "wx")`、`FileHandle.writeFile()`、`FileHandle.sync()`、`FileHandle.close()`、`fs.rename()` 和 `fs.rm(path, { force: true })`。
- 产出：保持 `LocalFileSystem.write(p: string, thread: Thread): Promise<void>` 公共语义不变，并实现原子发布。

- [x] **步骤 1：在接触目标位置之前进行序列化**

规范化并打包线程，然后在创建目录或打开任何文件之前计算 `const text = JSON.stringify(serializable, null, 2)`。这确保规范化、打包或序列化失败不会改变目标位置。

```ts
const serializable = packThreadImages(normalizeThread(thread));
const text = JSON.stringify(serializable, null, 2);
await fs.mkdir(path.dirname(real), { recursive: true });
```

- [x] **步骤 2：实现唯一同级文件写入和原子重命名**

从 `node:crypto` 导入 `randomUUID`。使用独占的 `"wx"` 模式创建一个隐藏的同级文件，例如 `.${path.basename(real)}.${randomUUID()}.tmp`，写入 UTF-8 文本，同步，关闭，并将其重命名为目标位置。保持句柄变量直到关闭成功，以便失败恢复可以重试关闭，并跟踪成功创建，以便独占打开冲突永远不会导致清理移除另一个写入者拥有的同级文件。

```ts
const temporary = path.join(
  path.dirname(real),
  `.${path.basename(real)}.${randomUUID()}.tmp`
);
let handle: fs.FileHandle | undefined;
let temporaryCreated = false;

try {
  handle = await fs.open(temporary, "wx");
  temporaryCreated = true;
  await handle.writeFile(text, "utf8");
  await handle.sync();
  await handle.close();
  handle = undefined;
  await fs.rename(temporary, real);
} catch (error) {
  if (handle) {
    try {
      await handle.close();
    } catch {
      // 保留原始的写入/同步/关闭失败。
    }
  }
  if (temporaryCreated) {
    try {
      await fs.rm(temporary, { force: true });
    } catch {
      // 保留原始的操作失败。
    }
  }
  throw error;
}
```

- [x] **步骤 3：运行聚焦测试并记录 GREEN**

运行：`PATH="$HOME/.bun/bin:$PATH" bun test packages/core/tests/server/storage/local/file-system.test.ts`

预期：所有 LocalFileSystem 测试通过，包括失败测试，并且临时同级文件目录列表仅包含原始的目标条目。

- [x] **步骤 4：运行格式化并检查差异**

运行：`PATH="$HOME/.bun/bin:$PATH" bunx prettier --write packages/core/src/server/storage/local/file-system.ts packages/core/tests/server/storage/local/file-system.test.ts docs/superpowers/plans/2026-07-17-issue-74-atomic-thread-write.md`

运行：`git diff --check && git diff -- packages/core/src/server/storage/local/file-system.ts packages/core/tests/server/storage/local/file-system.test.ts`

预期：没有空白错误；生产差异仅更改写入路径和所需的导入。

---

### 任务 3：验证并提交 issue #74

**文件：**

- 验证：所有更改的文件

**接口：**

- 使用：仓库 Bun 测试、ESLint 和 TypeScript 配置。
- 产出：在 `issue-74-atomic-thread-write` 上引用 issue `#74` 的一个已审查提交。

- [x] **步骤 1：运行聚焦和完整验证**

运行：`PATH="$HOME/.bun/bin:$PATH" bun test packages/core/tests/server/storage/local/file-system.test.ts`

运行：`PATH="$HOME/.bun/bin:$PATH" bun test`

运行：`PATH="$HOME/.bun/bin:$PATH" mise run lint`

运行：`PATH="$HOME/.bun/bin:$PATH" mise run typecheck`

预期：零测试失败、零 lint 错误和零类型错误。

- [x] **步骤 2：对照权威 issue 进行自我审查**

运行：`gh issue view 74 --repo deer-flow/llm-space && git diff --check && git status --short && git diff --stat`

确认每个验收标准都映射到一个聚焦测试，并且清理错误不能替换原始抛出的错误。确认没有添加仅用于生产测试的方法、无关的编辑或生成的运行时数据。

- [ ] **步骤 3：提交已验证的实现**

```bash
git add docs/superpowers/plans/2026-07-17-issue-74-atomic-thread-write.md \
  packages/core/src/server/storage/local/file-system.ts \
  packages/core/tests/server/storage/local/file-system.test.ts
git commit -m "fix(storage): 原子性地写入线程文件 (#74)"
```

- [ ] **步骤 4：验证提交并清理工作树**

运行：`git status --short --branch && git show --stat --oneline --decorate HEAD`

预期：分支 `issue-74-atomic-thread-write` 是干净的，并且 `HEAD` 是 issue #74 的提交，仅包含计划、存储实现和存储测试。