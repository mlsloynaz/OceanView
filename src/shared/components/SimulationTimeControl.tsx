import type { AssessmentTimeMode } from "@/features/market/lib/assessment-time";
import { formatEtDatetimeLocal } from "@/features/market/lib/assessment-time";
import { LiveSimulateControl, type LiveSimulateMode } from "./LiveSimulateControl";

export function assessmentToLiveSimulate(mode: AssessmentTimeMode): LiveSimulateMode {
  return mode === "now" ? "live" : "simulate";
}

export function liveSimulateToAssessment(mode: LiveSimulateMode): AssessmentTimeMode {
  return mode === "live" ? "now" : "et";
}

type Props = {
  mode: AssessmentTimeMode;
  value: Date;
  disabled?: boolean;
  inputId?: string;
  liveEnabled?: boolean;
  simulateEnabled?: boolean;
  liveHint?: string;
  showLiveClock?: boolean;
  onModeChange: (mode: AssessmentTimeMode) => void;
  onChange: (localValue: string) => void;
  className?: string;
};

/** Live / Simulate toggle with optional Eastern datetime picker (no action buttons). */
export function SimulationTimeControl({
  mode,
  value,
  disabled,
  inputId = "simulation-time",
  liveEnabled = true,
  simulateEnabled = true,
  liveHint = "at evaluate",
  showLiveClock = true,
  onModeChange,
  onChange,
  className,
}: Props) {
  return (
    <LiveSimulateControl
      mode={assessmentToLiveSimulate(mode)}
      onModeChange={(next) => onModeChange(liveSimulateToAssessment(next))}
      disabled={disabled}
      liveEnabled={liveEnabled}
      simulateEnabled={simulateEnabled}
      variant="default"
      simulateInput="datetime"
      simulateValue={formatEtDatetimeLocal(value)}
      onSimulateChange={onChange}
      simulateInputId={inputId}
      showLiveClock={showLiveClock}
      liveHint={liveHint}
      className={className}
      ariaLabel="Evaluation time mode"
    />
  );
}
