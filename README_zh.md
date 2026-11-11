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
  <a href="https://github.com/fengzhiyushui/dsh-plugins-update/releases"><img src="https://img.shields.io/badge/Release-v0.2.2-brightgreen.svg" alt="Release" /></a>
</p>

<p align="center">
  <a href="README.md">English</a> | <b>简体中文</b>
</p>

---

专为 DeepSeek Harness 设计的轻量级第三方插件更新增强插件。深度兼容 DSH 0.2.2+ 原生插件管理器，补齐原生短板，提供**全局主动角标提醒**、**GitHub 仓库来源插件一键更新**与**发版安全观察期穿透**，同时保持毫秒级极速并发检测与纯净的原生界面体验。

## 核心特性

- **GitHub 来源插件专属接管**：针对 DSH 原生完全不支持 Git/GitHub 来源插件更新的痛点，提供专属检测与一键更新到最新代码提交能力；
- **全局主动提醒系统**：开机/后台自动执行毫秒级轻量并发检测，在左侧导航栏「插件」图标右上角常驻未更新总数 Badge 角标，在已安装列表行显示原生风格「可更新」Tag；
- **智能协同防冲突（Zero UI Clashes）**：
  - 对标准 npm 插件：在已是最新或检查中时**主动隐藏重复按钮**，完整让位给 DSH 原生的版本信息区，杜绝多余按钮打架；
  - 当检测到新版本时，在详情页提供精致的 `⚡ 极速更新` 辅助通道；
- **供应链安全观察期（`minimumReleaseAge`）穿透**：针对开发者刚发布的新版本，自动捕获并绕过 pnpm 的时间观察期限制，实现发版即装，告别版本死锁；
- **极速并发检测引擎**：基于纯异步 HTTP Fetch 与 CDN 竞速直连，不启动任何外部 `pnpm view` 子进程，十数个插件半秒内瞬间检测完成；
- **多源容错与镜像配置**：支持 npm 官方源、国内 npmmirror 镜像源及自定义私有源，非官方源失败时自动降级回退官方源；
- **全原生组件与双语支持**：确认弹窗、按钮与角标均使用 DSH 官方 primitives（`Modal`、`Button`、`Tag`），跟随系统自动切换中英文界面。

## 为什么搭配 DSH 原生使用？

| 场景 | DSH 0.2.2 原生插件管理器 | 配合 `dsh-plugins-update` |
|---|---|---|
| **GitHub 来源插件** | ❌ 判定不可更新，必须手动卸载重装 | ✅ **无缝支持**，一键拉取最新代码升级 |
| **未打开插件页时的感知** | ❌ 无任何角标或被动提醒 | ✅ **左侧边栏常驻数字角标**，启动即时感知 |
| **刚发布的新版本** | ❌ 触发 `minimumReleaseAge` 观察期拦截报错 | ✅ **自动绕过观察期**，新版即发即装 |
| **版本检测性能** | ⚠️ 反复启动 `pnpm view` 子进程，较重且易超时 | ⚡ **纯轻量 HTTP 探测**，毫秒级极速响应 |
| **npm 插件详情页** | 原生版本卡片与更新按钮 | 原生为主，辅助通道按需出现，界面干净纯粹 |

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
