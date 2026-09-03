# sing-box Desktop (MVP)

基于 **Tauri v2** + **React 18** + **GitHub Primer React (最新版)** 构建的 sing-box 桌面客户端最小可行性产品（MVP）。

专为 **Apple Silicon Mac (`aarch64-apple-darwin`)** 与 **x86_64 Windows 10 / 11 (`x86_64-pc-windows-msvc`)** 设计。

---

## 核心功能特性

1. **配置检查 (Check Config)**
   - 后端执行 `sing-box check -c <config_path>`。
   - 快速验证 JSON 语法与路由分流配置的正确性并即时反馈。

2. **普通启动 (Start Normal)**
   - 无需管理员提权，适合 Mixed / SOCKS 模式。
   - 异步拉起子进程，捕获标准输出与标准错误流，通过 Tauri 事件系统 (`log-message`) 实时推送到前端日志看板。

3. **管理员提权启动 (Start Admin / Privileged Run)**
   - 适用于开启 `tun` 虚拟网卡接口的全局代理模式。
   - **macOS (Apple Silicon)**: 通过 AppleScript 原生系统授权窗口 (`osascript -e 'do shell script "..." with administrator privileges'`) 提权拉起后台进程。
   - **Windows 10 / 11 (x86_64)**: 通过 PowerShell 原生 UAC 授权框 (`Start-Process ... -Verb RunAs`) 提权运行。

4. **终止进程 (Stop Process)**
   - 一键安全终止当前启动的普通子进程或后台提权进程。

5. **配置与运行状态解析看板 (Status Card)**
   - 实时解析 `config.json` 关键字段：
     - **运行模式检测**：自动检测 `inbounds` 中是否包含 `type: "tun"`，并在前端醒目提示必须使用【管理员提权运行】。
     - **监听端口**：自动读取 `mixed-in` 或首个入站端口 (`listen_port`)。
     - **日志等级**：自动提取 `log.level`。
     - **拓扑信息**：出站节点数量与分流规则统计。

6. **JSON 配置查看器 (Config Viewer)**
   - 遵循 MVP 规范，当前版本为只读预览模式，提示使用专业第三方编辑器（如 VS Code）修改配置，修改保存后支持一键【重新加载】刷新。

7. **实时日志看板 (Live Log Board)**
   - 监听 Tauri 后端 `log-message` 事件。
   - 提供日志行号高亮、不同日志级别（INFO/WARN/ERROR/DEBUG）着色显示。
   - 支持自动滚动至底部（可开关）、一键复制日志及一键清空。

---

## 技术架构与规范

### 底层技术栈
- **框架**: Tauri v2 (`src-tauri`)
- **前端**: React 18 + Vite + TypeScript
- **UI 规范**: 遵循 GitHub 最新官方 **Primer React (v38+)** 与 **Octicons React**
  - **严格规范 1**：全面移除已废弃的 `Box` 组件，替换为原生语义化标签及现代化布局规范。
  - **严格规范 2**：全面移除已被 Primer React 废弃的 `sx` 属性，采用 CSS 样式与规范化属性。
  - **严格规范 3**：全面移除已废弃的 `Flash` 组件，采用现代标准的 `Banner` 组件。
  - **组件应用**：`UnderlineNav`、`Banner`、`Button`、`TextInput`、`Heading`、`Text`、`Label`。

### Sidecar 外部二进制规范
位于 `src-tauri/binaries/`：
- **Apple Silicon macOS**: `sing-box-aarch64-apple-darwin`
- **Windows x86_64**: `sing-box-x86_64-pc-windows-msvc.exe`

---

## 快速开始

### 1. 安装依赖
```bash
pnpm install
```

### 2. 语法与类型检查
```bash
pnpm tsc --noEmit
```

### 3. 本地开发调试
```bash
pnpm tauri dev
```

### 4. 生产打包
```bash
# macOS 打包 (Apple Silicon)
pnpm tauri build --target aarch64-apple-darwin

# Windows 打包 (x86_64)
pnpm tauri build --target x86_64-pc-windows-msvc
```
