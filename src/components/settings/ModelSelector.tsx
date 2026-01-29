/**
 * Model Selector Component for Voyc
 * Displays available models with download/delete/select functionality
 * Adapted from Handy's model management patterns
 */

import React from "react";
import { SettingContainer } from "../ui/SettingContainer";
import { Button } from "../ui/Button";
import { useModelStore, type ModelInfo } from "../../stores/modelStore";

interface ModelSelectorProps {
  grouped?: boolean;
}

// Format bytes to human-readable string
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

const ModelCard: React.FC<{
  model: ModelInfo;
  isSelected: boolean;
  isDownloading: boolean;
  isExtracting: boolean;
  downloadProgress?: { percentage: number };
  onSelect: () => void;
  onDownload: () => void;
  onDelete: () => void;
}> = ({
  model,
  isSelected,
  isDownloading,
  isExtracting,
  downloadProgress,
  onSelect,
  onDownload,
  onDelete,
}) => {
  const isProcessing = isDownloading || isExtracting;

  return (
    <div
      className={`p-3 rounded-lg border transition-all ${
        isSelected
          ? "border-logo-primary bg-logo-primary/10"
          : "border-mid-gray/20 hover:border-mid-gray/40"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-sm">{model.name}</h4>
            {model.is_default && (
              <span className="px-1.5 py-0.5 text-xs bg-logo-primary/20 text-logo-primary rounded">
                Recommended
              </span>
            )}
            {isSelected && model.is_downloaded && (
              <span className="px-1.5 py-0.5 text-xs bg-green-500/20 text-green-500 rounded">
                Active
              </span>
            )}
          </div>
          <p className="text-xs text-mid-gray mt-1">{model.description}</p>
          <p className="text-xs text-mid-gray/70 mt-0.5">
            Size: {formatBytes(model.size_bytes)}
          </p>
        </div>

        <div className="flex items-center gap-2 ml-3">
          {model.is_downloaded ? (
            <>
              {!isSelected && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onSelect}
                  disabled={isProcessing}
                >
                  Select
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={onDelete}
                disabled={isProcessing || isSelected}
                title={isSelected ? "Cannot delete active model" : "Delete model"}
              >
                <svg
                  className="h-4 w-4 text-red-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </Button>
            </>
          ) : isDownloading ? (
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 bg-mid-gray/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-logo-primary transition-all"
                  style={{ width: `${downloadProgress?.percentage ?? 0}%` }}
                />
              </div>
              <span className="text-xs text-mid-gray">
                {downloadProgress?.percentage ?? 0}%
              </span>
            </div>
          ) : isExtracting ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-logo-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-mid-gray">Extracting...</span>
            </div>
          ) : (
            <Button variant="secondary" size="sm" onClick={onDownload}>
              Download
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  grouped = false,
}) => {
  const {
    models,
    currentModel,
    loading,
    error,
    isModelDownloading,
    isModelExtracting,
    getDownloadProgress,
    selectModel,
    downloadModel,
    deleteModel,
  } = useModelStore();

  if (loading) {
    return (
      <SettingContainer
        title="Available Models"
        description="Download and select speech recognition models"
        grouped={grouped}
        layout="stacked"
      >
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-logo-primary border-t-transparent rounded-full animate-spin" />
          <span className="ml-2 text-sm text-mid-gray">Loading models...</span>
        </div>
      </SettingContainer>
    );
  }

  return (
    <SettingContainer
      title="Available Models"
      description="Download and select speech recognition models. Larger models provide better accuracy but require more resources."
      grouped={grouped}
      layout="stacked"
    >
      <div className="space-y-2">
        {error && (
          <div className="p-2 bg-red-500/10 border border-red-500/20 rounded text-sm text-red-500">
            {error}
          </div>
        )}

        {models.map((model) => (
          <ModelCard
            key={model.id}
            model={model}
            isSelected={model.id === currentModel}
            isDownloading={isModelDownloading(model.id)}
            isExtracting={isModelExtracting(model.id)}
            downloadProgress={getDownloadProgress(model.id)}
            onSelect={() => selectModel(model.id)}
            onDownload={() => downloadModel(model.id)}
            onDelete={() => deleteModel(model.id)}
          />
        ))}

        {models.length === 0 && (
          <div className="text-center py-8 text-mid-gray">
            No models available. Check your internet connection.
          </div>
        )}
      </div>
    </SettingContainer>
  );
};
