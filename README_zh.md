# dsh-plugins-update

<p align="center">
  <img src="icon.svg" width="80" height="80" alt="dsh-plugins-update icon" />
</p>

<p align="center">
  <b>DeepSeek Harness（DSH）第三方插件更新与启动冲突自愈工具。</b><br>
  全局主动提醒 · 启动冲突自动熔断 · 红蓝状态独立分标 · GitHub 来源插件升级 · 供应链观察期穿透
</p>

<p align="center">
  <a href="https://github.com/fengzhiyushui/dsh-plugins-update/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT" /></a>
  <a href="https://github.com/fengzhiyushui/dsh-plugins-update/releases"><img src="https://img.shields.io/badge/Release-v0.2.6-brightgreen.svg" alt="Release" /></a>
  <a href="https://awesome-dsh-plugin.com"><img src="https://awesome-dsh-plugin.com/badge.svg" alt="Awesome DSH Plugin" /></a>
</p>

<p align="center">
  <a href="README.md">English</a> | <b>简体中文</b>
</p>

---

> **实验性分支说明（`experimental`）**：当前分支为实验性分支（`v0.2.7-exp.2`），**不进行 npm 包打包，不支持通过 npm 安装**，仅支持通过 GitHub 指定分支安装（`fengzhiyushui/dsh-plugins-update#experimental`）。未经允许请勿合并至主分支；如需稳定正式版，请切换至 [`main` 主分支](https://github.com/fengzhiyushui/dsh-plugins-update/tree/main)。

> **重要提醒**：DSH 自 `0.2.2-rc.1` 起已原生支持插件更新，本插件已与原生机制协同适配（兼容 `0.2.2-rc.1` ~ `0.2.3-alpha.2`）。

## 插件介绍

`dsh-plugins-update` 是一款专为 DeepSeek Harness（DSH）设计的第三方插件更新与兼容守护工具，旨在补充原生插件管理器在高频版本迭代与日常维护场景下的能力空白：

- **启动冲突自动熔断与红蓝独立分标（实验性）**：当 DSH 升级新版本启动时，若未检测到第三方插件冲突则完全静默运行；一旦检测到已启用的第三方插件与当前 DSH 发生版本冲突、加载失败或连续启动异常退出，会自动将该冲突插件切换为关闭状态（保持安装记录不丢失，避免拖垮 DSH 导致不可用），并在侧边栏「插件」入口、已安装列表行及插件详情页标题旁以**红色标志**（`冲突已停用`）独立提示，与代表新版本的**蓝色标志**（`可更新`）并列区分，无需任何多余弹窗。插件完成版本升级后红标自动消隐，保持关闭状态由用户手动开启。
- **自动后台探测与全局提醒**：DSH 启动时会在后台通过轻量并发 HTTPS 请求检测所有已安装第三方插件的新版本，在左侧边栏「插件」图标上展示待更新数量角标，并在已安装列表的插件标题旁补充原生风格的「可更新」标签；通过原生弹窗完成升级/安装后也会自动校准并消隐过期角标。
- **默认分工与按需补位**：默认选择 **npm 官方源** 时，标准已过审且满 24 小时观察期的 npm 插件更新让位给 DSH 原生界面；当 DSH 原生未生效（如发布未满 24 小时的「极速更新」、GitHub 来源插件、镜像/自定义源），或开启「始终在插件详情页显示『极速更新』按钮」开关时，详情页将自动补位呈现单步直装按钮（点击即装，不再每次重复弹窗）。
- **安全门控与单包精准豁免（实验性）**：
  - 设置页提供 4 个原生 `Switch` 开关：失败自动回退官方源、始终显示详情页按钮，以及两个**默认关闭**的高危策略开关——**允许未满 24 小时观察期更新**、**允许未经市场安全审核更新**（从关闭切为开启时均会弹出危险确认框）。
  - 默认严格校验版本是否已收录于宿主 `pluginMarket` 索引（宿主未配置索引时自动回退校验 `awesome-dsh-plugin.com` 精选索引，未收录或 GitHub 浮动分支提交默认屏蔽）；开启 24 小时豁免后仅在 profile 的 `pnpm-workspace.yaml`（`minimumReleaseAgeExclude`）中写入精确的 `<package>@<version>` 单包豁免，绝不放开传递依赖观察期，且安装全程禁止自动执行未授权生命周期构建脚本。
- **更新源与传输保护**：可在设置面板切换 npm 官方源、`npmmirror` 国内镜像或自定义安全 HTTPS 源；子进程采用最小环境变量白名单隔离、防 SSRF 与手工重定向校验、抗 CSRF 请求头及包含 `pnpm-workspace.yaml` 在内的原子快照回滚机制。
- **GitHub 插件检测说明**：针对 GitHub 来源插件（支持 `#ref` 分支/标签、40 位 commit SHA 固定规格及 `&path:<subdir>` 单仓库子路径），本插件通过 jsDelivr 与 `raw.githubusercontent.com` 并发竞速读取对应路径下 `package.json` 中的 `version` 字段作为更新信号；确认更新时会保留 `#ref` 与 `&path:<subdir>` 参数（同时解除固定 commit hash）以拉取目标分支或默认分支最新提交。

## 核心特性

- **启动期版本冲突自动关停（实验性）**：自动识别宿主拒绝加载、Cordis Fiber 崩溃/服务缺失、入口损坏及前端未捕获运行异常，自动停用故障插件保住 DSH 可用性；
- **红蓝正交状态分标（实验性）**：红色仅代表「冲突已停用」，蓝色仅代表「有新版本可更新」，侧边栏展开双胶囊、收起红标配蓝点、列表行与详情页独立并排；
- **自身抗升级解耦加固（实验性）**：最小化前后端 Cordis `inject` 硬依赖与 UI 组件容错加载，降低 DSH 宿主升级导致本插件自身挂起的风险；
- **GitHub 来源插件全面接管**：补充 DSH 原生对未固定 commit 的分支/标签/简写 GitHub 规格及 `&path:<subdir>` 子路径更新支持的空白；
- **原生优先与胶囊开关设置**：默认将 npm 官方源详情页更新交由 DSH 原生按钮处理，配置面板全面接入 DSH 原生 `Switch` 胶囊开关与双语本地化；
- **供应链安全门控与单包豁免**：默认拦截未满 24 小时观察期与未入市场索引的版本/浮动分支；开启对应高危开关（含危险确认弹窗）后仅精准豁免目标插件版本本身，子依赖继续保留 24 小时保护；

## 安装（实验性分支）

在 DSH 中打开「插件」→「添加插件」，输入：

```text
fengzhiyushui/dsh-plugins-update#experimental
```

或使用 DSH CLI：

```bash
dsh plugin --profile desktop add fengzhiyushui/dsh-plugins-update#experimental
```

## 开发与构建

```bash
pnpm install
pnpm run build
```

## 许可证

MIT License © [fengzhiyushui](https://github.com/fengzhiyushui)
