use std::path::PathBuf;
use std::sync::Mutex;

pub mod commands;
pub mod git_github;
pub mod git_local;
pub mod model;
pub mod store;

pub use store::WorkspaceStore;

#[derive(Debug, thiserror::Error)]
pub enum WorkspaceError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Serialization error: {0}")]
    Serde(#[from] serde_json::Error),
    #[error("{0}")]
    InvalidInput(String),
    #[error("{0}")]
    NotFound(String),
    #[error("{0}")]
    GitFailed(String),
}

pub struct WorkspaceState {
    pub app_data_dir: PathBuf,
    pub store: Mutex<WorkspaceStore>,
}

impl WorkspaceState {
    pub fn new(app_data_dir: PathBuf) -> Result<Self, WorkspaceError> {
        let store = WorkspaceStore::load(&app_data_dir)?;
        Ok(Self {
            app_data_dir,
            store: Mutex::new(store),
        })
    }
}
