import React, { useState, useEffect } from "react";
import { useModelStore } from "@/stores/modelStore";
import ModelSelectionStep from "./ModelSelectionStep";
import ApiKeyStep from "./ApiKeyStep";
import CompleteStep from "./CompleteStep";

export type OnboardingStep = "model" | "apikey" | "complete";

interface OnboardingWizardProps {
  onComplete: () => void;
}

const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("model");
  const { initialize, hasAnyModels, isFirstRun } = useModelStore();

  // Initialize model store on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  const handleModelSelected = () => {
    // User has started a model download, proceed to API key step
    setCurrentStep("apikey");
  };

  const handleApiKeyComplete = () => {
    setCurrentStep("complete");
  };

  const handleApiKeySkip = () => {
    setCurrentStep("complete");
  };

  const handleOnboardingComplete = () => {
    onComplete();
  };

  // Step indicator dots
  const steps: OnboardingStep[] = ["model", "apikey", "complete"];
  const currentStepIndex = steps.indexOf(currentStep);

  return (
    <div className="h-screen w-screen flex flex-col p-6 gap-4">
      {/* Header with logo */}
      <div className="flex flex-col items-center gap-2 shrink-0">
        <h1 className="text-3xl font-bold text-text tracking-tight">Voyc</h1>
        <p className="text-text/70 max-w-md font-medium text-center">
          Voice dictation for Linux - transcribe speech to text anywhere
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex justify-center gap-2 py-2">
        {steps.map((step, index) => (
          <div
            key={step}
            className={`w-2 h-2 rounded-full transition-colors duration-200 ${
              index <= currentStepIndex
                ? "bg-logo-primary"
                : "bg-mid-gray/30"
            }`}
          />
        ))}
      </div>

      {/* Content area */}
      <div className="max-w-[600px] w-full mx-auto flex-1 flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto">
          {currentStep === "model" && (
            <ModelSelectionStep onModelSelected={handleModelSelected} />
          )}

          {currentStep === "apikey" && (
            <ApiKeyStep
              onComplete={handleApiKeyComplete}
              onSkip={handleApiKeySkip}
            />
          )}

          {currentStep === "complete" && (
            <CompleteStep onComplete={handleOnboardingComplete} />
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingWizard;
