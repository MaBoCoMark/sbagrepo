use std::sync::Mutex;

/// 全局应用状态，维护正在运行的 sing-box 子进程 PID
pub struct AppState {
    pub child_pid: Mutex<Option<u32>>,
}
