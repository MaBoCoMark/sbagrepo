use std::net::TcpListener;
use std::sync::Mutex;

pub struct AppState {
    pub child_pid: Mutex<Option<u32>>,
    pub mitm_listener: Mutex<Option<TcpListener>>,
    pub mitm_port: Mutex<Option<u16>>,
}
