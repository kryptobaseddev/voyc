import React, { useEffect, useState } from "react";
import { Check, Download, Loader2 } from "lucide-react";
import { useModelStore } from "@/stores/modelStore";

interface CompleteStepProps {
  onComplete: () => void;
}

const CompleteStep: React.FC<CompleteStepProps> = ({ onComplete }) => {
  const { downloadingModels, extractingModels, downloadProgress, hasAnyModels } =
    useModelStore();

  const [showSuccess, setShowSuccess] = useState(false);

  const isDownloading = downloadingModels.size > 0;
  const isExtracting = extractingModels.size > 0;
  const isProcessing = isDownloading || isExtracting;

  // Get download progress for display
  const activeDownload = Array.from(downloadingModels)[0];
  const progress = activeDownload
    ? downloadProgress.get(activeDownload)
    : undefined;

  // Show success animation briefly when processing completes
  useEffect(() => {
    if (!isProcessing && hasAnyModels && !showSuccess) {
      setShowSuccess(true);
      const timer = setTimeout(() => {
        onComplete();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isProcessing, hasAnyModels, showSuccess, onComplete]);

  // If already done (model downloaded), show success immediately
  useEffect(() => {
    if (hasAnyModels && !isProcessing) {
      setShowSuccess(true);
      const timer = setTimeout(() => {
        onComplete();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  if (showSuccess && !isProcessing) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-6">
        <div className="p-4 rounded-full bg-emerald-500/20 animate-in zoom-in-50 duration-300">
          <Check className="w-12 h-12 text-emerald-400" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold text-text mb-2">
            You're all set!
          </h2>
          <p className="text-text/70">Voyc is ready for voice dictation.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 gap-6">
      {/* Processing indicator */}
      <div className="p-4 rounded-full bg-logo-primary/20">
        {isExtracting ? (
          <Loader2 className="w-12 h-12 text-logo-primary animate-spin" />
        ) : (
          <Download className="w-12 h-12 text-logo-primary animate-pulse" />
        )}
      </div>

      <div className="text-center">
        <h2 className="text-xl font-semibold text-text mb-2">
          {isExtracting ? "Extracting model..." : "Downloading model..."}
        </h2>
        <p className="text-text/70">
          {isExtracting
            ? "Setting up your speech recognition model."
            : "This may take a few minutes depending on your connection."}
        </p>
      </div>

      {/* Progress bar */}
      {progress && isDownloading && (
        <div className="w-full max-w-xs">
          <div className="flex justify-between text-xs text-text/60 mb-1">
            <span>Downloading</span>
            <span>{progress.percentage.toFixed(0)}%</span>
          </div>
          <div className="w-full h-2 bg-mid-gray/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-logo-primary rounded-full transition-all duration-300"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
          <div className="text-xs text-text/50 mt-1 text-center">
            {formatBytes(progress.downloaded)} / {formatBytes(progress.total)}
          </div>
        </div>
      )}

      {isExtracting && (
        <div className="w-full max-w-xs">
          <div className="w-full h-2 bg-mid-gray/20 rounded-full overflow-hidden">
            <div className="h-full bg-logo-primary rounded-full animate-pulse w-full" />
          </div>
        </div>
      )}
    </div>
  );
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export default CompleteStep;
