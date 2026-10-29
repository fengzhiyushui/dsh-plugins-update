# dsh-plugins-update

<p align="center">
  <img src="icon.svg" width="80" height="80" alt="dsh-plugins-update icon" />
</p>

<p align="center">
  <b>DeepSeek Harness（DSH）第三方插件一键更新器。</b>
</p>

<p align="center">
  <a href="https://github.com/fengzhiyushui/dsh-plugins-update/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT" /></a>
  <a href="https://github.com/fengzhiyushui/dsh-plugins-update/releases"><img src="https://img.shields.io/badge/Release-v0.2.0-brightgreen.svg" alt="Release" /></a>
</p>

---

解决 DSH 第三方插件在发布新版本后只能在插件页卸载重装的问题：打开插件详情页即可检查并更新。

## 功能

- 在 `plugins.detail.actions` 插槽中注入更新按钮；
- 自动检查 npm 包或 GitHub 来源插件的最新版本；
- 一键更新，安装后读取磁盘版本校验；
- 保留更新源配置：npm 官方源、国内 npmmirror、自定义更新源列表；
- 非官方源安装失败时可自动回退 npm 官方源；
- 更新确认使用 DSH 原生 Modal，与宿主界面一致。

不包含：进度百分比、安装日志、取消、更新历史、GitHub tag/commit 深度追踪。

## 安装

在 DSH 中打开「插件」→「添加插件」，输入：

```text
fengzhiyushui/dsh-plugins-update
```

或使用 DSH CLI：

```bash
dsh plugin --profile desktop add fengzhiyushui/dsh-plugins-update
```

## 开发与构建

```bash
pnpm install
pnpm run build
```

构建产物：
- `lib/client.js`：插件详情页按钮与更新源配置卡片；
- `lib/index.js`：检查版本与执行更新的后端接口。

## 已知限制

- GitHub 来源只读取默认分支 `package.json#version`，不做 tag/commit 级更新检测；
- 不支持私有仓库专用 Token 和代理配置；
- 官方插件由 DSH 自带入口管理，本插件不处理；
- 更新请求为同步请求，安装期间按钮显示「更新中…」。

## 许可证

MIT License © [fengzhiyushui](https://github.com/fengzhiyushui)
