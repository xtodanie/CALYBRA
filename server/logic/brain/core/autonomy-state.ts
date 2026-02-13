export type AutonomyState = "Advisory" | "Assisted" | "Restricted" | "Locked";

export function transitionAutonomyState(params: {
  current: AutonomyState;
  accuracyScore: number;
  driftTriggered: boolean;
  riskExposure: number;
  consecutiveMisfires: number;
  roiNegative: boolean;
}): AutonomyState {
  if (params.roiNegative || params.consecutiveMisfires >= 3 || params.riskExposure > 0.8) {
    return "Locked";
  }
  if (params.accuracyScore < 0.45 || params.driftTriggered || params.riskExposure > 0.6) {
    return "Restricted";
  }
  if (params.accuracyScore < 0.7 || params.riskExposure > 0.35) {
    return "Assisted";
  }
  return params.current === "Locked" ? "Restricted" : "Advisory";
}
