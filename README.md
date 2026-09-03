# sing-box Desktop (Control Center MVP)

基于 **Tauri v2** 与 GitHub **Primer React + Octicons** 最新规范打造的轻量级 sing-box 桌面控制中心。专为 **Apple Silicon Mac (M1/M2/M3/M4)** 与 **Windows 10/11 x64** 平台设计。

---

## 🌟 核心特性与架构设计

### 1. 核心功能（MVP 最小可行性产品）
- **配置语法检查（Check）**：调用底层二进制 `sing-box check -c <config>` 验证配置合法性。
- **普通启动（Direct Run）**：适用于 Mixed (HTTP/SOCKS5) 代理模式，无需管理员提权，Rust Tokio 异步管道捕获 stdout/stderr 实时流式推送到前端。
- **管理员提权启动（Admin/Sudo Run）**：专为 **TUN 虚拟网卡模式**设计：
  - **macOS**：通过 `osascript` 唤起系统原生 Touch ID / 密码授权弹窗并在后台守护运行。
  - **Windows**：通过 PowerShell `Start-Process -Verb RunAs` 唤起 Windows 原生 UAC 提权确认框。
- **进程终止（Stop Process）**：智能终止普通启动的子进程或全局清理残留的后台 sing-box 实例（macOS `pkill` / Windows `taskkill`）。
- **状态感知与 TUN 警告卡片**：
  - 自动解析 `config.json`，检测是否启用 `type: "tun"`。若启用，界面展示醒目的警告卡片提示必须以管理员提权启动。
  - 提取 Mixed 混合入站端口（如 `:2080`）与 `log.level` 日志等级。
- **只读配置查看区**：格式化展示当前配置文件内容，支持一键复制，并明确提示用户使用外部编辑器（VS Code / Cursor）修改配置后点击重新加载。
- **实时日志看板（Live Logs）**：监听 Tauri `log-message` 事件流，具备自动滚动到底部、日志级别过滤（ALL / INFO / WARN / ERROR）、关键字过滤、一键复制及清空日志等功能。

---

## 🎨 Primer React & Octicons 规范与避坑实践

本项目前端严格遵循 GitHub Primer React 最新规范，杜绝所有已废弃（deprecated）语法：

| 组件 / 属性 | 已废弃的旧写法 ❌ | 当前最新推荐写法 ✅ |
| :--- | :--- | :--- |
| **Button 图标** | `<Button><Octicon icon={PlayIcon} /> 运行</Button>` | `<Button leadingVisual={PlayIcon}>运行</Button>` |
| **导航标签** | `<UnderlineNav.Link selected>...</UnderlineNav.Link>` | `<UnderlineNav.Item icon={...} aria-current="page">...</UnderlineNav.Item>` |
| **布局边框容器** | `<BorderBox>` (已从 `@primer/react` 移除) | `<Box sx={{ border: '1px solid', borderColor: 'border.default', borderRadius: 2 }}>` |
| **页面头部** | `<Pagehead>` (已废弃移除) | `<Box>` + `<Heading as="h1">` |
| **状态横幅** | `<Flash variant="warning">` 或 `<Banner>` | `<Flash variant="warning">` 与设计系统标准 token 联动 |
| **主题方案** | 硬编码样式 | `<ThemeProvider colorMode="night" dayScheme="light" nightScheme="dark">` + `<BaseStyles>` |

---

## 📂 项目结构

