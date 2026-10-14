'use client';

import { useEffect, useState, useCallback } from 'react';
import type { Customer, EmailDraft, EmailLog, WorkflowExecution, CommunicationWorkflow, EmailTemplate } from '@/types/database';
import { formatDate } from '@/utils/format';
import { createBrowserClient } from '@/lib/supabase/client';

export default function CommunicationPage() {
  // Customers & Drafts (strictly from database)
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [drafts, setDrafts] = useState<(EmailDraft & { customers?: Customer })[]>([]);
  const [loadingData, setLoadingData] = useState<boolean>(true);

  // Manual Composer State
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [recipientEmail, setRecipientEmail] = useState<string>('');
  const [subject, setSubject] = useState<string>('');
  const [body, setBody] = useState<string>('');
  const [selectedDraftId, setSelectedDraftId] = useState<string>('');
  const [isPromotional, setIsPromotional] = useState<boolean>(false);
  const [isConfirmed, setIsConfirmed] = useState<boolean>(false);
  const [sending, setSending] = useState<boolean>(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string; isSimulated?: boolean } | null>(null);

  // Workflow State
  const [workflow, setWorkflow] = useState<CommunicationWorkflow | null>(null);
  const [template, setTemplate] = useState<EmailTemplate | null>(null);
  const [totalExecutions, setTotalExecutions] = useState<number>(0);
  const [lastExecution, setLastExecution] = useState<WorkflowExecution | null>(null);
  const [togglingWorkflow, setTogglingWorkflow] = useState<boolean>(false);
  const [testingWorkflow, setTestingWorkflow] = useState<boolean>(false);
  const [workflowTestMessage, setWorkflowTestMessage] = useState<string | null>(null);

  // Communication History State
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(true);

  // 1. Load initial data
  const loadInitialData = useCallback(async () => {
    setLoadingData(true);
    try {
      // Fetch customers directly from Supabase DB
      try {
        const supabase = createBrowserClient();
        const { data: dbCustomers } = await supabase
          .from('customers')
          .select('*')
          .order('first_name', { ascending: true });
        if (dbCustomers) {
          setCustomers(dbCustomers);
        }
      } catch (err) {
        console.error('Failed to fetch customers from Supabase:', err);
      }

      // Fetch AI drafts
      const draftRes = await fetch('/api/communication/drafts');
      const draftData = await draftRes.json();
      setDrafts(draftData.drafts || []);

      // Fetch workflow status
      const wfRes = await fetch('/api/communication/workflow');
      const wfData = await wfRes.json();
      if (wfData.success) {
        setWorkflow(wfData.workflow);
        setTemplate(wfData.template);
        setTotalExecutions(wfData.totalExecutions ?? 0);
        setLastExecution(wfData.lastExecution ?? null);
      }

      // Fetch history
      fetchHistory();
    } catch (err) {
      console.error('Failed to load communication initial data:', err);
    } finally {
      setLoadingData(false);
    }
  }, []);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch('/api/communication/history');
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Failed to load email logs:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Selected customer change
  const handleCustomerSelect = (custId: string) => {
    setSelectedCustomerId(custId);
    const found = customers.find((c) => c.id === custId);
    if (found) {
      setRecipientEmail(found.email);
    }
    setSendResult(null);
  };

  // Load existing AI draft into composer
  const handleLoadDraft = (draftId: string) => {
    setSelectedDraftId(draftId);
    const draft = drafts.find((d) => d.id === draftId);
    if (draft) {
      setSubject(draft.subject);
      setBody(draft.body);
      if (draft.customer_id) {
        setSelectedCustomerId(draft.customer_id);
        const cust = customers.find((c) => c.id === draft.customer_id) || draft.customers;
        if (cust) {
          setRecipientEmail(cust.email);
        }
      }
    }
  };

  // Handle Send Manual Email
  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConfirmed) {
      setSendResult({ success: false, message: 'Please confirm that you want to send this email before proceeding.' });
      return;
    }

    const selectedCust = customers.find((c) => c.id === selectedCustomerId);
    if (selectedCust?.email_opt_out && isPromotional) {
      setSendResult({ success: false, message: 'Cannot send: Customer has opted out of promotional communications.' });
      return;
    }

    setSending(true);
    setSendResult(null);

    try {
      const res = await fetch('/api/communication/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: recipientEmail,
          subject,
          body,
          customerId: selectedCustomerId || null,
          draftId: selectedDraftId || null,
          isPromotional,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to send email');
      }

      setSendResult({
        success: true,
        isSimulated: data.isSimulated,
        message: data.isSimulated
          ? `[DEMO MODE] Email recorded as SIMULATED to ${recipientEmail}. Resend credentials are not set.`
          : `Email successfully accepted by Resend (Message ID: ${data.providerMessageId}).`,
      });

      setIsConfirmed(false);
      fetchHistory();
    } catch (err: unknown) {
      setSendResult({ success: false, message: err instanceof Error ? err.message : 'Error sending email' });
    } finally {
      setSending(false);
    }
  };

  // Toggle Workflow State
  const handleToggleWorkflow = async () => {
    if (!workflow) return;
    setTogglingWorkflow(true);
    try {
      const nextState = !workflow.is_enabled;
      const res = await fetch('/api/communication/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextState }),
      });
      const data = await res.json();
      if (data.success) {
        setWorkflow({ ...workflow, is_enabled: nextState });
      }
    } catch (err) {
      console.error('Failed to toggle workflow:', err);
    } finally {
      setTogglingWorkflow(false);
    }
  };

  // Test Workflow Simulation
  const handleTestWorkflow = async () => {
    setTestingWorkflow(true);
    setWorkflowTestMessage(null);
    try {
      const res = await fetch('/api/communication/workflow/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || 'Workflow execution failed');
      }

      setWorkflowTestMessage(data.message);
      setTotalExecutions((prev) => prev + 1);
      setLastExecution(data.execution);
      fetchHistory();
    } catch (err: unknown) {
      setWorkflowTestMessage(err instanceof Error ? err.message : 'Test failed');
    } finally {
      setTestingWorkflow(false);
    }
  };

  const selectedCust = customers.find((c) => c.id === selectedCustomerId);

  return (
    <div className="max-w-6xl space-y-8">
      {/* Page Header & Demo Mode Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-6 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Email Communication Hub
            </h2>
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800">
              Phase 4
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            Manual email composer, AI draft review, automated order-completed workflows, and unified communication history.
          </p>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <span>Demo Mode: Resend Simulated</span>
        </div>
      </div>

      {/* Grid: Workflow Status Card & Automated Trigger */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                Automated Workflow: {workflow?.name || 'Order Completed Notification'}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  workflow?.is_enabled
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                {workflow?.is_enabled ? 'Active / Enabled' : 'Disabled'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Trigger: <code className="font-mono text-emerald-600 dark:text-emerald-400">order_completed</code> &bull; Sends thank-you email with order totals & support details.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleWorkflow}
              disabled={togglingWorkflow}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
            >
              {togglingWorkflow ? 'Updating...' : workflow?.is_enabled ? 'Disable Workflow' : 'Enable Workflow'}
            </button>
            <button
              onClick={handleTestWorkflow}
              disabled={testingWorkflow}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              <span>⚡</span>
              <span>{testingWorkflow ? 'Simulating...' : 'Test Workflow'}</span>
            </button>
          </div>
        </div>

        {/* Workflow Stats & Last Execution */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
            <span className="text-slate-400 block text-[11px]">Total Executions</span>
            <span className="text-base font-bold text-slate-900 dark:text-white">{totalExecutions}</span>
            <span className="text-[10px] text-slate-400 block">Idempotent execution count</span>
          </div>

          <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 sm:col-span-2">
            <span className="text-slate-400 block text-[11px]">Latest Execution Result</span>
            {lastExecution ? (
              <div>
                <span className="font-medium text-slate-800 dark:text-slate-200 block truncate">
                  {lastExecution.result_details || lastExecution.status}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Status: <strong className="uppercase">{lastExecution.status}</strong> &bull; {formatDate(lastExecution.created_at)}
                </span>
              </div>
            ) : (
              <span className="text-slate-400 italic">No executions recorded yet. Click &quot;Test Workflow&quot; to test.</span>
            )}
          </div>
        </div>

        {template && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg bg-slate-50/60 p-3 text-xs border border-slate-100 dark:bg-slate-800/30 dark:border-slate-800/60">
            <div>
              <span className="font-semibold text-slate-700 dark:text-slate-300">Default Template: </span>
              <span className="text-slate-600 dark:text-slate-400">{template.name} ({template.category})</span>
            </div>
            <div className="text-[11px] text-slate-500 italic">
              Subject: &quot;{template.subject}&quot;
            </div>
          </div>
        )}

        {workflowTestMessage && (
          <div className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
            <strong>Simulation Result:</strong> {workflowTestMessage}
          </div>
        )}
      </div>

      {/* Manual Email Composer Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Form Panel (7 cols) */}
        <form
          onSubmit={handleSendEmail}
          className="lg:col-span-7 rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Manual Email Composer
              </h3>
              {loadingData && (
                <span className="text-[10px] text-blue-500 animate-pulse font-medium">Syncing...</span>
              )}
            </div>
            <span className="text-xs text-slate-400">Explicit confirmation required</span>
          </div>

          {/* Feedback message */}
          {sendResult && (
            <div
              className={`rounded-lg p-3 text-xs font-medium border ${
                sendResult.success
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300'
              }`}
            >
              {sendResult.message}
            </div>
          )}

          {/* Load AI Draft Dropdown */}
          {drafts.length > 0 && (
            <div className="rounded-lg bg-indigo-50/60 p-3 border border-indigo-100 dark:bg-indigo-950/30 dark:border-indigo-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-semibold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                <span>✨</span>
                <span>Load Existing AI Draft ({drafts.length} ready):</span>
              </span>
              <select
                value={selectedDraftId}
                onChange={(e) => handleLoadDraft(e.target.value)}
                className="rounded-lg border border-indigo-200 bg-white px-2.5 py-1 text-xs text-slate-900 focus:outline-none dark:border-indigo-800 dark:bg-slate-900 dark:text-white"
              >
                <option value="">-- Choose AI Draft --</option>
                {drafts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.subject.slice(0, 40)}... ({d.customers?.first_name || 'Customer'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Customer Selector */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Select Customer
            </label>
            <select
              value={selectedCustomerId}
              onChange={(e) => handleCustomerSelect(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            >
              <option value="">-- Choose a customer profile --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.first_name} {c.last_name} ({c.email}) {c.email_opt_out ? '— ⚠️ Opted Out' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Recipient Email */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Recipient Email Address *
            </label>
            <input
              type="email"
              required
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="customer@example.com"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            />
          </div>

          {/* Opt-out Warning */}
          {selectedCust?.email_opt_out && (
            <div className="rounded-lg bg-rose-50 p-2.5 border border-rose-200 text-rose-800 text-xs">
              ⚠️ <strong>Customer Consent Notice:</strong> This customer has opted out of promotional communications. Promotional email delivery will be blocked.
            </div>
          )}

          {/* Subject Line */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Subject Line *
            </label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Following up on your solar panel installation"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            />
          </div>

          {/* Message Body */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Message Body (Text) *
            </label>
            <textarea
              required
              rows={6}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type your customer email message here..."
              className="w-full rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-900 font-sans leading-relaxed focus:border-blue-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            />
          </div>

          {/* Promotional Toggle & Confirmation Step */}
          <div className="space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800 text-xs">
            <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={isPromotional}
                onChange={(e) => setIsPromotional(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Mark this message as a Promotional / Marketing Email (Subject to opt-out checks)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-slate-900 dark:text-white font-medium">
              <input
                type="checkbox"
                checked={isConfirmed}
                onChange={(e) => setIsConfirmed(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>I confirm that I have reviewed the recipient and message contents.</span>
            </label>
          </div>

          {/* Send Button */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={sending || !isConfirmed || (Boolean(selectedCust?.email_opt_out) && isPromotional)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-95 disabled:opacity-40"
            >
              <span>✉️</span>
              <span>{sending ? 'Sending...' : 'Send Approved Email'}</span>
            </button>
          </div>
        </form>

        {/* Live Email Preview Card (5 cols) */}
        <div className="lg:col-span-5 rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Live Email Preview
            </h3>
            <span className="text-[11px] text-slate-400">WYSIWYG Layout</span>
          </div>

          <div className="rounded-lg border border-slate-200/80 bg-slate-50 p-4 text-xs dark:border-slate-800 dark:bg-slate-950 space-y-2">
            <div className="border-b border-slate-200/60 pb-2 dark:border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">From</span>
              <span className="text-slate-700 dark:text-slate-300">Kilowatt Store &lt;orders@kilowatt.com&gt;</span>
            </div>

            <div className="border-b border-slate-200/60 pb-2 dark:border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">To</span>
              <span className="text-slate-800 dark:text-slate-200 font-mono">
                {recipientEmail || 'recipient@example.com'}
              </span>
            </div>

            <div className="border-b border-slate-200/60 pb-2 dark:border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Subject</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {subject || 'No subject entered'}
              </span>
            </div>

            <div className="pt-2">
              <span className="text-slate-400 block text-[10px] uppercase font-bold mb-1">Content</span>
              <div className="whitespace-pre-line text-slate-700 dark:text-slate-300 leading-relaxed font-sans min-h-[120px]">
                {body || 'Email body will preview here...'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Communication History Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Communication History & Logs
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Complete audit log of manual emails and automated workflow dispatches
            </p>
          </div>

          <button
            onClick={fetchHistory}
            disabled={loadingHistory}
            className="text-xs text-blue-600 hover:underline dark:text-blue-400 font-medium"
          >
            {loadingHistory ? 'Refreshing...' : 'Refresh Logs'}
          </button>
        </div>

        {loadingHistory ? (
          <div className="rounded-xl border border-slate-200/80 bg-white p-6 dark:border-slate-800 dark:bg-slate-900/60 space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-12 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-lg" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-800 bg-white dark:bg-slate-900/40">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No emails sent or simulated yet</p>
            <p className="text-xs text-slate-500 mt-1">Compose a manual email above or click &quot;Test Workflow&quot; to test.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:bg-slate-800/50 dark:text-slate-400 border-b border-slate-200/80 dark:border-slate-800">
                  <tr>
                    <th className="px-6 py-3.5">Recipient</th>
                    <th className="px-6 py-3.5">Subject</th>
                    <th className="px-6 py-3.5">Source</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {logs.map((log) => {
                    const isSimulated = log.is_simulated || log.status === 'simulated';
                    return (
                      <tr key={log.id} className="transition-colors hover:bg-slate-50/75 dark:hover:bg-slate-800/40">
                        <td className="px-6 py-4">
                          <span className="font-mono text-xs text-slate-900 dark:text-slate-200 block">
                            {log.recipient}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-medium text-slate-800 dark:text-slate-200 block text-xs">
                            {log.subject}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-block rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300 uppercase">
                            {log.source}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium border ${
                              isSimulated
                                ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300'
                                : log.status === 'sent'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300'
                                : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300'
                            }`}
                          >
                            {isSimulated ? 'SIMULATED' : log.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-400 text-right whitespace-nowrap">
                          {formatDate(log.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
