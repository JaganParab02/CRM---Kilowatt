'use client';

import { useEffect, useState, useCallback } from 'react';
import type { FollowUpCandidate, CustomerHistoryPayload } from '@/lib/ai/tools';
import type { AnalysisResult } from '@/lib/ai/service';
import type { EmailDraft } from '@/types/database';
import { formatCurrency, formatDate } from '@/utils/format';

export default function AIAssistantPage() {
  const [candidates, setCandidates] = useState<FollowUpCandidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState<boolean>(true);
  const [candidateError, setCandidateError] = useState<string | null>(null);

  // Selected Candidate & Analysis State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [customerHistory, setCustomerHistory] = useState<CustomerHistoryPayload | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

  // Email Draft State
  const [drafting, setDrafting] = useState<boolean>(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [savedDraft, setSavedDraft] = useState<EmailDraft | null>(null);
  const [draftMeta, setDraftMeta] = useState<{ source?: string; modelUsed?: string } | null>(null);

  // 1. Fetch Candidates
  const fetchCandidates = useCallback(async () => {
    setLoadingCandidates(true);
    setCandidateError(null);
    try {
      const res = await fetch('/api/ai/candidates');
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch follow-up candidates');
      }
      setCandidates(data.candidates || []);

      // Check if a specific customer was requested in the URL query string
      let targetId: string | null = null;
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        targetId = urlParams.get('customerId');
      }

      // Auto-select requested customer or first candidate
      const idToAnalyze = targetId || (!selectedCustomerId && data.candidates && data.candidates.length > 0 ? data.candidates[0].customerId : null);
      if (idToAnalyze) {
        handleAnalyzeCustomer(idToAnalyze);
      }
    } catch (err: unknown) {
      setCandidateError(err instanceof Error ? err.message : 'Error loading candidates');
    } finally {
      setLoadingCandidates(false);
    }
  }, [selectedCustomerId]);

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  // 2. Analyze Customer Action
  const handleAnalyzeCustomer = async (customerId: string) => {
    setSelectedCustomerId(customerId);
    setAnalyzing(true);
    setAnalysisError(null);
    setSavedDraft(null);
    setDraftError(null);

    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to analyze customer');
      }

      setCustomerHistory(data.history);
      setAnalysisResult(data.analysis);
    } catch (err: unknown) {
      setAnalysisError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  // 3. Generate Email Draft Action
  const handleGenerateDraft = async () => {
    if (!selectedCustomerId || !analysisResult) return;
    setDrafting(true);
    setDraftError(null);

    try {
      const res = await fetch('/api/ai/draft-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomerId,
          recommendationReason: analysisResult.recommendation,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate email draft');
      }

      setSavedDraft(data.draft);
      setDraftMeta({ source: data.source, modelUsed: data.modelUsed });
    } catch (err: unknown) {
      setDraftError(err instanceof Error ? err.message : 'Draft generation failed');
    } finally {
      setDrafting(false);
    }
  };

  return (
    <div className="max-w-6xl space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-6 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Agentic AI Customer Engagement Agent
            </h2>
            <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 border border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800">
              Autonomous Retention
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            Identifies customers eligible for re-engagement using strict CRM eligibility rules, performs evidence-based evaluations via Groq LLaMA, and generates personalized drafts saved to Supabase.
          </p>
        </div>

        <button
          onClick={fetchCandidates}
          disabled={loadingCandidates}
          className="self-start sm:self-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-95 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {loadingCandidates ? 'Scanning...' : 'Re-scan Candidates'}
        </button>
      </div>

      {/* Main 2-Column Workflow Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ─── Column 1: Candidate List (4 Cols) ─── */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Follow-up Candidates</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300 font-semibold">
                {candidates.length}
              </span>
            </h3>
            <span className="text-[11px] text-slate-400">Rule: &gt;60 days inactive</span>
          </div>

          {candidateError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200 text-xs">
              {candidateError}
            </div>
          )}

          {loadingCandidates ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-28 rounded-xl bg-slate-100 dark:bg-slate-800/60 animate-pulse border border-slate-200/60 dark:border-slate-800" />
              ))}
            </div>
          ) : candidates.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-800 bg-white dark:bg-slate-900/40">
              <span className="text-2xl block mb-2">🎉</span>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                No follow-up candidates found
              </p>
              <p className="text-xs text-slate-500 mt-1">
                All customers with completed orders have been active within the last 60 days, or have received recent follow-ups.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {candidates.map((cand) => {
                const isSelected = selectedCustomerId === cand.customerId;
                return (
                  <div
                    key={cand.customerId}
                    onClick={() => handleAnalyzeCustomer(cand.customerId)}
                    className={`cursor-pointer rounded-xl border p-4 transition-all ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50/40 shadow-sm dark:border-indigo-500 dark:bg-indigo-950/20'
                        : 'border-slate-200/80 bg-white hover:border-slate-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                          {cand.name}
                        </h4>
                        <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                          {cand.email}
                        </p>
                      </div>
                      <span className="rounded bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800 shrink-0">
                        {cand.daysInactive}d inactive
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/80 pt-2.5">
                      <span>{cand.orderCount} orders &bull; {formatCurrency(cand.totalSpend)}</span>
                      <span className="font-medium text-indigo-600 dark:text-indigo-400">
                        {isSelected ? 'Analyzing &rarr;' : 'Select &rarr;'}
                      </span>
                    </div>

                    <p className="mt-2 text-[11px] text-slate-600 dark:text-slate-400 leading-snug line-clamp-2">
                      💡 {cand.eligibilityReason}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ─── Column 2: Analysis & Email Draft (7 Cols) ─── */}
        <div className="lg:col-span-7 space-y-6">
          {/* Analysis Card */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Customer Evaluation & Evidence</span>
                  {analysisResult?.source === 'ai' ? (
                    <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                      AI Powered ({analysisResult.modelUsed})
                    </span>
                  ) : analysisResult?.source === 'rule_based_fallback' ? (
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      Rule-Based Fallback
                    </span>
                  ) : null}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {customerHistory
                    ? `Authoritative CRM evaluation for ${customerHistory.customer.first_name} ${customerHistory.customer.last_name}`
                    : 'Select a candidate to evaluate purchase evidence'}
                </p>
              </div>

              {selectedCustomerId && (
                <button
                  onClick={() => handleAnalyzeCustomer(selectedCustomerId)}
                  disabled={analyzing}
                  className="text-xs text-indigo-600 hover:underline dark:text-indigo-400 font-medium"
                >
                  {analyzing ? 'Evaluating...' : 'Re-evaluate'}
                </button>
              )}
            </div>

            {analysisError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-800 text-xs">
                {analysisError}
              </div>
            )}

            {analyzing ? (
              <div className="space-y-3 py-4">
                <div className="flex items-center gap-2 text-xs text-slate-500 animate-pulse">
                  <span className="h-3 w-3 rounded-full bg-indigo-500 animate-ping" />
                  <span>Agent reading Supabase customer history & generating evidence-based evaluation...</span>
                </div>
                <div className="h-20 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-lg" />
              </div>
            ) : !analysisResult || !customerHistory ? (
              <div className="py-12 text-center text-xs text-slate-400">
                Choose a candidate on the left to begin the evaluation workflow.
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                {/* Recommendation Box */}
                <div className="rounded-lg bg-indigo-50/60 p-4 border border-indigo-100 dark:bg-indigo-950/30 dark:border-indigo-900/40">
                  <h4 className="text-xs font-bold text-indigo-950 dark:text-indigo-200 uppercase tracking-wider mb-1">
                    Agent Recommendation
                  </h4>
                  <p className="text-xs text-indigo-900 dark:text-indigo-200 leading-relaxed font-medium">
                    {analysisResult.recommendation}
                  </p>
                  {analysisResult.suggestedFocus && (
                    <p className="mt-2 text-[11px] text-indigo-700 dark:text-indigo-300">
                      <strong>Suggested Engagement Focus:</strong> {analysisResult.suggestedFocus}
                    </p>
                  )}
                </div>

                {/* Evidence List */}
                <div>
                  <h4 className="font-semibold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-2">
                    Evidence From Database Records
                  </h4>
                  <ul className="space-y-1.5 text-slate-600 dark:text-slate-300">
                    {analysisResult.evidence.map((ev, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-emerald-500 font-bold">&#10003;</span>
                        <span>{ev}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Generate Draft Button */}
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={handleGenerateDraft}
                    disabled={drafting}
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 active:scale-95 disabled:opacity-50"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span>{drafting ? 'Generating & Saving Draft...' : 'Generate Personalized Email Draft'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Email Draft Panel */}
          {(savedDraft || drafting || draftError) && (
            <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 space-y-4 animate-fade-in">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                    Generated Email Draft
                  </h3>
                  <span className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300">
                    Draft &bull; Not Sent
                  </span>
                  {draftMeta?.source === 'ai' && (
                    <span className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                      Groq LLaMA ({draftMeta.modelUsed})
                    </span>
                  )}
                  {draftMeta?.source === 'rule_based_fallback' && (
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      Rule-Based Fallback
                    </span>
                  )}
                </div>

                {savedDraft && (
                  <button
                    onClick={handleGenerateDraft}
                    disabled={drafting}
                    className="text-xs text-indigo-600 hover:underline dark:text-indigo-400 font-medium"
                  >
                    {drafting ? 'Regenerating...' : 'Regenerate Draft'}
                  </button>
                )}
              </div>

              {draftError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-800 text-xs">
                  {draftError}
                </div>
              )}

              {drafting ? (
                <div className="space-y-3 py-6">
                  <div className="flex items-center gap-2 text-xs text-slate-500 animate-pulse">
                    <span className="h-3 w-3 rounded-full bg-indigo-500 animate-ping" />
                    <span>Writing personalized copy tailored to customer equipment history...</span>
                  </div>
                  <div className="h-32 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-lg" />
                </div>
              ) : savedDraft && customerHistory ? (
                <div className="space-y-3 text-xs">
                  {/* Recipient */}
                  <div className="flex items-center gap-2 py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="w-16 text-slate-400 font-medium">To:</span>
                    <span className="font-mono text-slate-800 dark:text-slate-200">
                      {customerHistory.customer.first_name} {customerHistory.customer.last_name} &lt;{customerHistory.customer.email}&gt;
                    </span>
                  </div>

                  {/* Subject Line */}
                  <div className="flex items-center gap-2 py-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="w-16 text-slate-400 font-medium">Subject:</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {savedDraft.subject}
                    </span>
                  </div>

                  {/* Email Body */}
                  <div className="mt-3">
                    <span className="text-slate-400 font-medium block mb-1.5">Draft Body:</span>
                    <div className="whitespace-pre-line rounded-lg bg-slate-50 p-4 font-sans text-xs leading-relaxed text-slate-800 dark:bg-slate-950 dark:text-slate-200 border border-slate-200/60 dark:border-slate-800">
                      {savedDraft.body}
                    </div>
                  </div>

                  {/* Database Persistence Status Confirmation */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-3 text-[11px] text-slate-500 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                      <span>✓</span>
                      <span>Persisted in Supabase `email_drafts` (ID: {savedDraft.id.slice(0, 8)}...)</span>
                    </div>
                    <span>Created: {formatDate(savedDraft.created_at)}</span>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
