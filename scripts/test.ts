import { Glob } from "bun";

// 模块级 mock 在独立进程中运行，避免不同测试组共享替换后的模块。
const testFiles = Array.from(new Glob("tests/*.test.ts").scanSync()).sort();
if (testFiles.length === 0) {
  throw new Error("未发现回归测试文件");
}

for (const testFile of testFiles) {
  const subprocess = Bun.spawn([process.execPath, "--no-env-file", "test", `./${testFile}`], {
    cwd: process.cwd(),
    env: {
      PATH: process.env.PATH ?? "",
      HOME: process.env.HOME ?? "",
      TZ: "UTC",
      API_KEY: "test-api-key",
      BASE_URL: "http://127.0.0.1:1/v1",
    },
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = await subprocess.exited;
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}
