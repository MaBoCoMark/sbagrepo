pub mod check;
pub mod config;
pub mod env;
pub mod process;

// 改成用 * 导出，宏生成的 __cmd__xxx 就会一起被导出给 lib.rs 使用
pub use check::*;
pub use config::*;
pub use env::*;
pub use process::*;