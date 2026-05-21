"use client";

import { useCallback, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { AiAnalysisPeriod, AiAnalysisResult, AiAnalysisScope } from "../utils/ai";

type UseAiAnalysisOptions = {
  anchorDate: string;
  period?: AiAnalysisPeriod;
  scope: AiAnalysisScope;
};

type AiAnalyzeResponse = {
  enabled?: boolean;
  analysis?: AiAnalysisResult | null;
  placeholder?: string;
  error?: string;
};

export function useAiAnalysis({ anchorDate, period = "week", scope }: UseAiAnalysisOptions) {
  const [analysis, setAnalysis] = useState<AiAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef<Record<string, AiAnalysisResult | null>>({});

  const analyze = useCallback(async () => {
    const cacheKey = `${scope}:${period}:${anchorDate}`;

    if (cacheKey in cacheRef.current) {
      setAnalysis(cacheRef.current[cacheKey]);
      setError(null);
      return cacheRef.current[cacheKey];
    }

    setLoading(true);
    setError(null);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        setError("AI tahlil uchun sessiya topilmadi.");
        return null;
      }

      const response = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ anchorDate, period, scope }),
      });
      const payload = (await response.json()) as AiAnalyzeResponse;

      if (!response.ok) {
        setError(payload.error ?? "AI tahlilini olishda xatolik yuz berdi.");
        return null;
      }

      if (payload.enabled === false) {
        setDisabled(true);
        setAnalysis(null);
        cacheRef.current[cacheKey] = null;
        return null;
      }

      setDisabled(false);
      setAnalysis(payload.analysis ?? null);
      cacheRef.current[cacheKey] = payload.analysis ?? null;
      return payload.analysis ?? null;
    } catch {
      setError("AI tahlilini olishda xatolik yuz berdi.");
      return null;
    } finally {
      setLoading(false);
    }
  }, [anchorDate, period, scope]);

  return {
    analysis,
    analyze,
    disabled,
    error,
    loading,
    onAnalyze: analyze,
  };
}
