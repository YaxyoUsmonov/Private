"use client";

export type AiAnalysisPeriod = "week" | "month" | "year";
export type AiAnalysisScope = "dashboard" | "finance" | "plans" | "mistakes" | "summary";

export type AiAnalysisResult = {
  summary: string;
  comparison: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  score: number | null;
  period: AiAnalysisPeriod;
};

export type AiChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

export const AI_ANALYSIS_PERIODS: AiAnalysisPeriod[] = ["week", "month", "year"];

export function aiUnavailableText() {
  return "AI tahlili uchun API ulanmagan. AI API ulangandan keyin haftalik, oylik va yillik tahlillar shu yerda chiqadi.";
}

export function aiUnavailableShortText() {
  return "AI API ulanmagan";
}
