# dsh-plugins-update

<p align="center">
  <img src="icon.svg" width="80" height="80" alt="dsh-plugins-update icon" />
</p>

<p align="center">
  <b>DeepSeek Harness（DSH）第三方插件一键更新器。</b>
</p>

<p align="center">
  <a href="https://github.com/fengzhiyushui/dsh-plugins-update/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT" /></a>
  <a href="https://github.com/fengzhiyushui/dsh-plugins-update/releases"><img src="https://img.shields.io/badge/Release-v0.2.1-brightgreen.svg" alt="Release" /></a>
</p>

---

解决 DSH 第三方插件在发布新版本后只能在插件页卸载重装的问题：启动自动探测可用更新并在侧边栏与插件列表给出提醒，打开插件详情页即可一键更新。

## 功能

- 在 `plugins.detail.actions` 插槽中注入更新按钮；
- 启动主动探测提醒：在「已安装插件」列表行开关左侧显示 DSH 原生风格的 `可更新` 标签，并在左侧导航栏「插件」入口右侧显示待更新插件数量角标；
- 持久化提醒与免重复探测：检测到新版本但暂未更新时，更新提示在重启后持续保留且跳过重复启动探测；进入插件详情页时始终执行实时探测（支持跨版本直接更新至最新，网络超时自动回退缓存版本）；
- 自动检查 npm 包或 GitHub 来源插件的最新版本；
- 一键更新，安装后读取磁盘版本校验；
- 保留更新源配置：npm 官方源、国内 npmmirror、自定义更新源列表；
- 非官方源安装失败时可自动回退 npm 官方源；
- 更新确认弹窗与提示标签均使用 DSH 原生组件（`Modal`、`Button`、`Tag`），与宿主界面风格一致并跟随中英文语言切换。

不包含：进度百分比、安装日志、取消、更新历史、GitHub tag/commit 深度追踪。

## 兼容性与保护机制

- **后端双通道探测兜底**：批量探测优先读取 DSH 运行时 `installer` 状态，若宿主内部接口调整则自动回退为直接读取配置目录 `package.json` 与 `node_modules/*/package.json` 物理文件，确保版本检测不受 DSH 前端或内部接口变更影响。
- **语义化挂载与静默降级保护**：侧边栏数字角标与插件列表 `可更新` 标签仅依赖语义化属性（`li[data-plugin-package]`、无障碍属性 `[role="switch"]` 及 `sidebar.panellist` 注册信息），不依赖打包混淆的 CSS 类名；所有 DOM 同步均包裹在独立的 `try / catch` 容错边界内。即便未来 DSH 大版本重构外层布局导致某处挂载点变更，也仅会静默隐藏对应角标，绝不触发异常、不影响对话会话或详情页一键更新功能。
- **跨版本直达与离线回退**：若用户跳过中间版本（如 `0.1` 未更新，后续发布了 `0.2`），点进插件详情页时会实时探测并直接更新至最新 `0.2` 版本；若点进详情页时遇到临时网络波动或超时，则自动回退使用本地已缓存的待更新版本，保证更新按钮随时可用。

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
