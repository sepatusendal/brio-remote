import { useEffect, useRef, useState } from "react";

function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(unixSeconds) {
    if (!unixSeconds) return "";
    return new Date(unixSeconds * 1000).toLocaleDateString();
}

function joinPath(dir, name) {
    if (dir.endsWith("/")) return dir + name;
    return `${dir}/${name}`;
}

function parentPath(dir) {
    const trimmed = dir.replace(/\/+$/, "");
    const idx = trimmed.lastIndexOf("/");
    if (idx <= 0) return "/";
    return trimmed.slice(0, idx);
}

export default function FileManager({
    fileList,
    fileTransfer,
    requestFilesList,
    downloadFile,
    uploadFile,
    deleteFile,
    renameFile,
    makeDirectory,
}) {

    const [renaming, setRenaming] = useState(null); // path being renamed
    const [renameValue, setRenameValue] = useState("");
    const fileInputRef = useRef(null);

    useEffect(() => {
        requestFilesList("");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function refresh() {
        requestFilesList(fileList?.path || "");
    }

    function openDir(entry) {
        requestFilesList(joinPath(fileList.path, entry.name));
    }

    function goUp() {
        if (!fileList) return;
        requestFilesList(parentPath(fileList.path));
    }

    function handleUploadClick() {
        fileInputRef.current?.click();
    }

    function handleFileChosen(e) {
        const file = e.target.files?.[0];
        if (file && fileList) {
            uploadFile(joinPath(fileList.path, file.name), file);
        }
        e.target.value = "";
    }

    function handleDelete(entry) {
        if (!fileList) return;
        const ok = window.confirm(`Delete ${entry.name}? ${entry.isDir ? "This removes the whole folder." : ""}`);
        if (!ok) return;
        deleteFile(joinPath(fileList.path, entry.name));
        setTimeout(refresh, 400);
    }

    function startRename(entry) {
        setRenaming(entry.name);
        setRenameValue(entry.name);
    }

    function submitRename(entry) {
        if (renameValue && renameValue !== entry.name) {
            renameFile(joinPath(fileList.path, entry.name), renameValue);
            setTimeout(refresh, 400);
        }
        setRenaming(null);
    }

    function handleNewFolder() {
        const name = window.prompt("Folder name?");
        if (name && fileList) {
            makeDirectory(fileList.path, name);
            setTimeout(refresh, 400);
        }
    }

    return (
        <div className="file-manager">

            <div className="file-manager__toolbar">
                <button className="cc-action" onClick={goUp} disabled={!fileList}>↑ Up</button>
                <code className="file-manager__path">{fileList?.path || "loading..."}</code>
                <div className="file-manager__actions">
                    <button className="cc-action" onClick={handleNewFolder} disabled={!fileList}>+ Folder</button>
                    <button className="cc-action" onClick={handleUploadClick} disabled={!fileList}>↑ Upload</button>
                    <button className="cc-action" onClick={refresh}>↻</button>
                </div>
                <input ref={fileInputRef} type="file" hidden onChange={handleFileChosen} />
            </div>

            {fileTransfer && (
                <div className="banner banner--caution">
                    <span className="pulse-dot pulse-dot--caution pulse-dot--live" style={{ "--pulse-duration": "0.8s" }} />
                    {fileTransfer.kind === "download" ? "Downloading" : "Uploading"} {fileTransfer.name}...
                </div>
            )}

            {!fileList ? (
                <p className="cc-panel__hint">Loading files...</p>
            ) : fileList.entries.length === 0 ? (
                <p className="cc-panel__hint">This folder is empty.</p>
            ) : (
                <table className="process-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Size</th>
                            <th>Modified</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {fileList.entries.map((entry) => (
                            <tr key={entry.name}>
                                <td
                                    className={`process-table__name ${entry.isDir ? "file-manager__dir" : ""}`}
                                    onClick={() => entry.isDir && openDir(entry)}
                                >
                                    {entry.isDir ? "📁" : "📄"}{" "}
                                    {renaming === entry.name ? (
                                        <input
                                            className="file-manager__rename-input"
                                            autoFocus
                                            value={renameValue}
                                            onChange={(e) => setRenameValue(e.target.value)}
                                            onBlur={() => submitRename(entry)}
                                            onKeyDown={(e) => e.key === "Enter" && submitRename(entry)}
                                        />
                                    ) : (
                                        entry.name
                                    )}
                                </td>
                                <td className="process-table__mono">{entry.isDir ? "—" : formatSize(entry.size)}</td>
                                <td className="process-table__mono">{formatDate(entry.modTime)}</td>
                                <td className="file-manager__row-actions">
                                    {!entry.isDir && (
                                        <button
                                            className="cc-action"
                                            onClick={() => downloadFile(joinPath(fileList.path, entry.name))}
                                        >
                                            ↓
                                        </button>
                                    )}
                                    <button className="cc-action" onClick={() => startRename(entry)}>✎</button>
                                    <button className="process-table__kill" onClick={() => handleDelete(entry)}>Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

        </div>
    );
}
