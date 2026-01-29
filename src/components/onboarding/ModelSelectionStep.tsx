import React, { useState, useEffect } from "react";
import { useModelStore, type ModelInfo } from "@/stores/modelStore";
import ModelCard from "./ModelCard";

interface ModelSelectionStepProps {
  onModelSelected: () => void;
}

const RECOMMENDED_MODEL_ID = "parakeet-tdt-0.6b-v3";

const ModelSelectionStep: React.FC<ModelSelectionStepProps> = ({
  onModelSelected,
}) => {
  const {
    models,
    loading,
    error,
    downloadModel,
    loadModels,
    downloadingModels,
  } = useModelStore();

  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  // Filter to only show downloadable models (not already downloaded)
  const availableModels = models.filter((m) => !m.is_downloaded);

  const handleDownloadModel = async (modelId: string) => {
    setLocalError(null);

    // Immediately transition to next step - download will continue in background
    onModelSelected();

    const success = await downloadModel(modelId);
    if (!success) {
      console.error("Download failed for model:", modelId);
      // Error is handled by the store
    }
  };

  const isRecommended = (modelId: string): boolean => {
    return modelId === RECOMMENDED_MODEL_ID;
  };

  const isDownloading = downloadingModels.size > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-logo-primary" />
      </div>
    );
  }

  const displayError = localError || error;

  return (
    <div className="flex flex-col gap-4">
      <div className="text-center mb-2">
        <h2 className="text-xl font-semibold text-text mb-2">
          Download a Speech Model
        </h2>
        <p className="text-text/70">
          Choose a model to get started. The recommended model offers the best
          balance of speed and accuracy.
        </p>
      </div>

      {displayError && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <p className="text-red-400 text-sm">{displayError}</p>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {/* Featured/recommended models first */}
        {availableModels
          .filter((model) => isRecommended(model.id))
          .map((model) => (
            <ModelCard
              key={model.id}
              model={model}
              variant="featured"
              disabled={isDownloading}
              onSelect={handleDownloadModel}
            />
          ))}

        {/* Other models sorted by size */}
        {availableModels
          .filter((model) => !isRecommended(model.id))
          .sort((a, b) => a.size_bytes - b.size_bytes)
          .map((model) => (
            <ModelCard
              key={model.id}
              model={model}
              disabled={isDownloading}
              onSelect={handleDownloadModel}
            />
          ))}
      </div>

      {availableModels.length === 0 && !loading && (
        <div className="text-center py-8 text-text/60">
          <p>No models available for download.</p>
        </div>
      )}
    </div>
  );
};

export default ModelSelectionStep;
