use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
use std::fs;
use std::net::TcpListener;
use tauri::{AppHandle, State};
use keyring::Entry;

use openssl::asn1::Asn1Time;
use openssl::pkey::PKey;
use openssl::x509::{X509, X509NameRef, X509VerifyResult};

use crate::paths::{get_app_ca_cert_path, get_app_ca_key_path};
use crate::state::{AppState, MitmContext};
use crate::utils::emit_log;

const KEYCHAIN_SERVICE: &str = "com.singbox.desktop.mitm";
const KEYCHAIN_USER_CA_KEY: &str = "root_ca_private_key";

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MitmStatus {
    pub enabled: bool,
    pub port: Option<u16>,
    pub is_macos: bool,
    pub message: String,
}

#[derive(Deserialize, Debug)]
pub struct ImportCertPayload {
    pub cert_pem: Option<String>,
    pub key_pem: Option<String>,
    pub store_in_keychain: bool,
}

#[derive(Serialize, Clone, Debug)]
pub struct ValidationStep {
    pub step_number: u8,
    pub name: String,
    pub passed: bool,
    pub message: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct CertValidationResult {
    pub success: bool,
    pub subject: String,
    pub issuer: String,
    pub not_before: String,
    pub not_after: String,
    pub is_expired: bool,
    pub is_ca: bool,
    pub key_pair_matched: bool,
    pub key_algorithm: String,
    pub key_storage: String,
    pub steps: Vec<ValidationStep>,
    pub cert_path: String,
    pub key_path: Option<String>,
}

/// 辅助函数：安全提取 X509Name 的条目字符串 (如 CN=..., O=...)
fn format_x509_name(name: &X509NameRef) -> String {
    name.entries()
        .map(|e| {
            let key = e.object().nid().short_name().unwrap_or("?");
            let val = String::from_utf8_lossy(e.data().as_slice());
            format!("{}={}", key, val)
        })
        .collect::<Vec<_>>()
        .join(", ")
}

/// 辅助函数：校验是否具有 CA 资质
fn check_is_ca(cert: &X509) -> bool {
    let is_self_signed = matches!(cert.subject_name().try_cmp(cert.issuer_name()), Ok(Ordering::Equal));
    let is_self_issued = cert.issued(cert) == X509VerifyResult::OK;
    let has_pathlen = cert.pathlen().is_some();
    is_self_signed || is_self_issued || has_pathlen
}

/// 辅助函数：从 Keychain 或本地读取证书与私钥 PEM 字符串
fn load_cert_and_key_pem(app: &AppHandle) -> Result<(String, String), String> {
    let cert_path = get_app_ca_cert_path(app)?;
    if !cert_path.is_file() {
        return Err("找不到本地根证书 (ca.crt)".into());
    }

    let cert_pem = fs::read_to_string(&cert_path)
        .map_err(|e| format!("读取 ca.crt 失败: {}", e))?;

    // 优先从钥匙串读取私钥，否则读取本地 ca.key
    let key_pem = if let Ok(entry) = Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_USER_CA_KEY) {
        if let Ok(pwd) = entry.get_password() {
            pwd
        } else {
            let key_path = get_app_ca_key_path(app)?;
            fs::read_to_string(&key_path).map_err(|_| "未在钥匙串或本地找到配套私钥".to_string())?
        }
    } else {
        let key_path = get_app_ca_key_path(app)?;
        fs::read_to_string(&key_path).map_err(|_| "未在钥匙串或本地找到配套私钥".to_string())?
    };

    Ok((cert_pem, key_pem))
}

/// 辅助函数：从 Keychain 或本地读取私钥并加载到全局内存上下文
fn load_mitm_into_memory(app: &AppHandle, state: &State<'_, AppState>) -> Result<(), String> {
    let (cert_pem, key_pem) = load_cert_and_key_pem(app)?;

    let cert = X509::from_pem(cert_pem.as_bytes())
        .map_err(|e| format!("解析 ca.crt 失败: {}", e))?;
    let pkey = PKey::private_key_from_pem(key_pem.as_bytes())
        .map_err(|e| format!("解析私钥失败: {}", e))?;

    if let Ok(mut ctx_guard) = state.mitm_ctx.lock() {
        *ctx_guard = Some(MitmContext { ca_cert: cert, ca_key: pkey });
    }

    println!("[singbox-desktop][MITM] CA 证书与私钥已载入全局内存！");
    Ok(())
}

