use std::net::TcpListener;
use std::sync::Mutex;
use openssl::pkey::{PKey, Private};
use openssl::x509::X509;

/// 内存中常驻的 MITM 根证书与私钥凭据（供代理运行时纯内存签发，避免磁盘与钥匙串 I/O）
pub struct MitmContext {
    pub ca_cert: X509,
    pub ca_key: PKey<Private>,
}

/// 应用全局共享状态
pub struct AppState {
    /// 当前由本程序拉起的 sing-box 子进程 PID（单实例精准管理）
    pub child_pid: Mutex<Option<u32>>,
    /// 是否为管理员/提权模式
    pub is_admin: Mutex<bool>,
    /// 是否为用户主动点击的正常终止（用于区分正常退出与意外崩溃退出）
    pub manual_stop: Mutex<bool>,
    /// MITM 抓包本地监听器
    pub mitm_listener: Mutex<Option<TcpListener>>,
    /// MITM 抓包本地监听端口
    pub mitm_port: Mutex<Option<u16>>,
    /// 存放解密加载到内存中的根证书与私钥，服务未启动或未导入时为 None
    pub mitm_ctx: Mutex<Option<MitmContext>>,
    /// 托盘当前显示的运行模式 ("stopped", "normal", "admin")
    pub tray_mode: Mutex<String>,
    /// 托盘当前显示的监听端口 (例如 "2080")
    pub tray_port: Mutex<String>,
    /// 托盘当前显示的入站类型 ("Mixed", "HTTP only", "SOCKS5 only")
    pub tray_type: Mutex<String>,
}