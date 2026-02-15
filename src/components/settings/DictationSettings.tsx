/**
 * Dictation Settings Panel
 * Unified dictation interface with status, editor, and history
 */

import React from "react";
import { UnifiedDictation } from "./UnifiedDictation";

export const DictationSettings: React.FC = () => {
  return (
    <div className="h-full">
      <UnifiedDictation />
    </div>
  );
};
