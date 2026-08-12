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
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 backdrop-blur-sm p-5 shadow-xl transition-all">
      {/* Top Bar Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-2.5">
            <Paperclip className="h-5 w-5 text-blue-400" />
          </div>

          <div>
            <h3 className="font-semibold text-slate-100">Task Attachments</h3>
            <p className="text-xs text-slate-400">
              Upload documents, media, or archives up to 25 MB.
            </p>
          </div>
        </div>

        <button
  type="button"
  onClick={handleChoose}
  disabled={uploading}
  className="inline-flex items-center gap-2 rounded-lg bg-[#dc9750] px-4 py-2 text-sm font-medium text-white transition-all hover:bg-[#c4803d] focus:outline-none focus:ring-2 focus:ring-[#dc9750]/40 disabled:cursor-not-allowed disabled:opacity-50 shadow-lg shadow-[#dc9750]/20"
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
            ? "border-blue-500 bg-blue-500/10"
            : "border-slate-800 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-800/30"
        }`}
      >
        <div className="flex flex-col items-center justify-center text-center">
          <div className="mb-3 rounded-full bg-slate-800/80 p-3 border border-slate-700/50">
            <FileUp
              className={`h-6 w-6 transition-colors ${
                isDragging ? "text-blue-400" : "text-slate-400"
              }`}
            />
          </div>

          <p className="text-sm font-medium text-slate-300">
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
                className="rounded-md bg-slate-800/80 border border-slate-700/60 px-2 py-0.5 text-[10px] font-semibold text-slate-400"
              >
                {type}
              </span>
            ))}
          </div>

          <p className="mt-3 text-[11px] text-slate-500">Maximum file size: 25 MB</p>
        </div>
      </div>
    </div>
  );
};

export default FileUpload;