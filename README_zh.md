# dsh-plugins-update

<p align="center">
  <img src="icon.svg" width="80" height="80" alt="dsh-plugins-update icon" />
</p>

<p align="center">
  <b>DeepSeek Harness (DSH) 桌面端第三方插件「一键更新」扩展插件。</b>
</p>

<p align="center">
  <a href="https://github.com/fengzhiyushui/dsh-plugins-update/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT" /></a>
  <a href="https://github.com/fengzhiyushui/dsh-plugins-update/releases"><img src="https://img.shields.io/badge/Release-v0.1.2-brightgreen.svg" alt="Release" /></a>
  <a href="https://github.com/fengzhiyushui/dsh-plugins-update"><img src="https://img.shields.io/badge/DeepSeek%20Harness-v0.2+-orange.svg" alt="DeepSeek Harness" /></a>
</p>

---

解决 DeepSeek Harness 桌面端第三方插件在发布新版本后“界面没有更新按钮、只能先卸载再重新安装”的痛点。

---

## 🌟 核心特性

* **原生无缝集成**：通过官方原生的 `plugins.detail.actions` 插槽，完美注入到插件详情页右上角（【卸载】按钮旁边）。
* **智能版本对比**：打开插件详情页自动检测 npm / 镜像源的最新版本，并与本地已安装版本进行语义化版本对比。
* **状态动态反馈**：
  * **发现新版本**：醒目高亮显示 `⬆️ 更新至 vX.X.X` 按钮，一键升级；
  * **已是最新**：显示 `✓ 已是最新`，支持点击重新检测；
  * **正在更新**：显示 `正在更新...` Loading 状态并锁定操作；
  * **更新完成**：弹窗提示成功并引导重载生效。
* **灵活的多源切换与自定义源**：
  * **自动模式（推荐）**：并发探测测速，并智能检查国内镜像包版本完整度，缺包时无缝切换官方源；
  * **npm 官方源**：直连官方，首发可用，绝无镜像同步滞后；
  * **国内源 npmmirror**：与 DSH 客户端自带同款，国内高速解析；
  * **自定义更新源**：支持用户自行添加、切换和删除私有源或云厂商镜像；
  * **故障自动回退**：国内或自定义源安装失败时，自动重试官方源兜底。
* **零侵入官方客户端**：不修改官方 DSH 的任何安装文件，通过 Cordis 微内核机制与本地环境协同工作。

---

## 🛠️ 安装方法

### 方式 1：在 DSH 桌面端界面直接添加（推荐）

1. 打开 **DeepSeek Harness 桌面端**；
2. 点击左侧边栏的 **「插件」**；
3. 点击页面右上角的 **「+ 添加插件」**；
4. 在输入框中直接输入 GitHub 仓库地址：
   ```text
   fengzhiyushui/dsh-plugins-update
   ```
   或者完整地址：
   ```text
   https://github.com/fengzhiyushui/dsh-plugins-update
   ```
5. 点击 **「安装」**，安装完成后刷新应用即可生效！

### 方式 2：使用 DSH 内置命令行添加

在终端中运行：

```bash
dsh plugin --profile desktop add fengzhiyushui/dsh-plugins-update
```

---

## 💡 开发与构建

如果您对插件源码进行了修改，只需在项目目录下运行构建命令：

```bash
# 安装依赖
pnpm install

# 编译打包前端与后端
pnpm run build
```

构建产物将自动生成到 `lib/` 目录中：
* `lib/client.js`：注入到 DSH 渲染进程的前端 Slot 动作组件；
* `lib/index.js`：运行于 DSH 宿主环境的后端更新服务。

---

## 📄 开源许可

[MIT License](LICENSE) © [fengzhiyushui](https://github.com/fengzhiyushui)
