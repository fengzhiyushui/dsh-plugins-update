# 贡献指南 (Contributing to dsh-plugins-update)

非常感谢您对 `dsh-plugins-update` 项目的关注！我们欢迎社区贡献代码、改进文档或提出建设性反馈。

---

## 本地开发指南

### 1. 环境准备

* **Node.js**: >= 20
* **pnpm**: >= 9
* **DeepSeek Harness 桌面端**: 用于实际运行联调

### 2. 启动与构建

```bash
# 克隆仓库
git clone https://github.com/fengzhiyushui/dsh-plugins-update.git
cd dsh-plugins-update

# 安装依赖
pnpm install

# 编译项目 (包含后端与客户端产物)
pnpm run build
```

### 3. 本地联动 DSH 调试

您可以使用 DSH 的软链接机制，将当前开发目录直接挂载至桌面端：

```bash
dsh plugin --profile desktop add "link:/path/to/dsh-plugins-update"
```

当您修改了 `src/` 下的代码后，只需要重新执行 `pnpm run build`，并在 DSH 桌面端刷新页面，即可实时看到改动。

---

## 提交规范

* 遵循 Conventional Commits 规范，例如：
  * `feat: add batch update support`
  * `fix: handle offline registry timeout gracefully`
  * `docs: update installation instructions in README`
* 提交 PR 前请确保 `pnpm run build` 能够顺利通过且产物文件正常生成。
