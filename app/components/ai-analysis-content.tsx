"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import type { AiAnalysisResult } from "../utils/ai";
import { PrimaryButton, ShowMoreButton } from "./ui";

type AiAnalysisContentProps = {
  analysis: AiAnalysisResult | null;
  disabled?: boolean;
  error?: string | null;
  loading?: boolean;
  onAnalyze: () => void;
};

export function AiAnalysisContent({ analysis, disabled, error, loading, onAnalyze }: AiAnalysisContentProps) {
  const t = useTranslations("ai");
  const [expanded, setExpanded] = useState(false);
  const hasAnalysis = Boolean(
    analysis?.summary ||
    analysis?.comparison ||
    analysis?.strengths.length ||
    analysis?.weaknesses.length ||
    analysis?.recommendations.length,
  );
  const detailItems = [
    ...(analysis?.strengths ?? []).map((text) => ({ label: t("strength"), text })),
    ...(analysis?.weaknesses ?? []).map((text) => ({ label: t("weakness"), text })),
    ...(analysis?.recommendations ?? []).map((text) => ({ label: t("recommendation"), text })),
  ];
  const visibleDetails = expanded ? detailItems : detailItems.slice(0, 3);

  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-slate-300">
        {hasAnalysis ? analysis?.summary : t("unavailableLong")}
      </p>

      {analysis?.comparison && expanded ? (
        <p className="break-words rounded-2xl border border-violet-300/14 bg-white/[0.035] p-4 text-sm leading-6 text-slate-300">
          {analysis.comparison}
        </p>
      ) : null}

      {visibleDetails.length ? (
        <div className="space-y-2">
          {visibleDetails.map((item) => (
            <div key={`${item.label}-${item.text}`} className="rounded-2xl border border-violet-300/14 bg-white/[0.035] px-4 py-3 text-sm leading-6 text-slate-300">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-300/80">{item.label}</p>
              <p className="mt-1 break-words">{item.text}</p>
            </div>
          ))}
        </div>
      ) : null}

      {detailItems.length > 3 || analysis?.comparison ? (
        <ShowMoreButton expanded={expanded} onClick={() => setExpanded((current) => !current)} />
      ) : null}

      {error ? (
        <p className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      ) : null}

      <PrimaryButton icon={Sparkles} onClick={onAnalyze} disabled={loading}>
        {loading ? t("analyzing") : disabled ? t("apiDisconnected") : t("runAnalysis")}
      </PrimaryButton>
    </div>
  );
}
