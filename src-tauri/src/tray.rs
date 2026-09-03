use tauri::{
    menu::{Menu, MenuBuilder, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, Runtime,
};
use crate::commands::process::do_stop_process;
use crate::state::AppState;

pub const TRAY_ID: &str = "singbox_tray";

/// 构建系统托盘菜单
/// 包含:
/// 1. 显示窗口 (点击唤醒并置顶窗口)
/// 2. 分隔线
/// 3. 第 1 行: normal 模式 / sudo 模式 / not running
/// 4. 第 2 行: listening 端口 (如 Listening: 12345)
/// 5. 第 3 行: mixed / HTTP only / SOCKS five only
/// 6. 分隔线
/// 7. 退出程序 (安全终止内核并退出应用)
pub fn create_tray_menu<R: Runtime>(
    app: &AppHandle<R>,
    mode: &str,
    port: &str,
    proxy_type: &str,
) -> tauri::Result<Menu<R>> {
    let show_item = MenuItem::with_id(app, "show_window", "显示窗口", true, None::<&str>)?;
    let sep1 = PredefinedMenuItem::separator(app)?;

    // 第 1 行：运行模式状态 (只读状态项，禁用点击)
    let mode_label = match mode {
        "normal" => "Normal 模式",
        "admin" => "Sudo 模式",
        _ => "Not running",
    };
    let mode_item = MenuItem::with_id(app, "tray_mode", mode_label, false, None::<&str>)?;

    // 第 2 行：监听端口 (只读状态项，禁用点击)
    let port_label = if port.is_empty() || port == "-" {
        "Listening: -".to_string()
    } else {
        format!("Listening: {}", port)
    };
    let port_item = MenuItem::with_id(app, "tray_port", &port_label, false, None::<&str>)?;

    // 第 3 行：入站代理类型 (只读状态项，禁用点击)
    let type_label = match proxy_type {
        "HTTP only" => "HTTP only",
        "SOCKS5 only" => "SOCKS5 only",
        _ => "Mixed",
    };
    let type_item = MenuItem::with_id(app, "tray_type", type_label, false, None::<&str>)?;

    let sep2 = PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItem::with_id(app, "quit_app", "退出程序", true, None::<&str>)?;

    MenuBuilder::new(app)
        .items(&[
            &show_item,
            &sep1,
            &mode_item,
            &port_item,
            &type_item,
            &sep2,
            &quit_item,
        ])
        .build()
}

/// 初始化系统托盘
pub fn setup_tray(app: &tauri::App) -> tauri::Result<()> {
    let app_handle = app.handle();
    let initial_menu = create_tray_menu(app_handle, "stopped", "-", "Mixed")?;

    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .menu(&initial_menu)
        .show_menu_on_left_click(true)
        .tooltip("sing-box Desktop")
        .on_menu_event(|app, event| {
            match event.id.as_ref() {
                "show_window" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.unminimize();
                        let _ = window.set_focus();
                    }
                }
                "quit_app" => {
                    println!("[singbox-desktop][tray] 收到托盘退出程序请求");
                    if let Some(state) = app.try_state::<AppState>() {
                        let _ = do_stop_process(app, &state);
                    }
                    app.exit(0);
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            // 点击托盘图标时响应
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            }
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }

    builder.build(app)?;
    println!("[singbox-desktop][tray] 系统托盘图标与状态菜单初始化完成 (ID: {})", TRAY_ID);
    Ok(())
}

/// 动态刷新托盘菜单展示信息
pub fn update_tray_menu_state<R: Runtime>(
    app: &AppHandle<R>,
    mode: &str,
    port: &str,
    proxy_type: &str,
) {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        if let Ok(menu) = create_tray_menu(app, mode, port, proxy_type) {
            let _ = tray.set_menu(Some(menu));
        }
    }
}
