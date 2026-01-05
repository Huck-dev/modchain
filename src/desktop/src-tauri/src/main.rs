// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, State,
};

// ============ State ============

struct NodeProcess(Mutex<Option<Child>>);

#[derive(Debug, Clone, Serialize, Deserialize)]
struct NodeSettings {
    orchestrator_url: String,
    auto_start: bool,
    start_minimized: bool,
    wallet_address: String,
    max_concurrent_jobs: u32,
    max_memory_percent: u32,
    pricing: PricingConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PricingConfig {
    gpu_hour_cents: u32,
    cpu_core_hour_cents: u32,
    memory_gb_hour_cents: u32,
    minimum_cents: u32,
}

impl Default for NodeSettings {
    fn default() -> Self {
        Self {
            orchestrator_url: "http://localhost:8080".to_string(),
            auto_start: false,
            start_minimized: false,
            wallet_address: String::new(),
            max_concurrent_jobs: 4,
            max_memory_percent: 80,
            pricing: PricingConfig {
                gpu_hour_cents: 50,
                cpu_core_hour_cents: 1,
                memory_gb_hour_cents: 1,
                minimum_cents: 1,
            },
        }
    }
}

#[derive(Debug, Clone, Serialize)]
struct NodeStatus {
    running: bool,
    pid: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
struct HardwareInfo {
    cpu: CpuInfo,
    memory: MemoryInfo,
    gpus: Vec<GpuInfo>,
    storage: StorageInfo,
    docker_version: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
struct CpuInfo {
    model: String,
    cores: u32,
    threads: u32,
}

#[derive(Debug, Clone, Serialize)]
struct MemoryInfo {
    total_mb: u64,
    available_mb: u64,
}

#[derive(Debug, Clone, Serialize)]
struct GpuInfo {
    model: String,
    vram_mb: u64,
    driver_version: String,
}

#[derive(Debug, Clone, Serialize)]
struct StorageInfo {
    total_gb: u64,
    available_gb: u64,
}

// ============ Commands ============

#[tauri::command]
fn get_node_status(node: State<NodeProcess>) -> NodeStatus {
    let guard = node.0.lock().unwrap();
    match &*guard {
        Some(child) => NodeStatus {
            running: true,
            pid: Some(child.id()),
        },
        None => NodeStatus {
            running: false,
            pid: None,
        },
    }
}

#[tauri::command]
async fn start_node(
    node: State<'_, NodeProcess>,
    orchestrator_url: String,
) -> Result<NodeStatus, String> {
    let mut guard = node.0.lock().unwrap();

    if guard.is_some() {
        return Err("Node is already running".to_string());
    }

    // Find the node-agent binary
    let node_binary = if cfg!(target_os = "windows") {
        "rhizos-node.exe"
    } else {
        "rhizos-node"
    };

    // Try to find the binary in various locations
    let binary_path = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.join(node_binary)))
        .filter(|p| p.exists())
        .or_else(|| {
            // Development path
            Some(std::path::PathBuf::from("../node-agent/target/release").join(node_binary))
        });

    let path = binary_path.ok_or("Could not find node-agent binary")?;

    let child = Command::new(&path)
        .args(["start", "--orchestrator", &orchestrator_url])
        .spawn()
        .map_err(|e| format!("Failed to start node: {}", e))?;

    let pid = child.id();
    *guard = Some(child);

    Ok(NodeStatus {
        running: true,
        pid: Some(pid),
    })
}

#[tauri::command]
async fn stop_node(node: State<'_, NodeProcess>) -> Result<NodeStatus, String> {
    let mut guard = node.0.lock().unwrap();

    if let Some(mut child) = guard.take() {
        child.kill().map_err(|e| format!("Failed to stop node: {}", e))?;
        child.wait().ok();
    }

    Ok(NodeStatus {
        running: false,
        pid: None,
    })
}

#[tauri::command]
async fn get_hardware_info() -> Result<HardwareInfo, String> {
    // Run the node-agent info command and parse output
    // For now, return mock data - real implementation would call the binary

    Ok(HardwareInfo {
        cpu: CpuInfo {
            model: "Unknown".to_string(),
            cores: num_cpus::get_physical() as u32,
            threads: num_cpus::get() as u32,
        },
        memory: MemoryInfo {
            total_mb: 0,
            available_mb: 0,
        },
        gpus: vec![],
        storage: StorageInfo {
            total_gb: 0,
            available_gb: 0,
        },
        docker_version: None,
    })
}

#[tauri::command]
fn get_settings() -> NodeSettings {
    // Load from config file
    load_settings().unwrap_or_default()
}

#[tauri::command]
fn save_settings(settings: NodeSettings) -> Result<(), String> {
    let config_dir = directories::ProjectDirs::from("com", "rhizos", "cloud")
        .ok_or("Could not determine config directory")?;

    let config_path = config_dir.config_dir().join("settings.json");
    std::fs::create_dir_all(config_dir.config_dir())
        .map_err(|e| format!("Failed to create config directory: {}", e))?;

    let json = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;

    std::fs::write(&config_path, json)
        .map_err(|e| format!("Failed to write settings: {}", e))?;

    Ok(())
}

fn load_settings() -> Option<NodeSettings> {
    let config_dir = directories::ProjectDirs::from("com", "rhizos", "cloud")?;
    let config_path = config_dir.config_dir().join("settings.json");

    let content = std::fs::read_to_string(&config_path).ok()?;
    serde_json::from_str(&content).ok()
}

// ============ Main ============

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(NodeProcess(Mutex::new(None)))
        .setup(|app| {
            // Create system tray
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let show = MenuItem::with_id(app, "show", "Show Window", true, None::<&str>)?;
            let start_node = MenuItem::with_id(app, "start_node", "Start Node", true, None::<&str>)?;
            let stop_node = MenuItem::with_id(app, "stop_node", "Stop Node", true, None::<&str>)?;

            let menu = Menu::with_items(app, &[&show, &start_node, &stop_node, &quit])?;

            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("RhizOS - Decentralized Compute")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        app.exit(0);
                    }
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_node_status,
            start_node,
            stop_node,
            get_hardware_info,
            get_settings,
            save_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
