use crate::infrastructure::filesystem::normalize_path;
use std::{
    fs, io,
    path::{Path, PathBuf},
};

pub(crate) fn resolve_linked_git_dir(git_metadata_path: &Path) -> io::Result<PathBuf> {
    let git_file = fs::read_to_string(git_metadata_path)?;
    let git_dir_value = git_file
        .lines()
        .next()
        .map(str::trim)
        .and_then(|line| line.strip_prefix("gitdir:"))
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "invalid gitdir file"))?;

    let git_metadata_parent = git_metadata_path.parent().ok_or_else(|| {
        io::Error::new(
            io::ErrorKind::InvalidData,
            "gitdir metadata path has no parent directory",
        )
    })?;

    normalize_path(&git_metadata_parent.join(git_dir_value))
}

pub(crate) fn resolve_common_dir(git_dir: &Path) -> io::Result<PathBuf> {
    let commondir_path = git_dir.join("commondir");
    let commondir_contents = fs::read_to_string(&commondir_path)?;
    let commondir_value = commondir_contents
        .lines()
        .next()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "invalid commondir file"))?;

    normalize_path(&git_dir.join(commondir_value))
}
