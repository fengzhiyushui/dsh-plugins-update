# dsh-plugins-update

DeepSeek Harness (DSH) 桌面端第三方插件**一键更新**插件。

解决 DSH 桌面端第三方插件在有新版本发布时“无法在界面直接更新、只能先卸载再重新安装”的痛点。

---

## 🌟 特性

* **原生无缝集成**：完美注入到 DSH 桌面端插件详情页（右上角【卸载】按钮旁边）。
* **智能版本对比**：打开插件详情页自动检测 npm 最新版本与本地已安装版本。
* **状态可视化**：
  * **发现新版本**：醒目高亮显示 `⬆️ 更新至 vX.X.X` 按钮，一键升级；
  * **已是最新**：显示 `✓ 已是最新`，支持点击手动重新检测；
  * **更新执行中**：显示 `正在更新...` Loading 状态；
  * **更新完成**：弹窗提示成功并引导重载生效。
* **零侵入官方客户端**：不修改 DSH 任何官方文件，通过原生插槽机制（`plugins.detail.actions`）与本地工具链协同工作。

---

## 🛠️ 安装方法

### 方式 1：在 DSH 桌面端界面直接添加（推荐）

1. 打开 DeepSeek Harness 桌面端；
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

## 📄 License

MIT License
