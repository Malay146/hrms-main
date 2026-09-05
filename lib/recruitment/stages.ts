export const PIPELINE_STAGES = [
  "Applied",
  "Screening",
  "Interview",
  "Technical",
  "Offer",
  "Hired",
] as const;

export type PipelineStageLabel = (typeof PIPELINE_STAGES)[number];
