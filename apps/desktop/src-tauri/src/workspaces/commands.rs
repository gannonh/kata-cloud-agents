use std::fs;
use std::path::Path;
use std::process::Command;

use serde::Serialize;
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

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitHubRepoOption {
    pub name_with_owner: String,
    pub url: String,
    pub is_private: bool,
    pub updated_at: String,
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct GitHubRepoListItem {
    name_with_owner: String,
    url: String,
    is_private: bool,
    updated_at: Option<String>,
}

fn normalize_search_tokens(query: &str) -> Vec<String> {
    query
        .split_whitespace()
        .map(|token| token.trim().to_lowercase())
        .filter(|token| !token.is_empty())
        .collect()
}

fn repo_match_score(repo: &GitHubRepoOption, query_tokens: &[String]) -> i32 {
    if query_tokens.is_empty() {
        return 1;
    }

    let name = repo.name_with_owner.to_lowercase();
    let url = repo.url.to_lowercase();
    let joined = format!("{name} {url}");

    if !query_tokens.iter().all(|token| joined.contains(token)) {
        return 0;
    }

    let mut score = 10;
    for token in query_tokens {
        if name == *token || url == *token {
            score += 150;
        } else if name.starts_with(token) {
            score += 80;
        } else if url.starts_with(token) {
            score += 60;
        } else if name.contains(token) {
            score += 30;
        } else if url.contains(token) {
            score += 20;
        }
    }
    score
}

#[tauri::command]
pub async fn workspace_list_github_repos(
    query: Option<String>,
) -> Result<Vec<GitHubRepoOption>, String> {
    tauri::async_runtime::spawn_blocking(move || workspace_list_github_repos_blocking(query))
        .await
        .map_err(|err| format!("Failed to load GitHub repositories: {err}"))?
}

fn workspace_list_github_repos_blocking(
    query: Option<String>,
) -> Result<Vec<GitHubRepoOption>, String> {
    let output = Command::new("gh")
        .args([
            "repo",
            "list",
            "--limit",
            "200",
            "--source",
            "--no-archived",
            "--json",
            "nameWithOwner,url,isPrivate,updatedAt",
        ])
        .output()
        .map_err(|_| {
            "GitHub CLI not found. Install gh and run `gh auth login` to use repository suggestions."
                .to_string()
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        if stderr.is_empty() {
            return Err(
                "Unable to load GitHub repositories. Ensure gh is authenticated with `gh auth login`."
                    .to_string(),
            );
        }
        return Err(format!("Unable to load GitHub repositories: {stderr}"));
    }

    let raw_items: Vec<GitHubRepoListItem> = serde_json::from_slice(&output.stdout).map_err(|err| {
        format!("Unable to parse GitHub repository list from gh output: {err}")
    })?;

    let mut repos: Vec<GitHubRepoOption> = raw_items
        .into_iter()
        .map(|item| GitHubRepoOption {
            name_with_owner: item.name_with_owner,
            url: item.url,
            is_private: item.is_private,
            updated_at: item.updated_at.unwrap_or_default(),
        })
        .collect();

    let normalized_tokens = query
        .as_deref()
        .map(normalize_search_tokens)
        .unwrap_or_default();

    repos.sort_by(|left, right| {
        let left_score = repo_match_score(left, &normalized_tokens);
        let right_score = repo_match_score(right, &normalized_tokens);

        right_score
            .cmp(&left_score)
            .then_with(|| right.updated_at.cmp(&left.updated_at))
            .then_with(|| left.name_with_owner.cmp(&right.name_with_owner))
    });

    repos.retain(|repo| repo_match_score(repo, &normalized_tokens) > 0);
    repos.truncate(20);
    Ok(repos)
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
        input.clone_root_path.clone(),
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
pub fn workspace_pick_directory(default_path: Option<String>) -> Result<Option<String>, String> {
    let mut dialog = rfd::FileDialog::new();

    if let Some(path) = default_path.filter(|value| !value.trim().is_empty()) {
        dialog = dialog.set_directory(Path::new(&path));
    }

    let selected = dialog.pick_folder();
    Ok(selected.map(|path| path.to_string_lossy().to_string()))
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