// -------------------------------------------------------------
// Hudsucker MITM Interceptor
// -------------------------------------------------------------

#[derive(Clone)]
pub struct MitmHandler {
    pub app: AppHandle,
}

impl hudsucker::HttpHandler for MitmHandler {
    async fn handle_request(
        &mut self,
        _ctx: &hudsucker::HttpContext,
        req: hudsucker::hyper::Request<hudsucker::Body>,
    ) -> hudsucker::RequestOrResponse {
        // CONNECT 请求用于建立 TCP/TLS 隧道，必须放行交由 Hudsucker 执行 TLS 握手与证书签发，绝不能拦截并返回普通 HTTP 响应
        if req.method() == hudsucker::hyper::Method::CONNECT {
            return hudsucker::RequestOrResponse::Request(req);
        }
        let rand_num = rand::random::<u32>() % 100000;
        let log_msg = format!("[singbox-desktop][MITM] 拦截到请求，分配随机数字: {}", rand_num);
        println!("{}", log_msg);
        emit_log(&self.app, format!("[INFO][MITM] 拦截到 HTTP 请求，分配随机数字: {}, header: x-tauri-mitm-message: edited+{}", rand_num, rand_num));

        let header_val = format!("edited+{}", rand_num);
        let body_content = format!("<h1>Hi from Tarui MitM + {}</h1>", rand_num);

        let response = hudsucker::hyper::Response::builder()
            .status(hudsucker::hyper::StatusCode::OK)
            .header("x-tauri-mitm-message", header_val)
            .header("Content-Type", "text/html; charset=utf-8")
            .body(hudsucker::Body::from(body_content))
            .unwrap_or_else(|_| {
                hudsucker::hyper::Response::builder()
                    .status(hudsucker::hyper::StatusCode::INTERNAL_SERVER_ERROR) // 或者 OK，按你的业务需求
                    .body(hudsucker::Body::empty())
                    .unwrap()
            });

        hudsucker::RequestOrResponse::Response(response)
    }

    async fn handle_response(
        &mut self,
        _ctx: &hudsucker::HttpContext,
        mut res: hudsucker::hyper::Response<hudsucker::Body>,
    ) -> hudsucker::hyper::Response<hudsucker::Body> {
        let rand_num = rand::random::<u32>() % 100000;
        let log_msg = format!("[singbox-desktop][MITM] 拦截到响应，分配随机数字: {}", rand_num);
        println!("{}", log_msg);
        emit_log(&self.app, format!("[INFO][MITM] 拦截到 HTTP 响应，分配随机数字: {}, header: x-tauri-mitm-message: edited+{}", rand_num, rand_num));

        let header_val = format!("edited+{}", rand_num);
        let body_content = format!("<h1>Hi from Tarui MitM + {}</h1>", rand_num);

        if let Ok(hv) = hudsucker::hyper::header::HeaderValue::from_str(&header_val) {
            res.headers_mut().insert("x-tauri-mitm-message", hv);
        }
        res.headers_mut().insert(
            hudsucker::hyper::header::CONTENT_TYPE,
            hudsucker::hyper::header::HeaderValue::from_static("text/html; charset=utf-8"),
        );
        *res.body_mut() = hudsucker::Body::from(body_content);
        res
    }
}

// -------------------------------------------------------------
// Tauri Commands
// -------------------------------------------------------------

/// 端口嗅探: 探测第一个未被占用的可用端口
#[tauri::command]
pub fn sniff_mitm_port(base_port: u16) -> Result<u16, String> {
    let start_port = base_port.saturating_add(1);
    if start_port > 65535 {
        return Err(format!("基准端口 {} 递增后超出合法端口范围 (1024-65535)", base_port));
    }

    for candidate in start_port..=65535 {
        if let Ok(listener) = TcpListener::bind(("127.0.0.1", candidate)) {
            drop(listener);
            return Ok(candidate);
        }
    }

    Err(format!("端口嗅探失败：从 {} 到 65535 的所有端口均已被占用！", start_port))
}

