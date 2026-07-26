"use client";

import { useState } from "react";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setStatus(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${API_BASE_URL}/api/upload-csv`, {
        method: "POST",
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(data.message || "CSV dataset uploaded and compiled into historical model data successfully.");
      } else {
        setStatus("Failed to upload dataset. Check CSV format requirements.");
      }
    } catch (err) {
      console.error(err);
      setStatus("Error uploading file to server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1200px] mx-auto w-full">
      
      {/* Header Banner */}
      <div className="glass-panel p-6 bg-white flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-widest mb-1">
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Dataset Management
          </div>
          <h1 className="font-serif text-3xl font-extrabold text-slate-900 tracking-tight">Upload Historical Runs</h1>
        </div>
      </div>

      <div className="glass-panel p-8 bg-white space-y-6">
        <div className="border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center hover:border-blue-500 transition-colors bg-slate-50/50">
          <Upload className="w-12 h-12 text-blue-600 mx-auto mb-4" />
          <h3 className="font-serif font-bold text-slate-900 text-lg mb-1">Select CSV Dataset</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-6">
            Upload custom grade change telemetry logs (`historical.csv`) containing speed, steam, flow, moisture, and stabilization metrics.
          </p>

          <input 
            type="file" 
            accept=".csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="hidden"
            id="csv-input"
          />

          <label 
            htmlFor="csv-input"
            className="px-6 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl font-bold text-sm shadow-xs transition cursor-pointer inline-block"
          >
            {file ? file.name : "Choose CSV File"}
          </label>
        </div>

        {file && (
          <button
            onClick={handleUpload}
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-md shadow-blue-500/20 transition cursor-pointer flex items-center justify-center gap-2"
          >
            {loading ? "Processing Dataset..." : "Ingest & Retrain Model Engine"}
          </button>
        )}

        {status && (
          <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
            {status}
          </div>
        )}
      </div>

    </div>
  );
}