```text
/singbox-desktop/
├── config.json                               # 默认 sing-box 配置文件（预置 Mixed 与 TUN 模式）
├── package.json                              # 前端依赖 (@primer/react, @primer/octicons-react, @tauri-apps/api)
├── vite.config.ts                            # Vite 生产/开发打包配置
├── tsconfig.json                             # TypeScript 编译配置
├── index.html                                # 入口 HTML
├── src/
│   ├── main.tsx                              # React 挂载入口
│   ├── App.tsx                               # 核心应用框架 (UnderlineNav 标签页切换、状态管理)
│   ├── index.css                             # 终端字体与滚动条样式
│   ├── types/
│   │   └── index.ts                          # 配置结构与日志实体 TypeScript 类型定义
│   ├── utils/
│   │   ├── configParser.ts                   # sing-box JSON 配置智能解析器 (检测 TUN / 端口 / 日志级别)
│   │   └── tauriBridge.ts                    # Tauri IPC 调用封装 (含浏览器预览降级模拟)
│   ├── components/
│   │   ├── Header.tsx                        # 顶部栏 (应用信息、当前平台标识、运行状态徽章、明暗主题切换)
│   │   ├── ActionToolbar.tsx                 # 操作栏 (语法检查、普通启动、提权启动、终止进程、路径配置)
│   │   ├── StatusCard.tsx                    # 3 大关键状态卡片 (TUN 模式检测警告、监听端口、日志级别)
│   │   ├── ConfigViewer.tsx                  # 配置只读格式化高亮区 (外部编辑器提示、复制 JSON)
│   │   └── LogBoard.tsx                      # 实时日志看板 (Tauri log-message 监听、自动滚屏、级别过滤)
│   └── assets/
│       └── sample-config.json                # 备用样例配置文件
├── src-tauri/
│   ├── Cargo.toml                            # Rust 依赖配置 (tauri v2, tokio, serde)
│   ├── build.rs                              # Tauri 构建脚本
│   ├── tauri.conf.json                       # Tauri v2 平台配置与 sidecar externalBin 声明
│   ├── capabilities/
│   │   └── default.json                      # Tauri v2 权限与事件监听能力声明
│   ├── icons/                                # 应用多尺寸图标 (.png, .ico, .icns)
│   ├── binaries/
│   │   ├── sing-box-aarch64-apple-darwin     # Apple Silicon Mac sidecar 二进制文件
│   │   ├── sing-box-x86_64-pc-windows-msvc.exe # Windows x64 sidecar 二进制文件
│   │   └── README.md                         # Sidecar 放置规范与说明
│   └── src/
│       └── main.rs                           # Rust 后端核心实现 (Tokio 管道流、提权逻辑、跨平台停止)
└── scripts/
    ├── download-sing-box.sh                  # 一键下载 macOS Apple Silicon 官方 release 二进制
    └── download-sing-box.ps1                 # 一键下载 Windows x64 官方 release 二进制
```

---

## 🚀 跨平台 Sidecar 二进制准备

Tauri 规范要求将外部可执行文件存放在 `src-tauri/binaries/` 目录下，并以 `sing-box-$TARGET_TRIPLE` 命名。

项目已内嵌开箱即用的测试 mock 脚本，若要替换为官方编译二进制：

### 🍎 Apple Silicon Mac (M1/M2/M3/M4 - `aarch64-apple-darwin`)
直接在终端中运行提供的辅助下载脚本：
```bash
chmod +x scripts/download-sing-box.sh
./scripts/download-sing-box.sh
```
或者手动从 [SagerNet/sing-box Releases](https://github.com/SagerNet/sing-box/releases) 下载 `sing-box-*-darwin-arm64.tar.gz`，解压后的 `sing-box` 放置于：
```bash
src-tauri/binaries/sing-box-aarch64-apple-darwin
chmod +x src-tauri/binaries/sing-box-aarch64-apple-darwin
```

### 🪟 Windows 10 / 11 64位 (`x86_64-pc-windows-msvc`)
在 PowerShell 中运行提供的下载脚本：
```powershell
.\scripts\download-sing-box.ps1
```
或者手动下载 `sing-box-*-windows-amd64.zip`，将解压后的 `sing-box.exe` 放置并重命名为：
```powershell
src-tauri\binaries\sing-box-x86_64-pc-windows-msvc.exe
```

---

## 🛠️ 安装与运行指南

### 1. 前置环境要求
- **Node.js**: >= 18 (建议 Node 20 / 22)
- **Rust**: >= 1.77 (`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`)
- **macOS 构建依赖**: Xcode Command Line Tools (`xcode-select --install`)
- **Windows 构建依赖**: Microsoft C++ Build Tools & WebView2 Runtime

### 2. 安装前端依赖
```bash
npm install
```

### 3. 开发环境启动 (Dev Mode)
启动 Vite 开发服务器及 Tauri 桌面原生窗口：
```bash
npm run tauri dev
```
*(也可以单独启动 Web 界面 `npm run dev`，前端内建了 Tauri 降级模拟器，可在普通浏览器中调试 UI 布局)*

### 4. 生产打包 (Production Build)
生成对应平台的最终安装包（macOS `.dmg` / Windows `.msi` 或 `.exe`）：
```bash
npm run tauri build
```
打包输出目录：
- macOS: `src-tauri/target/release/bundle/dmg/`
- Windows: `src-tauri/target/release/bundle/msi/`

---

## 🔒 权限与安全说明

1. **普通模式（Direct Run）**：以标准用户权限启动子进程，仅占用本地端口（如 `127.0.0.1:2080`），完全不需要管理员权限。
2. **TUN 虚拟网卡提权**：
   - macOS 下采用 AppleScript 原生系统授权机制（支持指纹 Touch ID 解锁），无需常驻高危后台 daemon。
   - Windows 下通过系统级 UAC `RunAs` 提权启动，不会产生任何越权隐患。
3. **进程安全管理**：程序在启动新实例或关闭时均会妥善回收旧进程句柄，防止孤儿进程占用系统网络端口。
