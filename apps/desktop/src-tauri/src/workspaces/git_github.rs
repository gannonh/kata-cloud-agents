use std::fs;
use std::path::Path;
use std::process::Command;

use url::Url;

use super::git_local::create_local_workspace;
use super::model::PreparedWorkspace;
use super::WorkspaceError;

pub struct CreatedGitHubWorkspace {
    pub prepared: PreparedWorkspace,
    pub repo_url: String,
}

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
        .map(|value| Path::new(&value).join(format!("{owner}__{repo}")))
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

pub fn create_new_github_workspace(
    repository_name: &str,
    workspace_name: &str,
    clone_root_path: Option<String>,
    branch_name: Option<String>,
    base_ref: Option<String>,
    suffix: &str,
    app_data_dir: &Path,
) -> Result<CreatedGitHubWorkspace, WorkspaceError> {
    let clone_root = clone_root_path
        .filter(|value| !value.trim().is_empty())
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|| app_data_dir.join("repo-cache").join("github-created"));
    fs::create_dir_all(&clone_root)?;

    let (owner_override, repo) = split_repository_name(repository_name)?;
    let owner = match owner_override {
        Some(owner) => owner,
        None => gh_authenticated_owner(&clone_root)?,
    };
    let repo_identifier = format!("{owner}/{repo}");
    let repo_url = format!("https://github.com/{repo_identifier}");

    let clone_destination = clone_root.join(&repo);
    if clone_destination.exists() {
        return Err(WorkspaceError::InvalidInput(format!(
            "Clone destination already exists: {}",
            clone_destination.display()
        )));
    }

    run_gh(
        &clone_root,
        &[
            "repo",
            "create",
            &repo_identifier,
            "--private",
            "--clone",
            "--add-readme",
        ],
    )?;

    let workspaces_root = app_data_dir.join("workspaces");
    let prepared = create_local_workspace(
        &clone_destination,
        workspace_name,
        branch_name,
        base_ref,
        suffix,
        &workspaces_root,
    )?;

    Ok(CreatedGitHubWorkspace { prepared, repo_url })
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

fn gh_authenticated_owner(cwd: &Path) -> Result<String, WorkspaceError> {
    let login = run_gh(cwd, &["api", "user", "--jq", ".login"])?;
    let owner = login.trim();
    if owner.is_empty() {
        return Err(WorkspaceError::InvalidInput(
            "Unable to determine authenticated GitHub user. Run `gh auth login` and try again."
                .to_string(),
        ));
    }
    Ok(owner.to_string())
}

fn split_repository_name(repository_name: &str) -> Result<(Option<String>, String), WorkspaceError> {
    let normalized = repository_name.trim().trim_end_matches(".git");
    if normalized.is_empty() {
        return Err(WorkspaceError::InvalidInput(
            "Repository name is required".to_string(),
        ));
    }

    let segments = normalized
        .split('/')
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .collect::<Vec<_>>();

    match segments.as_slice() {
        [repo] => Ok((None, (*repo).to_string())),
        [owner, repo] => Ok((Some((*owner).to_string()), (*repo).to_string())),
        _ => Err(WorkspaceError::InvalidInput(
            "Repository name must be \"<name>\" or \"<owner>/<name>\"".to_string(),
        )),
    }
}

fn run_gh(cwd: &Path, args: &[&str]) -> Result<String, WorkspaceError> {
    let output = Command::new("gh")
        .current_dir(cwd)
        .args(args)
        .output()
        .map_err(|error| {
            if error.kind() == std::io::ErrorKind::NotFound {
                WorkspaceError::InvalidInput(
                    "GitHub CLI not found. Install gh and run `gh auth login`.".to_string(),
                )
            } else {
                WorkspaceError::Io(error)
            }
        })?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        if stderr.is_empty() {
            Err(WorkspaceError::GitFailed(format!(
                "gh {} failed",
                args.join(" ")
            )))
        } else {
            Err(WorkspaceError::GitFailed(stderr))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{create_github_workspace, split_repository_name};

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

    #[test]
    fn parses_repository_name_with_optional_owner() {
        let without_owner = split_repository_name("kat-154-created").unwrap();
        assert_eq!(without_owner.0, None);
        assert_eq!(without_owner.1, "kat-154-created".to_string());

        let with_owner = split_repository_name("kata-sh/kat-154-created.git").unwrap();
        assert_eq!(with_owner.0, Some("kata-sh".to_string()));
        assert_eq!(with_owner.1, "kat-154-created".to_string());
    }

    #[test]
    fn rejects_invalid_repository_name_shapes() {
        let err = split_repository_name("owner/repo/extra").unwrap_err();
        assert!(err.to_string().contains("<owner>/<name>"));
    }
}
