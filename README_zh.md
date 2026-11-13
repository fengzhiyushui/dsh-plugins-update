# dsh-plugins-update

<p align="center">
  <img src="icon.svg" width="80" height="80" alt="dsh-plugins-update icon" />
</p>

<p align="center">
  <b>DeepSeek Harness（DSH）第三方插件更新增强中心。</b><br>
  全局主动提醒 · GitHub 来源插件一键升级 · 智能协同防冲突 · 供应链观察期穿透
</p>

<p align="center">
  <a href="https://github.com/fengzhiyushui/dsh-plugins-update/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT" /></a>
  <a href="https://github.com/fengzhiyushui/dsh-plugins-update/releases"><img src="https://img.shields.io/badge/Release-v0.2.3-brightgreen.svg" alt="Release" /></a>
</p>

<p align="center">
  <a href="README.md">English</a> | <b>简体中文</b>
</p>

---

> **重要提醒**：DeepSeek Harness（DSH）自 `0.2.2-rc.1` 起已原生支持插件检查与更新功能；本插件自 `v0.2.2` 起开始针对 DSH 原生更新机制进行适配（本地测试环境：DSH `0.2.2-rc.1`）。

## 插件介绍

`dsh-plugins-update` 是一款专为 DeepSeek Harness（DSH）设计的第三方插件更新增强工具，旨在补充原生插件管理器在高频维护场景下的能力空白：

- **自动后台探测与全局提醒**：DSH 启动时会在后台通过轻量并发 HTTP 请求检测所有已安装第三方插件的新版本，在左侧边栏「插件」图标上展示未更新数量角标，并在已安装列表的插件标题旁补充原生风格的「可更新」标签，不用逐个点进详情页即可一眼看到哪些插件需要升级。
- **默认分工与按需接管**：默认选择 **npm 官方源** 时，标准 npm 插件的详情页更新自动让位给 DSH 原生界面，避免按钮重复；当插件来自 **GitHub 仓库**、你在设置中切换到 **npmmirror 国内镜像 / 自定义私有源**，或主动打开**「始终在插件详情页显示『极速更新』按钮」**开关时，本插件会在详情页提供 `⚡ 极速更新` 单步直装与观察期绕过通道。
- **更新源与安全保护**：可在设置面板自由切换 npm 官方源、`npmmirror` 国内镜像或自定义私有源，并支持非官方源安装失败时自动回退官方源重试；每次更新前都会保存 profile 的 `package.json` 与 `pnpm-lock.yaml` 快照，发生异常或版本校验不通过时自动回滚清单，并在依赖目录出现漂移时尽力离线恢复。
- **GitHub 插件检测说明**：针对 GitHub 来源插件，本插件通过 jsDelivr 与 `raw.githubusercontent.com` 并发竞速读取仓库根目录 `package.json` 中的 `version` 字段作为更新信号（需要上游仓库提升版本号才会触发提醒），确认更新时会直接拉取默认分支最新提交。

## 核心特性

- **GitHub 来源插件专属接管**：针对 DSH 原生不支持 Git/GitHub 来源插件更新的限制，通过双路 CDN 并发竞速检测版本，并支持一键拉取默认分支最新提交升级；
- **全局主动提醒系统**：启动与后台自动执行纯 HTTP 并发探测，在左侧导航栏「插件」图标展示待更新总数角标，并在已安装列表插件标题旁显示「可更新」标签（自动避让原生已有标签）；
- **原生优先与按需开关**：默认将 npm 官方源详情页更新交由 DSH 原生按钮处理，消除双按钮冲突；需要单步直装或策略豁免时，可在插件配置中开启「始终在插件详情页显示『极速更新』按钮」；
- **供应链安全观察期（`minimumReleaseAge`）穿透**：遇到刚发布尚在观察期内的新版本时，自动识别策略拦截并跳过观察期限制，实现发版即装；
- **轻量高速并发检测**：纯异步 HTTP Fetch 直连与并发探测，检测阶段不启动 `pnpm view` 子进程；
- **多源配置与失败自动回滚**：支持 npm 官方源、国内 `npmmirror` 镜像及自定义私有源（可配置失败自动回退官方源），更新前后自动记录快照并在失败或校验不通过时恢复配置；
- **全原生组件与双语支持**：界面交互基于 DSH 原生 UI 组件构建，跟随宿主语言自动切换简体中文与 English。

## 安装

在 DSH 中打开「插件」→「添加插件」，输入：

```text
fengzhiyushui/dsh-plugins-update
```

或使用包名安装：

```text
dsh-plugins-update
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

## 许可证

MIT License © [fengzhiyushui](https://github.com/fengzhiyushui)
