import React, { useRef, useState } from "react";
import { Upload, Loader2, Paperclip, FileUp } from "lucide-react";
import { useFileApi } from "../services/fileApi";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

const FileUpload = ({ taskId, onUpload }) => {
  const inputRef = useRef(null);
  const { uploadFile } = useFileApi();

  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleChoose = () => {
    inputRef.current?.click();
  };

  const processUpload = async (file) => {
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      alert("Maximum file size is 25 MB.");
      return;
    }

    try {
      setUploading(true);
      await uploadFile(taskId, file);
      if (onUpload) onUpload();
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || "Failed to upload file.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    processUpload(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    processUpload(file);
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition-all">
      {/* Top Bar Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-2.5">
            <Paperclip className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>

          <div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Task Attachments</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Upload documents, media, or archives up to 25 MB.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleChoose}
          disabled={uploading}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-50 shadow-md shadow-emerald-500/20"
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-white" />
              <span>Uploading...</span>
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              <span>Upload File</span>
            </>
          )}
        </button>
      </div>

      <input ref={inputRef} type="file" hidden onChange={handleFileChange} />

      {/* Drag & Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleChoose}
        className={`mt-4 cursor-pointer rounded-xl border-2 border-dashed p-6 transition-all ${
          isDragging
            ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20"
            : "border-slate-300 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 hover:border-emerald-500/60 dark:hover:border-slate-700 hover:bg-slate-100/50 dark:hover:bg-slate-800/30"
        }`}
      >
        <div className="flex flex-col items-center justify-center text-center">
          <div className="mb-3 rounded-full bg-white dark:bg-slate-800 p-3 border border-slate-200 dark:border-slate-700/50 shadow-sm">
            <FileUp
              className={`h-6 w-6 transition-colors ${
                isDragging ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400"
              }`}
            />
          </div>

          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Click or drag & drop files here to upload
          </p>

          <div className="mt-3 flex flex-wrap justify-center gap-1.5 max-w-md">
            {[
              "JPG",
              "PNG",
              "WEBP",
              "PDF",
              "DOCX",
              "XLSX",
              "PPTX",
              "ZIP",
              "TXT",
            ].map((type) => (
              <span
                key={type}
                className="rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-400"
              >
                {type}
              </span>
            ))}
          </div>

          <p className="mt-3 text-[11px] text-slate-400 dark:text-slate-500 font-medium">Maximum file size: 25 MB</p>
        </div>
      </div>
    </div>
  );
};

export default FileUpload;