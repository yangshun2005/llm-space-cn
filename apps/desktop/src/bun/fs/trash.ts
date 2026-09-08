import { lstat, stat } from "node:fs/promises";

/**
 * Move an absolute path to the OS trash / recycle bin — a recoverable delete —
 * instead of removing it permanently. Hand-rolled per platform to avoid a
 * native dependency (mirroring reveal.ts):
 *
 * - macOS — ask Finder to move the item to the Trash via `osascript`.
 * - Windows — PowerShell + `Microsoft.VisualBasic` with the recycle-bin option.
 * - Linux — `gio trash`.
 *
 * A path that no longer exists is a no-op success: the item is already gone
 * (e.g. an earlier delete completed after its RPC reply timed out), and the
 * OS helpers would otherwise fail with an obscure platform error — on macOS,
 * Finder's `delete` reports "Handler can't handle objects of this class"
 * (-10010) for a path it cannot resolve.
 *
 * Otherwise blocks until the move completes and throws on failure so the
 * caller can surface the error.
 */
export async function moveToTrash(abs: string): Promise<void> {
  if (!(await _exists(abs))) return;
  if (process.platform === "darwin") {
    // AppleScript string literals quote/escape like JSON, which is safe for the
    // paths we handle (under the workspace root).
    const script = `tell application "Finder" to delete (POSIX file ${JSON.stringify(
      abs
    )})`;
    await _run(["osascript", "-e", script]);
    return;
  }
  if (process.platform === "win32") {
    const method = (await stat(abs)).isDirectory()
      ? "DeleteDirectory"
      : "DeleteFile";
    const path = abs.replace(/'/g, "''"); // escape single quotes for PowerShell
    const script =
      "Add-Type -AssemblyName Microsoft.VisualBasic; " +
      `[Microsoft.VisualBasic.FileIO.FileSystem]::${method}` +
      `('${path}','OnlyErrorDialogs','SendToRecycleBin')`;
    await _run([
      "powershell.exe",
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      script,
    ]);
    return;
  }
  await _run(["gio", "trash", abs]);
}

/** Whether a path exists on disk (as itself — symlinks are not followed). */
async function _exists(p: string): Promise<boolean> {
  try {
    await lstat(p);
    return true;
  } catch {
    return false;
  }
}

async function _run(cmd: string[]): Promise<void> {
  const proc = Bun.spawn(cmd, {
    stdin: "ignore",
    stdout: "ignore",
    stderr: "pipe",
  });
  const code = await proc.exited;
  if (code !== 0) {
    const stderr = (await new Response(proc.stderr).text()).trim();
    throw new Error(stderr || `${cmd[0]} exited with code ${code}`);
  }
}
