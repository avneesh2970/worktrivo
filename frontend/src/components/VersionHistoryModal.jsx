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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-3xl rounded-xl bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">

          <div className="flex items-center gap-3">

            <History className="h-6 w-6 text-blue-600" />

            <div>

              <h2 className="text-lg font-semibold text-slate-800">
                Version History
              </h2>

              <p className="text-sm text-slate-500">
                {file?.displayName || file?.originalName}
              </p>

            </div>

          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>

        </div>

        {/* Body */}
        <div className="max-h-[500px] overflow-y-auto p-6">

          {loading ? (

            <div className="flex items-center justify-center py-12">

              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />

            </div>

          ) : versions.length === 0 ? (

            <div className="py-12 text-center">

              <FileText className="mx-auto h-10 w-10 text-slate-300" />

              <p className="mt-3 text-slate-500">
                No version history found.
              </p>

            </div>

          ) : (

            <div className="space-y-4">

              {versions.map((version) => {

                const isCurrent =
                  version.version === file.currentVersion;

                return (

                  <div
                    key={version._id}
                    className="rounded-xl border border-slate-200 p-4"
                  >

                    <div className="flex items-start justify-between">

                      <div>

                        <div className="flex items-center gap-3">

                          <h3 className="font-semibold text-slate-800">

                            Version {version.version}

                          </h3>

                          {isCurrent && (

                            <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">

                              Current

                            </span>

                          )}

                        </div>

                        <div className="mt-2 space-y-1 text-sm text-slate-500">

                          <p>

                            Uploaded by{" "}
                            <span className="font-medium text-slate-700">

                              {version.uploadedBy?.name || "Unknown"}

                            </span>

                          </p>

                          <p>

                            {new Date(
                              version.createdAt
                            ).toLocaleString()}

                          </p>

                          <p>

                            Size:{" "}
                            {(
                              version.size /
                              1024 /
                              1024
                            ).toFixed(2)}{" "}
                            MB

                          </p>

                          <p>

                            {version.changeLog ||
                              "No change description"}

                          </p>

                        </div>

                      </div>

                      {!isCurrent && (

                        <button
                          onClick={() =>
                            handleRestore(version._id)
                          }
                          disabled={restoring}
                          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
                        >

                          {restoring ? (

                            <>

                              <Loader2 className="h-4 w-4 animate-spin" />

                              Restoring...

                            </>

                          ) : (

                            <>

                              <RotateCcw className="h-4 w-4" />

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