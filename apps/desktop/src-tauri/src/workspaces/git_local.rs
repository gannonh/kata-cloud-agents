use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use super::model::{derive_workspace_branch_name, slugify_name, PreparedWorkspace};
use super::WorkspaceError;

pub fn create_local_workspace(
    repo_path: &Path,
    workspace_name: &str,
    branch_name: Option<String>,
    base_ref: Option<String>,
    suffix: &str,
    workspaces_root: &Path,
) -> Result<PreparedWorkspace, WorkspaceError> {
    if workspace_name.trim().is_empty() {
        return Err(WorkspaceError::InvalidInput(
            "Workspace name must not be empty".to_string(),
        ));
    }
    if !repo_path.exists() {
        return Err(WorkspaceError::InvalidInput(format!(
            "Repository path does not exist: {}",
            repo_path.display()
        )));
    }

    let repo_root_path = canonicalize_path(repo_path)?;
    verify_git_repo(repo_path)?;

    let branch = branch_name
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| derive_workspace_branch_name(workspace_name, suffix));
    if branch == "main" || branch == "master" {
        return Err(WorkspaceError::InvalidInput(
            "Workspace branch cannot be main/master".to_string(),
        ));
    }

    if branch_exists(repo_path, &branch)? {
        return Err(WorkspaceError::InvalidInput(format!(
            "Branch already exists: {branch}"
        )));
    }

    let resolved_base_ref = base_ref
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| detect_default_base_ref(repo_path).unwrap_or_else(|_| "HEAD".to_string()));

    let worktree_path = workspaces_root.join(format!("{}-{}", slugify_name(workspace_name), suffix));
    if worktree_path.exists() {
        return Err(WorkspaceError::InvalidInput(format!(
            "Worktree path already exists: {}",
            worktree_path.display()
        )));
    }
    fs::create_dir_all(workspaces_root)?;

    run_git(
        repo_path,
        &[
            "worktree",
            "add",
            worktree_path.to_string_lossy().as_ref(),
            "-b",
            &branch,
            &resolved_base_ref,
        ],
    )?;

    Ok(PreparedWorkspace {
        repo_root_path,
        worktree_path: canonicalize_path(&worktree_path)?,
        branch,
        base_ref: resolved_base_ref,
    })
}

fn verify_git_repo(repo_path: &Path) -> Result<(), WorkspaceError> {
    run_git(repo_path, &["rev-parse", "--is-inside-work-tree"]).map(|_| ())
}

fn branch_exists(repo_path: &Path, branch: &str) -> Result<bool, WorkspaceError> {
    let output = Command::new("git")
        .arg("-C")
        .arg(repo_path)
        .arg("show-ref")
        .arg("--verify")
        .arg("--quiet")
        .arg(format!("refs/heads/{branch}"))
        .output()?;
    if output.status.success() {
        return Ok(true);
    }
    if output.status.code() == Some(1) {
        return Ok(false);
    }
    Err(WorkspaceError::GitFailed(format!(
        "Failed to check branch existence: {}",
        String::from_utf8_lossy(&output.stderr)
    )))
}

fn detect_default_base_ref(repo_path: &Path) -> Result<String, WorkspaceError> {
    if let Ok(remote_head) = run_git(repo_path, &["symbolic-ref", "--short", "refs/remotes/origin/HEAD"]) {
        if !remote_head.trim().is_empty() {
            return Ok(remote_head);
        }
    }

    let local_head = run_git(repo_path, &["branch", "--show-current"])?;
    if !local_head.trim().is_empty() {
        return Ok(local_head);
    }

    Ok("HEAD".to_string())
}

fn run_git(repo_path: &Path, args: &[&str]) -> Result<String, WorkspaceError> {
    let output = Command::new("git")
        .arg("-C")
        .arg(repo_path)
        .args(args)
        .output()?;

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

fn canonicalize_path(path: &Path) -> Result<String, WorkspaceError> {
    let canonicalized = PathBuf::from(path).canonicalize()?;
    Ok(canonicalized.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::Path;
    use std::process::Command;

    use tempfile::TempDir;

    use super::create_local_workspace;

    struct LocalRepoFixture {
        _tmpdir: TempDir,
        repo_path: std::path::PathBuf,
    }

    impl LocalRepoFixture {
        fn new() -> Self {
            let tmpdir = tempfile::tempdir().unwrap();
            let repo_path = tmpdir.path().join("repo");
            fs::create_dir_all(&repo_path).unwrap();

            run_git_raw(
                &repo_path,
                &["init"],
            );
            run_git_raw(&repo_path, &["checkout", "-B", "main"]);
            fs::write(repo_path.join("README.md"), "# fixture\n").unwrap();
            run_git_raw(&repo_path, &["add", "."]);
            run_git_with_identity(&repo_path, &["commit", "-m", "initial"]);

            Self {
                _tmpdir: tmpdir,
                repo_path,
            }
        }
    }

    fn run_git_raw(repo_path: &Path, args: &[&str]) {
        let status = Command::new("git")
            .arg("-C")
            .arg(repo_path)
            .args(args)
            .status()
            .unwrap();
        assert!(status.success(), "git {:?} failed", args);
    }

    fn run_git_with_identity(repo_path: &Path, args: &[&str]) {
        let status = Command::new("git")
            .arg("-C")
            .arg(repo_path)
            .arg("-c")
            .arg("user.name=Kata Test")
            .arg("-c")
            .arg("user.email=kata@example.com")
            .args(args)
            .status()
            .unwrap();
        assert!(status.success(), "git {:?} failed", args);
    }

    #[test]
    fn creates_local_workspace_in_separate_worktree_path() {
        let fixture = LocalRepoFixture::new();
        let workspaces_root = fixture.repo_path.join("workspaces");
        let created = create_local_workspace(
            &fixture.repo_path,
            "KAT-154",
            None,
            None,
            "ab12",
            &workspaces_root,
        )
        .unwrap();

        assert!(created.worktree_path.contains("workspaces"));
        assert_ne!(created.worktree_path, created.repo_root_path);
    }

    #[test]
    fn rejects_main_or_master_branch_creation() {
        let fixture = LocalRepoFixture::new();
        let workspaces_root = fixture.repo_path.join("workspaces");
        let err = create_local_workspace(
            &fixture.repo_path,
            "KAT-154",
            Some("main".into()),
            None,
            "ab12",
            &workspaces_root,
        )
        .unwrap_err();

        assert!(err.to_string().contains("main/master"));
    }
}
