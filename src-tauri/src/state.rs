use std::collections::VecDeque;
use std::sync::atomic::AtomicBool;
use std::sync::Mutex;
use openssl::pkey::{PKey, Private};
use openssl::x509::X509;

/// 20MB 后端常驻日志缓冲区（环形先进先出队列，防内存无限膨胀）
pub struct LogBuffer {
    pub logs: VecDeque<String>,
    pub total_bytes: usize,
    pub max_bytes: usize,
}

impl LogBuffer {
    pub fn new(max_bytes: usize) -> Self {
        Self {
            logs: VecDeque::new(),
            total_bytes: 0,
            max_bytes,
        }
    }

    pub fn push(&mut self, line: String) {
        let line_len = line.len();
        self.total_bytes += line_len;
        self.logs.push_back(line);

        while self.total_bytes > self.max_bytes && !self.logs.is_empty() {
            if let Some(old) = self.logs.pop_front() {
                self.total_bytes = self.total_bytes.saturating_sub(old.len());
            }
        }
    }

    pub fn get_all(&self) -> Vec<String> {
        self.logs.iter().cloned().collect()
    }

    pub fn clear(&mut self) {
        self.logs.clear();
        self.total_bytes = 0;
    }
}

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
    /// MITM 抓包本地监听端口
    pub mitm_port: Mutex<Option<u16>>,
    /// MITM 代理关闭信号发送通道
    pub mitm_shutdown: Mutex<Option<tokio::sync::oneshot::Sender<()>>>,
    /// 存放解密加载到内存中的根证书与私钥，服务未启动或未导入时为 None
    pub mitm_ctx: Mutex<Option<MitmContext>>,
    /// 标记是否正在主动退出应用（用于托盘“退出程序”时放行 ExitRequested）
    pub is_quitting: AtomicBool,
    /// 20MB 后端日志环形缓冲区（主窗口关闭后仍持续记录，重新唤醒时全量恢复）
    pub log_buffer: Mutex<LogBuffer>,
    /// 托盘当前显示的运行模式 ("stopped", "normal", "admin")
    pub tray_mode: Mutex<String>,
    /// 托盘当前显示的监听端口 (例如 "2080")
    pub tray_port: Mutex<String>,
    /// 托盘当前显示的入站类型 ("Mixed", "HTTP only", "SOCKS5 only")
    pub tray_type: Mutex<String>,
}
