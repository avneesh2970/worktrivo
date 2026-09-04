import React, { useEffect, useState } from "react";
import {
  X,
  History,
  RotateCcw,
  Loader2,
  FileText,
} from "lucide-react";

import { useFileApi } from "../services/fileApi";

const VersionHistoryModal = ({
  open,
  file,
  onClose,
  onRestore,
}) => {
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [versions, setVersions] = useState([]);

  const {
    getVersionHistory,
    restoreVersion,
  } = useFileApi();

  const fetchHistory = async () => {
    if (!file) return;

    try {
      setLoading(true);
      const res = await getVersionHistory(file._id);
      setVersions(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && file) {
      fetchHistory();
    }
  }, [open, file]);

  const handleRestore = async (versionId) => {
    const confirmRestore = window.confirm(
      "Restore this version?"
    );

    if (!confirmRestore) return;

    try {
      setRestoring(true);
      await restoreVersion(file._id, versionId);
      await fetchHistory();

      if (onRestore) {
        onRestore();
      }

      alert("Version restored successfully.");
    } catch (err) {
      console.error(err);
      alert(
        err?.response?.data?.message ||
          "Failed to restore version."
      );
    } finally {
      setRestoring(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Version History
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {file?.displayName || file?.originalName}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[500px] overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
            </div>
          ) : versions.length === 0 ? (
            <div className="py-12 text-center">
              <FileText className="mx-auto h-10 w-10 text-slate-400" />
              <p className="mt-3 text-sm font-medium text-slate-500">
                No version history found.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {versions.map((version) => {
                const isCurrent = version.version === file.currentVersion;

                return (
                  <div
                    key={version._id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-950/40"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                            Version {version.version}
                          </h3>
                          {isCurrent && (
                            <span className="rounded-md bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                              Current
                            </span>
                          )}
                        </div>

                        <div className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-400">
                          <p>
                            Uploaded by{" "}
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {version.uploadedBy?.name || "Unknown"}
                            </span>
                          </p>

                          <p>
                            {new Date(version.createdAt).toLocaleString()}
                          </p>

                          <p>
                            Size:{" "}
                            {(version.size / 1024 / 1024).toFixed(2)} MB
                          </p>

                          {version.changeLog && (
                            <p className="text-slate-500 italic">
                              {version.changeLog}
                            </p>
                          )}
                        </div>
                      </div>

                      {!isCurrent && (
                        <button
                          onClick={() => handleRestore(version._id)}
                          disabled={restoring}
                          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition shadow-sm"
                        >
                          {restoring ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              Restoring...
                            </>
                          ) : (
                            <>
                              <RotateCcw className="h-3.5 w-3.5" />
                              Restore
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VersionHistoryModal;