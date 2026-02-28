use std::fs;
use std::path::Path;

use tauri::State;
use uuid::Uuid;

use super::git_github::create_github_workspace;
use super::git_local::create_local_workspace;
use super::model::{
    now_iso8601, CreateGitHubWorkspaceInput, CreateLocalWorkspaceInput, Workspace,
    WorkspaceSourceType, WorkspaceStatus,
};
use super::{WorkspaceError, WorkspaceState};

fn to_command_error(error: WorkspaceError) -> String {
    error.to_string()
}

fn next_workspace_id() -> String {
    format!("ws_{}", Uuid::new_v4().simple())
}

fn workspace_suffix(workspace_id: &str) -> &str {
    workspace_id
        .strip_prefix("ws_")
        .map(|value| &value[..4.min(value.len())])
        .unwrap_or("ws")
}

#[tauri::command]
pub fn workspace_list(state: State<'_, WorkspaceState>) -> Result<Vec<Workspace>, String> {
    let store = state.store.lock().map_err(|err| err.to_string())?;
    Ok(store.list())
}

#[tauri::command]
pub fn workspace_get_active_id(state: State<'_, WorkspaceState>) -> Result<Option<String>, String> {
    let store = state.store.lock().map_err(|err| err.to_string())?;
    Ok(store.active_workspace_id())
}

#[tauri::command]
pub fn workspace_set_active(id: String, state: State<'_, WorkspaceState>) -> Result<(), String> {
    let mut store = state.store.lock().map_err(|err| err.to_string())?;
    store.set_active(&id).map_err(to_command_error)?;
    store.save().map_err(to_command_error)?;
    Ok(())
}

#[tauri::command]
pub fn workspace_create_local(
    input: CreateLocalWorkspaceInput,
    state: State<'_, WorkspaceState>,
) -> Result<Workspace, String> {
    let workspace_id = next_workspace_id();
    let suffix = workspace_suffix(&workspace_id);
    let prepared = create_local_workspace(
        Path::new(&input.repo_path),
        &input.workspace_name,
        input.branch_name.clone(),
        input.base_ref.clone(),
        suffix,
        &state.app_data_dir.join("workspaces"),
    )
    .map_err(to_command_error)?;
    let timestamp = now_iso8601();
    let workspace = Workspace {
        id: workspace_id.clone(),
        name: input.workspace_name,
        source_type: WorkspaceSourceType::Local,
        source: input.repo_path,
        repo_root_path: prepared.repo_root_path,
        worktree_path: prepared.worktree_path,
        branch: prepared.branch,
        base_ref: Some(prepared.base_ref),
        status: WorkspaceStatus::Ready,
        created_at: timestamp.clone(),
        updated_at: timestamp,
        last_opened_at: None,
    };

    let mut store = state.store.lock().map_err(|err| err.to_string())?;
    store.insert(workspace.clone());
    store
        .set_active(&workspace.id)
        .map_err(to_command_error)?;
    store.save().map_err(to_command_error)?;

    Ok(workspace)
}

#[tauri::command]
pub fn workspace_create_github(
    input: CreateGitHubWorkspaceInput,
    state: State<'_, WorkspaceState>,
) -> Result<Workspace, String> {
    let workspace_id = next_workspace_id();
    let suffix = workspace_suffix(&workspace_id);
    let prepared = create_github_workspace(
        &input.repo_url,
        &input.workspace_name,
        input.branch_name.clone(),
        input.base_ref.clone(),
        suffix,
        &state.app_data_dir,
    )
    .map_err(to_command_error)?;
    let timestamp = now_iso8601();
    let workspace = Workspace {
        id: workspace_id.clone(),
        name: input.workspace_name,
        source_type: WorkspaceSourceType::Github,
        source: input.repo_url,
        repo_root_path: prepared.repo_root_path,
        worktree_path: prepared.worktree_path,
        branch: prepared.branch,
        base_ref: Some(prepared.base_ref),
        status: WorkspaceStatus::Ready,
        created_at: timestamp.clone(),
        updated_at: timestamp,
        last_opened_at: None,
    };

    let mut store = state.store.lock().map_err(|err| err.to_string())?;
    store.insert(workspace.clone());
    store
        .set_active(&workspace.id)
        .map_err(to_command_error)?;
    store.save().map_err(to_command_error)?;

    Ok(workspace)
}

#[tauri::command]
pub fn workspace_archive(id: String, state: State<'_, WorkspaceState>) -> Result<(), String> {
    let mut store = state.store.lock().map_err(|err| err.to_string())?;
    store.archive(&id).map_err(to_command_error)?;
    store.save().map_err(to_command_error)?;
    Ok(())
}

#[tauri::command]
pub fn workspace_delete(
    id: String,
    remove_files: bool,
    state: State<'_, WorkspaceState>,
) -> Result<(), String> {
    let mut store = state.store.lock().map_err(|err| err.to_string())?;
    let removed = store.remove(&id).map_err(to_command_error)?;
    store.save().map_err(to_command_error)?;
    drop(store);

    if remove_files {
        let path = Path::new(&removed.worktree_path);
        if path.exists() {
            fs::remove_dir_all(path).map_err(|err| err.to_string())?;
        }
    }

    Ok(())
}
