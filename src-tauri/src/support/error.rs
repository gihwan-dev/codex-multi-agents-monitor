use std::io;

pub(crate) fn map_sqlite_error(error: rusqlite::Error) -> io::Error {
    io::Error::other(error)
}