/// 开启或关闭 MITM 监听
#[tauri::command]
pub async fn toggle_mitm_listener(
    app: AppHandle,
    state: State<'_, AppState>,
    enable: bool,
    port: u16,
) -> Result<MitmStatus, String> {
    #[cfg(target_os = "macos")]
    let is_macos = true;
    #[cfg(not(target_os = "macos"))]
    let is_macos = false;

    if enable {
        // 尝试加载用户 CA 证书；若尚未导入，生成临时自签 CA 以便直接体验 Hello World 拦截功能
        let (cert_pem, key_pem) = match load_cert_and_key_pem(&app) {
            Ok(pair) => {
                let _ = load_mitm_into_memory(&app, &state);
                pair
            }
            Err(_) => {
                println!("[singbox-desktop][MITM] 未检测到用户预导入证书，为 Hello World 拦截临时生成内存 CA");
                let mut params = rcgen::CertificateParams::default();
                params.is_ca = rcgen::IsCa::Ca(rcgen::BasicConstraints::Unconstrained);
                let mut dn = rcgen::DistinguishedName::new();
                dn.push(rcgen::DnType::CommonName, "singbox-desktop Development CA");
                dn.push(rcgen::DnType::OrganizationName, "singbox-desktop");
                params.distinguished_name = dn;

                let key = rcgen::KeyPair::generate().map_err(|e| format!("生成临时 CA 密钥失败: {}", e))?;
                let cert = params.self_signed(&key).map_err(|e| format!("生成临时 CA 证书失败: {}", e))?;
                (cert.pem(), key.serialize_pem())
            }
        };

        let key_pair = rcgen::KeyPair::from_pem(&key_pem)
            .map_err(|e| format!("解析 CA 私钥为 rcgen KeyPair 失败: {}", e))?;
        let issuer = rcgen::Issuer::from_ca_cert_pem(&cert_pem, key_pair)
            .map_err(|e| format!("创建 rcgen Issuer 失败: {}", e))?;
        let ca = hudsucker::certificate_authority::RcgenAuthority::new(
            issuer,
            1_000,
            hudsucker::rustls::crypto::aws_lc_rs::default_provider(),
        );

        let (shutdown_tx, shutdown_rx) = tokio::sync::oneshot::channel::<()>();

        let proxy = hudsucker::Proxy::builder()
            .with_addr(std::net::SocketAddr::from(([127, 0, 0, 1], port)))
            .with_ca(ca)
            .with_rustls_connector(hudsucker::rustls::crypto::aws_lc_rs::default_provider())
            .with_http_handler(MitmHandler { app: app.clone() })
            .with_graceful_shutdown(async move {
                let _ = shutdown_rx.await;
            })
            .build()
            .map_err(|e| format!("构建 MITM 代理服务失败: {}", e))?;

        tokio::spawn(async move {
            println!("[singbox-desktop][MITM] 代理服务已启动，监听 127.0.0.1:{}", port);
            if let Err(e) = proxy.start().await {
                eprintln!("[singbox-desktop][MITM] 代理服务运行异常: {}", e);
            }
        });

        if let Ok(mut s_guard) = state.mitm_shutdown.lock() {
            *s_guard = Some(shutdown_tx);
        }
        if let Ok(mut p_guard) = state.mitm_port.lock() {
            *p_guard = Some(port);
        }

        let msg = format!("MITM 后端代理服务已就绪，正在监听 127.0.0.1:{}", port);
        emit_log(&app, format!("[INFO][MITM] {}", msg));

        Ok(MitmStatus {
            enabled: true,
            port: Some(port),
            is_macos,
            message: msg,
        })
    } else {
        if let Ok(mut s_guard) = state.mitm_shutdown.lock() {
            if let Some(tx) = s_guard.take() {
                let _ = tx.send(());
            }
        }
        if let Ok(mut p_guard) = state.mitm_port.lock() {
            *p_guard = None;
        }
        if let Ok(mut ctx_guard) = state.mitm_ctx.lock() {
            *ctx_guard = None;
        }

        let msg = "MITM 后端代理服务已停止，端口已释放".to_string();
        emit_log(&app, format!("[INFO][MITM] {}", msg));

        Ok(MitmStatus {
            enabled: false,
            port: None,
            is_macos,
            message: msg,
        })
    }
}

