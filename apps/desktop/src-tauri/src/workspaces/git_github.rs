use std::fs;
use std::path::Path;
use std::process::Command;

use url::Url;

use super::git_local::create_local_workspace;
use super::model::PreparedWorkspace;
use super::WorkspaceError;

pub fn create_github_workspace(
    repo_url: &str,
    workspace_name: &str,
    clone_root_path: Option<String>,
    branch_name: Option<String>,
    base_ref: Option<String>,
    suffix: &str,
    app_data_dir: &Path,
) -> Result<PreparedWorkspace, WorkspaceError> {
    let (owner, repo) = parse_github_repo_url(repo_url)?;
    let cache_repo_path = clone_root_path
        .filter(|value| !value.trim().is_empty())
        .map(|value| Path::new(&value).join(&repo))
        .unwrap_or_else(|| {
            app_data_dir
                .join("repo-cache")
                .join("github")
                .join(format!("{owner}__{repo}"))
        });

    if cache_repo_path.exists() {
        run_git_in_dir(&cache_repo_path, &["fetch", "--all", "--prune"])?;
    } else {
        if let Some(parent) = cache_repo_path.parent() {
            fs::create_dir_all(parent)?;
        }
        run_git_in_dir(
            app_data_dir,
            &[
                "clone",
                repo_url,
                cache_repo_path.to_string_lossy().as_ref(),
            ],
        )?;
    }

    let workspaces_root = app_data_dir.join("workspaces");
    create_local_workspace(
        &cache_repo_path,
        workspace_name,
        branch_name,
        base_ref,
        suffix,
        &workspaces_root,
    )
}

fn parse_github_repo_url(repo_url: &str) -> Result<(String, String), WorkspaceError> {
    let parsed = Url::parse(repo_url).map_err(|_| {
        WorkspaceError::InvalidInput(
            "Only https://github.com/<owner>/<repo> repositories are supported".to_string(),
        )
    })?;

    if parsed.scheme() != "https" || parsed.host_str() != Some("github.com") {
        return Err(WorkspaceError::InvalidInput(
            "Only github.com repositories are supported".to_string(),
        ));
    }

    let mut segments = parsed.path_segments().ok_or_else(|| {
        WorkspaceError::InvalidInput("Invalid github repository URL".to_string())
    })?;

    let owner = segments
        .next()
        .filter(|segment| !segment.is_empty())
        .ok_or_else(|| WorkspaceError::InvalidInput("Invalid github repository URL".to_string()))?;
    let repo = segments
        .next()
        .filter(|segment| !segment.is_empty())
        .ok_or_else(|| WorkspaceError::InvalidInput("Invalid github repository URL".to_string()))?;

    let repo_name = repo.strip_suffix(".git").unwrap_or(repo).to_string();
    Ok((owner.to_string(), repo_name))
}

fn run_git_in_dir(cwd: &Path, args: &[&str]) -> Result<String, WorkspaceError> {
    let output = Command::new("git").current_dir(cwd).args(args).output()?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        Err(WorkspaceError::GitFailed(format!(
            "git {} failed: {}",
            args.join(" "),
            String::from_utf8_lossy(&output.stderr).trim()
        )))
    }
}

#[cfg(test)]
mod tests {
    use super::create_github_workspace;

    #[test]
    fn rejects_non_github_remote_urls() {
        let app_data_dir = tempfile::tempdir().unwrap();
        let err = create_github_workspace(
            "https://gitlab.com/org/repo",
            "KAT-154",
            None,
            None,
            None,
            "ab12",
            app_data_dir.path(),
        )
        .unwrap_err();
        assert!(err.to_string().contains("github.com"));
    }
}
