import React, { useEffect, useState } from "react";
import {
  File,
  FileText,
  Image,
  FileSpreadsheet,
  FileArchive,
  FileCode,
  Trash2,
  Eye,
  History,
  Loader2,
  User,
  Clock,
  HardDrive,
} from "lucide-react";

import { useFileApi } from "../services/fileApi";
import VersionHistoryModal from "./VersionHistoryModal";
import { API_BASE } from "../context/AuthContext";

// Enhanced icon picker with distinct dark-theme visual styles
const getFileIconConfig = (mimeType) => {
  if (!mimeType) return { icon: File, color: "text-slate-400", bg: "bg-slate-800" };

  if (mimeType.startsWith("image/"))
    return { icon: Image, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" };

  if (mimeType.includes("pdf"))
    return { icon: FileText, color: "text-rose-400", bg: "bg-rose-500/10 border-rose-500/20" };

  if (mimeType.includes("excel") || mimeType.includes("spreadsheet"))
    return { icon: FileSpreadsheet, color: "text-teal-400", bg: "bg-teal-500/10 border-teal-500/20" };

  if (mimeType.includes("zip") || mimeType.includes("compressed"))
    return { icon: FileArchive, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" };

  if (
    mimeType.includes("json") ||
    mimeType.includes("javascript") ||
    mimeType.includes("text")
  )
    return { icon: FileCode, color: "text-indigo-400", bg: "bg-indigo-500/10 border-indigo-500/20" };

  return { icon: File, color: "text-slate-400", bg: "bg-slate-800 border-slate-700" };
};

const formatSize = (bytes) => {
  if (!bytes) return "0 KB";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
};

// --- FIXED HELPER: Replaces Windows backslashes ---
const getFileUrl = (filePath) => {
    if (!filePath) return '#';
    
    // If it's already a full URL or base64, return as is
    if (filePath.startsWith('http') || filePath.startsWith('data:')) return filePath;
    
    // FIX: Convert Windows backslashes to forward slashes
    const normalizedPath = filePath.replace(/\\/g, '/');
    
    // Attach the backend base URL (removing /api from the end if present)
    const baseUrl = API_BASE.replace(/\/api$/, '');
    return normalizedPath.startsWith('/') ? `${baseUrl}${normalizedPath}` : `${baseUrl}/${normalizedPath}`;
};

const FileList = ({ taskId, refresh, onDelete }) => {
  const { getTaskFiles, deleteFile } = useFileApi();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const res = await getTaskFiles(taskId);
      setFiles(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (taskId) {
      fetchFiles();
    }
  }, [taskId, refresh]);

  const handleDelete = async (fileId) => {
    const confirmDelete = window.confirm("Delete this file?");
    if (!confirmDelete) return;

    try {
      await deleteFile(fileId);
      fetchFiles();
      if (onDelete) onDelete();
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || "Failed to delete file.");
    }
  };

  const handleHistory = (file) => {
    setSelectedFile(file);
    setHistoryOpen(true);
  };

  const closeHistory = () => {
    setSelectedFile(null);
    setHistoryOpen(false);
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm p-8 shadow-lg">
        <div className="flex items-center justify-center gap-3 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
          <span className="text-sm font-medium">Loading attachments...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 backdrop-blur-sm shadow-xl overflow-hidden">
        {/* Header */}
        <div className="border-b border-slate-800/80 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-100 flex items-center gap-2">
              Attached Files
            </h3>
            <p className="mt-0.5 text-xs text-slate-400">
              {files.length} {files.length === 1 ? "file" : "files"} attached to this task
            </p>
          </div>
          <span className="rounded-full bg-slate-800 border border-slate-700/60 px-3 py-1 text-xs font-semibold text-slate-300">
            {files.length}
          </span>
        </div>

        {/* File Container */}
        {files.length === 0 ? (
          <div className="py-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-800/60 border border-slate-700/50">
              <File className="h-6 w-6 text-slate-500" />
            </div>
            <p className="mt-3 text-sm font-medium text-slate-400">
              No files uploaded yet.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Upload attachments using the section above.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {files.map((file) => {
              const { icon: Icon, color, bg } = getFileIconConfig(file.mimeType);

              return (
                <div
                  key={file._id}
                  className="group flex items-center justify-between p-4 hover:bg-slate-800/40 transition duration-150 ease-in-out"
                >
                  <div className="flex items-center gap-4 min-w-0 pr-4">
                    {/* Icon Badge */}
                    <div className={`rounded-xl border p-3 flex-shrink-0 ${bg}`}>
                      <Icon className={`h-6 w-6 ${color}`} />
                    </div>

                    {/* Meta info */}
                    <div className="min-w-0">
                      <h4 className="font-medium text-slate-200 text-sm truncate max-w-md group-hover:text-blue-400 transition-colors">
                        {file.displayName || file.originalName}
                      </h4>

                      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <HardDrive className="h-3 w-3 text-slate-500" />
                          {formatSize(file.size)}
                        </span>

                        <span className="inline-flex items-center rounded-md bg-blue-500/10 px-2 py-0.5 font-medium text-blue-400 border border-blue-500/20">
                          v{file.currentVersion || 1}
                        </span>

                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3 text-slate-500" />
                          {file.uploadedBy?.name || "Unknown"}
                        </span>

                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-slate-500" />
                          {new Date(file.createdAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    
                    {/* --- FIXED VIEW BUTTON (Uses getFileUrl helper) --- */}
                    <button
                      onClick={() => window.open(getFileUrl(file.secureUrl), '_blank')}
                      className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-blue-400 border border-transparent hover:border-slate-700 transition"
                      title="Open File"
                    >
                      <Eye className="h-4 w-4" />
                    </button>

                    <button
                      onClick={() => handleHistory(file)}
                      className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-amber-400 border border-transparent hover:border-slate-700 transition"
                      title="Version History"
                    >
                      <History className="h-4 w-4" />
                    </button>

                    <button
                      onClick={() => handleDelete(file._id)}
                      className="rounded-lg p-2 text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 border border-transparent hover:border-rose-500/20 transition"
                      title="Delete File"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <VersionHistoryModal
        open={historyOpen}
        file={selectedFile}
        onClose={closeHistory}
        onRestore={() => {
          fetchFiles();
          if (onDelete) onDelete();
        }}
      />
    </>
  );
};

export default FileList;