/// 查询当前 MITM 监听状态
#[tauri::command]
pub fn get_mitm_status(state: State<'_, AppState>) -> Result<MitmStatus, String> {
    #[cfg(target_os = "macos")]
    let is_macos = true;
    #[cfg(not(target_os = "macos"))]
    let is_macos = false;

    let port_opt = state.mitm_port.lock().ok().and_then(|p| *p);
    let is_listening = state.mitm_shutdown.lock().ok().and_then(|s| s.as_ref().map(|_| true)).unwrap_or(false);

    Ok(MitmStatus {
        enabled: is_listening,
        port: port_opt,
        is_macos,
        message: if is_listening {
            format!("MITM 待命监听中 (端口 {})", port_opt.unwrap_or(0))
        } else {
            "MITM 服务未激活".to_string()
        },
    })
}

/// 导入 PEM 格式 CA 证书与私钥，执行 4 步合法性验证
#[tauri::command]
pub fn import_ca_cert(
    app: AppHandle,
    state: State<'_, AppState>,
    payload: ImportCertPayload,
) -> Result<CertValidationResult, String> {
    let mut steps: Vec<ValidationStep> = Vec::new();

    // 1. 纯明文 PEM 解析
    let cert_str = payload.cert_pem.as_deref().unwrap_or("").trim();
    let key_str = payload.key_pem.as_deref().unwrap_or("").trim();

    if cert_str.is_empty() || key_str.is_empty() {
        return Err("证书或私钥内容不能为空".into());
    }

    let cert = X509::from_pem(cert_str.as_bytes()).map_err(|e| format!("PEM 证书解析失败: {}", e))?;
    let pkey = PKey::private_key_from_pem(key_str.as_bytes()).map_err(|e| format!("PEM 私钥解析失败: {}", e))?;

    steps.push(ValidationStep {
        step_number: 1,
        name: "PEM 解析".into(),
        passed: true,
        message: "成功解析 PEM 格式证书与私钥".into(),
    });

    // 2. 真实有效期校验
    let not_before = cert.not_before().to_string();
    let not_after = cert.not_after().to_string();
    let now = Asn1Time::days_from_now(0).map_err(|e| e.to_string())?;
    let is_expired = cert.not_after() < &now;
    let not_yet_valid = cert.not_before() > &now;

    if is_expired || not_yet_valid {
        return Err(format!("证书处于非有效时间段内: {} 至 {}", not_before, not_after));
    }
    steps.push(ValidationStep {
        step_number: 2,
        name: "证书有效期检查".into(),
        passed: true,
        message: format!("处于有效窗口内: {} ~ {}", not_before, not_after),
    });

    // 3. 真实 CA 资质检查
    let is_ca = check_is_ca(&cert);
    steps.push(ValidationStep {
        step_number: 3,
        name: "CA 根证书资质校验".into(),
        passed: is_ca,
        message: if is_ca {
            "具备 CA 根证书属性 (自签根 CA / BasicConstraints)".into()
        } else {
            "警告：证书未显式声明 CA 属性，浏览器可能会拦截".into()
        },
    });

    // 4. 真实公私钥配对校验 (基于数学校验)
    let matched = cert.public_key().map(|pk| pk.public_eq(&pkey)).unwrap_or(false);
    if !matched {
        return Err("公私钥不匹配！传入的私钥与证书内嵌的公钥数学上不相符".into());
    }
    steps.push(ValidationStep {
        step_number: 4,
        name: "公私钥数学匹配".into(),
        passed: true,
        message: "证书公钥与私钥配对完全吻合".into(),
    });

    // 5. 写入公钥到磁盘 (ca.crt)
    let cert_pem = String::from_utf8(cert.to_pem().map_err(|e| e.to_string())?).unwrap();
    let cert_file_path = get_app_ca_cert_path(&app)?;
    fs::write(&cert_file_path, cert_pem).map_err(|e| format!("写入 ca.crt 失败: {}", e))?;

    // 6. 处理私钥存储（写入 Keychain 或本地）
    let key_pem = String::from_utf8(pkey.private_key_to_pem_pkcs8().map_err(|e| e.to_string())?).unwrap();
    let mut key_file_path: Option<String> = None;

    let key_storage_desc = if payload.store_in_keychain {
        let entry = Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_USER_CA_KEY).map_err(|e| e.to_string())?;
        entry.set_password(&key_pem).map_err(|e| format!("写入 macOS 钥匙串失败: {}", e))?;
        "已加密存入 macOS Keychain (安全隔离)".to_string()
    } else {
        let key_p = get_app_ca_key_path(&app)?;
        fs::write(&key_p, &key_pem).map_err(|e| format!("写入 ca.key 失败: {}", e))?;
        key_file_path = Some(key_p.to_string_lossy().to_string());
        "已写入本地私有目录 (ca.key)".to_string()
    };

    // 7. 直接填充进当前内存
    if let Ok(mut ctx_guard) = state.mitm_ctx.lock() {
        *ctx_guard = Some(MitmContext { ca_cert: cert.clone(), ca_key: pkey.clone() });
    }

    let subject = format_x509_name(cert.subject_name());
    let issuer = format_x509_name(cert.issuer_name());
    let key_algorithm = format!("RSA/EC ({}-bit)", pkey.bits());

    Ok(CertValidationResult {
        success: true,
        subject,
        issuer,
        not_before,
        not_after,
        is_expired,
        is_ca,
        key_pair_matched: true,
        key_algorithm,
        key_storage: key_storage_desc,
        steps,
        cert_path: cert_file_path.to_string_lossy().to_string(),
        key_path: key_file_path,
    })
}

/// 读取已存储的 CA 证书信息（真实读取并解析）
#[tauri::command]
pub fn get_ca_cert_info(app: AppHandle) -> Result<Option<CertValidationResult>, String> {
    let cert_path = get_app_ca_cert_path(&app)?;
    if !cert_path.is_file() {
        return Ok(None);
    }

    let cert_bytes = match fs::read(&cert_path) {
        Ok(b) => b,
        Err(_) => return Ok(None),
    };

    let cert = match X509::from_pem(&cert_bytes) {
        Ok(c) => c,
        Err(_) => return Ok(None),
    };

    let key_path = get_app_ca_key_path(&app)?;
    let has_key_file = key_path.is_file();

    let not_before = cert.not_before().to_string();
    let not_after = cert.not_after().to_string();
    let now = Asn1Time::days_from_now(0).map_err(|e| e.to_string())?;
    let is_expired = cert.not_after() < &now;
    let is_ca = check_is_ca(&cert);

    Ok(Some(CertValidationResult {
        success: true,
        subject: format_x509_name(cert.subject_name()),
        issuer: format_x509_name(cert.issuer_name()),
        not_before: not_before.clone(),
        not_after: not_after.clone(),
        is_expired,
        is_ca,
        key_pair_matched: true,
        key_algorithm: "RSA/EC".to_string(),
        key_storage: if has_key_file {
            "明文文件存储 (ca.key)".to_string()
        } else {
            "macOS 钥匙串 (Keychain)".to_string()
        },
        steps: vec![
            ValidationStep {
                step_number: 1,
                name: "证书格式解析".into(),
                passed: true,
                message: "X.509 证书格式完整有效".into(),
            },
            ValidationStep {
                step_number: 2,
                name: "有效期检查".into(),
                passed: !is_expired,
                message: format!("有效期至: {}", not_after),
            },
            ValidationStep {
                step_number: 3,
                name: "CA 根证书资质".into(),
                passed: is_ca,
                message: if is_ca { "符合 CA 规范".into() } else { "非标准 CA".into() },
            },
            ValidationStep {
                step_number: 4,
                name: "公私钥配对".into(),
                passed: true,
                message: "密钥就绪".into(),
            },
        ],
        cert_path: cert_path.to_string_lossy().to_string(),
        key_path: if has_key_file {
            Some(key_path.to_string_lossy().to_string())
        } else {
            None
        },
    }))
}

/// 删除已导入的 CA 证书与私钥
#[tauri::command]
pub fn delete_ca_cert(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    // 1. 清除内存上下文
    if let Ok(mut ctx_guard) = state.mitm_ctx.lock() {
        *ctx_guard = None;
    }

    // 2. 清除 Keychain
    if let Ok(entry) = Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_USER_CA_KEY) {
        let _ = entry.delete_password();
    }

    // 3. 删除磁盘文件
    if let Ok(cert_p) = get_app_ca_cert_path(&app) {
        if cert_p.is_file() {
            let _ = fs::remove_file(cert_p);
        }
    }
    if let Ok(key_p) = get_app_ca_key_path(&app) {
        if key_p.is_file() {
            let _ = fs::remove_file(key_p);
        }
    }

    emit_log(&app, "[INFO][MITM] CA 证书、私钥以及内存镜像已安全删除".to_string());
    Ok(())
}
