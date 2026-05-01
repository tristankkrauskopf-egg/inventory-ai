import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "./supabaseClient";

type Product = {
  id: string;
  name: string;
  inventory: number;
  dailySales: number;
  leadTime: number;
};

type CalcResult = Product & {
  reorderPoint: number;
  daysLeft: number;
  status: "High Risk" | "Medium Risk" | "Healthy";
  action: string;
  orderQuantity: number;
};

function calculate(p: Product): CalcResult {
  const reorderPoint = p.dailySales * p.leadTime;
  const daysLeft = p.dailySales > 0 ? Math.floor(p.inventory / p.dailySales) : 999;
  const bufferDays = 3;
  const targetStock = p.dailySales * (p.leadTime + bufferDays);
  const orderQuantity = Math.max(0, Math.ceil(targetStock - p.inventory));
  let status: "High Risk" | "Medium Risk" | "Healthy" = "Healthy";
  let action = "No action needed";
  if (p.inventory < reorderPoint) { status = "High Risk"; action = "Reorder now"; }
  else if (p.inventory < reorderPoint * 1.2) { status = "Medium Risk"; action = "Reorder soon"; }
  return { ...p, reorderPoint, daysLeft, status, action, orderQuantity };
}

function StatusBadge({ status }: { status: CalcResult["status"] }) {
  if (status === "High Risk") return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 ring-1 ring-red-200">
      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />High Risk
    </span>
  );
  if (status === "Medium Risk") return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 ring-1 ring-amber-200">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />Medium Risk
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Healthy
    </span>
  );
}

function DaysLeftBar({ daysLeft, leadTime }: { daysLeft: number; leadTime: number }) {
  const pct = Math.min(100, Math.round((daysLeft / Math.max(leadTime * 2, 1)) * 100));
  const color = daysLeft <= leadTime ? "bg-red-400" : daysLeft <= leadTime * 1.2 ? "bg-amber-400" : "bg-emerald-400";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-medium tabular-nums w-8 text-right">{daysLeft === 999 ? "∞" : daysLeft}d</span>
    </div>
  );
}

function SpinnerIcon() {
  return (
    <svg className="w-4 h-4 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

type AIState = { status: "idle" | "loading" | "done" | "error"; text: string };

function AIAnalysisSection({ products, calculated }: { products: Product[]; calculated: CalcResult[] }) {
  const atRisk = calculated.filter((p) => p.status !== "Healthy");
  const [aiStates, setAiStates] = useState<Record<string, AIState>>({});
  const [refreshing, setRefreshing] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const fetchAI = useCallback(async (data: CalcResult, force = false) => {
    if (!force && aiStates[data.id]?.status === "done") return;
    setAiStates((prev) => ({ ...prev, [data.id]: { status: "loading", text: "" } }));
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product: data }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const result = await res.json();
      setAiStates((prev) => ({ ...prev, [data.id]: { status: "done", text: result.explanation || "No explanation returned." } }));
    } catch {
      setAiStates((prev) => ({ ...prev, [data.id]: { status: "error", text: "AI analysis could not be loaded. Check your connection and API key." } }));
    }
    setRefreshing((prev) => ({ ...prev, [data.id]: false }));
  }, [aiStates]);

  useEffect(() => {
    atRisk.forEach((data) => {
      if (!aiStates[data.id]) fetchAI(data);
    });
  }, [atRisk.map((p) => p.id).join(",")]);

  const handleRefresh = async (data: CalcResult) => {
    setRefreshing((prev) => ({ ...prev, [data.id]: true }));
    await fetchAI(data, true);
  };

  if (products.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">AI Analysis</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Intelligent reorder recommendations for products that need attention
          </p>
        </div>
        {atRisk.length > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary text-xs font-semibold rounded-full ring-1 ring-primary/20">
            {atRisk.length} item{atRisk.length !== 1 ? "s" : ""} need attention
          </span>
        )}
      </div>

      {atRisk.length === 0 ? (
        <div className="bg-card border border-card-border rounded-xl p-8 text-center shadow-xs">
          <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="font-semibold text-foreground">All products are healthy</p>
          <p className="text-sm text-muted-foreground mt-1">No reorder recommendations needed right now. Check back as inventory changes.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {atRisk.map((data) => {
            const ai = aiStates[data.id];
            const isLoading = ai?.status === "loading" || !ai;
            const isError = ai?.status === "error";
            const isRefreshing = refreshing[data.id];

            return (
              <div
                key={data.id}
                className={`bg-card border rounded-xl shadow-xs overflow-hidden flex flex-col ${
                  data.status === "High Risk" ? "border-red-200" : "border-amber-200"
                }`}
              >
                <div className={`px-5 py-3.5 border-b flex items-center justify-between ${
                  data.status === "High Risk" ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      data.status === "High Risk" ? "bg-red-100" : "bg-amber-100"
                    }`}>
                      {data.status === "High Risk" ? (
                        <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground text-sm">{data.name}</p>
                      <p className="text-xs text-muted-foreground">{data.action} &mdash; order {data.orderQuantity.toLocaleString()} units</p>
                    </div>
                  </div>
                  <StatusBadge status={data.status} />
                </div>

                <div className="px-5 py-4 grid grid-cols-3 gap-3 border-b border-card-border bg-muted/20">
                  {[
                    { label: "Current Stock", value: data.inventory.toLocaleString() },
                    { label: "Reorder Point", value: data.reorderPoint.toLocaleString() },
                    { label: "Days Remaining", value: data.daysLeft === 999 ? "∞" : `${data.daysLeft}d` },
                  ].map((m) => (
                    <div key={m.label} className="text-center">
                      <p className="text-lg font-bold text-foreground tabular-nums">{m.value}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{m.label}</p>
                    </div>
                  ))}
                </div>

                <div className="px-5 py-4 flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                    <p className="text-xs font-semibold text-foreground uppercase tracking-wider">AI Recommendation</p>
                    <button
                      onClick={() => handleRefresh(data)}
                      disabled={isRefreshing || isLoading}
                      className="ml-auto p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40"
                      title="Refresh analysis"
                    >
                      <svg className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                  </div>

                  {isLoading ? (
                    <div className="flex items-center gap-3 py-2">
                      <SpinnerIcon />
                      <span className="text-sm text-muted-foreground animate-pulse">Analyzing inventory situation...</span>
                    </div>
                  ) : isError ? (
                    <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2.5">
                      <svg className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>{ai?.text}</span>
                    </div>
                  ) : (() => {
                    const sentences = (ai?.text ?? "").split(/(?<=[.!?])\s+/);
                    const summary = sentences[0] ?? "";
                    const rest = sentences.slice(1).join(" ");
                    const isOpen = expanded[data.id];
                    return (
                      <div>
                        <p className="text-sm text-foreground leading-relaxed">{summary}</p>
                        {rest && (
                          <>
                            {isOpen && (
                              <p className="text-sm text-foreground/80 leading-relaxed mt-2">{rest}</p>
                            )}
                            <button
                              onClick={() => setExpanded((prev) => ({ ...prev, [data.id]: !isOpen }))}
                              className="mt-2 text-xs font-medium text-primary hover:underline flex items-center gap-1"
                            >
                              {isOpen ? (
                                <>
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                  </svg>
                                  Hide details
                                </>
                              ) : (
                                <>
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                  Show details
                                </>
                              )}
                            </button>
                          </>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AlertSection({ calculated, userEmail }: { calculated: CalcResult[]; userEmail: string }) {
  const atRisk = calculated.filter((p) => p.status !== "Healthy");
  const [email, setEmail] = useState(userEmail);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const sendAlert = async () => {
    if (!email || atRisk.length === 0) return;
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, products: atRisk }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send");
      setResult({ type: "success", message: `Alert sent to ${email}` });
    } catch (err) {
      setResult({ type: "error", message: err instanceof Error ? err.message : "Failed to send alert" });
    }
    setSending(false);
  };

  if (atRisk.length === 0) return null;

  return (
    <div className="bg-card border border-card-border rounded-xl shadow-xs overflow-hidden">
      <div className="px-5 py-4 border-b border-card-border flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <div>
          <h2 className="font-semibold text-foreground">Email Alert</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Send a formatted inventory alert with all {atRisk.length} at-risk item{atRisk.length > 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className="px-5 py-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Send alert to</label>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setResult(null); }}
              placeholder="you@example.com"
              className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={sendAlert}
              disabled={sending || !email || atRisk.length === 0}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {sending ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Sending...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  Send Alert
                </>
              )}
            </button>
          </div>
        </div>

        {result && (
          <div className={`mt-3 flex items-center gap-2 text-sm px-4 py-3 rounded-lg ${
            result.type === "success"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}>
            {result.type === "success" ? (
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            {result.message}
          </div>
        )}

        <p className="text-xs text-muted-foreground mt-4">
          The email includes a full breakdown of all at-risk products with current stock, days remaining, and recommended order quantities.
          With a free Resend account, emails can only be sent to your own verified address. <a href="https://resend.com/domains" target="_blank" rel="noreferrer" className="underline hover:text-foreground transition-colors">Verify a domain</a> to send to any recipient.
        </p>
      </div>
    </div>
  );
}

type ProfitMetrics = {
  revenueAtRisk: number | null;
  reorderInvestment: number | null;
  annualHoldingCost: number | null;
  dailyRevenueAtRisk: number | null;
  highRiskCount: number;
  mediumRiskCount: number;
  healthyCount: number;
  totalOrderUnits: number;
};

function ProfitImpactSection({ calculated }: { calculated: CalcResult[] }) {
  const [selectedId, setSelectedId] = useState<string>("__all__");
  const [avgPrice, setAvgPrice] = useState("");
  const [holdingCostPct, setHoldingCostPct] = useState("25");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ analysis: string; metrics: ProfitMetrics } | null>(null);
  const [error, setError] = useState("");

  const scopedProducts = selectedId === "__all__" ? calculated : calculated.filter((p) => p.id === selectedId);
  const selectedLabel = selectedId === "__all__" ? "All Products" : (calculated.find((p) => p.id === selectedId)?.name ?? "");

  const price = avgPrice ? parseFloat(avgPrice) : null;
  const holdingPct = holdingCostPct ? parseFloat(holdingCostPct) : 25;

  const preview = useMemo(() => {
    const highRisk = scopedProducts.filter((p) => p.status === "High Risk");
    const totalOrderUnits = scopedProducts.reduce((s, p) => s + p.orderQuantity, 0);
    if (price === null) return null;
    const revenueAtRisk = highRisk.reduce((sum, p) => {
      const days = p.daysLeft === 999 ? 0 : p.daysLeft;
      return sum + p.dailySales * Math.max(0, p.leadTime - days) * price;
    }, 0);
    const dailyRevenueAtRisk = highRisk.reduce((s, p) => s + p.dailySales * price, 0);
    const reorderInvestment = totalOrderUnits * price;
    const totalInventoryValue = scopedProducts.reduce((s, p) => s + p.inventory * price, 0);
    const annualHoldingCost = totalInventoryValue * (holdingPct / 100);
    return { revenueAtRisk, dailyRevenueAtRisk, reorderInvestment, annualHoldingCost, totalOrderUnits };
  }, [scopedProducts, price, holdingPct]);

  const runAnalysis = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/profit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          products: scopedProducts,
          avgPrice: price ?? undefined,
          holdingCostPct: holdingPct,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    }
    setLoading(false);
  };

  const fmt = (n: number) =>
    `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  const paragraphs = result?.analysis
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean) ?? [];

  const metricCards = preview ? [
    { label: "Revenue at Risk", value: fmt(preview.revenueAtRisk), sub: "from high-risk stockouts", color: "text-red-600", bg: "bg-red-50 border-red-100" },
    { label: "Daily Exposure", value: fmt(preview.dailyRevenueAtRisk), sub: "revenue/day at risk", color: "text-amber-600", bg: "bg-amber-50 border-amber-100" },
    { label: "Reorder Investment", value: fmt(preview.reorderInvestment), sub: `${preview.totalOrderUnits.toLocaleString()} units`, color: "text-primary", bg: "bg-primary/5 border-primary/10" },
    { label: "Annual Holding Cost", value: fmt(preview.annualHoldingCost), sub: `at ${holdingPct}% rate`, color: "text-foreground", bg: "bg-muted/50 border-border" },
  ] : null;

  return (
    <div className="bg-card border border-card-border rounded-xl shadow-xs overflow-hidden">
      <div className="px-5 py-4 border-b border-card-border flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-foreground">Profit Impact Analysis</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            AI-powered revenue risk and margin assessment
            {selectedId !== "__all__" && (
              <span className="ml-1 font-medium text-foreground">— {selectedLabel}</span>
            )}
          </p>
        </div>
      </div>

      <div className="px-5 py-5 space-y-5">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="sm:w-52">
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Product</label>
            <select
              value={selectedId}
              onChange={(e) => { setSelectedId(e.target.value); setResult(null); setError(""); }}
              className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="__all__">All Products</option>
              {calculated.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="flex-1">
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Avg price per unit <span className="text-muted-foreground/60">(optional — enables $ estimates)</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={avgPrice}
                onChange={(e) => { setAvgPrice(e.target.value); setResult(null); }}
                placeholder="e.g. 49.99"
                className="w-full pl-7 pr-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div className="sm:w-36">
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Holding cost/yr</label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={holdingCostPct}
                onChange={(e) => { setHoldingCostPct(e.target.value); setResult(null); }}
                className="w-full pr-7 pl-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
            </div>
          </div>

          <div className="flex items-end">
            <button
              onClick={runAnalysis}
              disabled={loading || scopedProducts.length === 0}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-60"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Analyzing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Run Analysis
                </>
              )}
            </button>
          </div>
        </div>

        {metricCards ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {metricCards.map((m) => (
              <div key={m.label} className={`rounded-lg border px-4 py-3 transition-opacity ${result ? "" : "opacity-60"} ${m.bg}`}>
                <p className={`text-xl font-bold tabular-nums ${m.color}`}>{m.value}</p>
                <p className="text-xs font-medium text-foreground mt-0.5">{m.label}</p>
                <p className="text-xs text-muted-foreground">{m.sub}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {["Revenue at Risk", "Daily Exposure", "Reorder Investment", "Annual Holding Cost"].map((label) => (
              <div key={label} className="rounded-lg border border-dashed border-card-border px-4 py-3 bg-muted/20">
                <p className="text-xl font-bold text-muted-foreground/40">—</p>
                <p className="text-xs font-medium text-muted-foreground mt-0.5">{label}</p>
                <p className="text-xs text-muted-foreground/60">add a price to estimate</p>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-sm px-4 py-3 rounded-lg bg-red-50 text-red-700 border border-red-200">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            {error}
          </div>
        )}

        {result && (
          <div className="bg-muted/30 rounded-lg border border-card-border px-5 py-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 rounded-md bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider">
                AI Profit Assessment — {selectedLabel}
              </p>
            </div>
            <div className="space-y-2">
              {paragraphs.map((para, i) => {
                const isBold = para.startsWith("**") || /^#+\s/.test(para) || /^\d\./.test(para);
                const cleaned = para.replace(/\*\*/g, "").replace(/^#+\s/, "");
                return (
                  <p key={i} className={`text-sm leading-relaxed ${isBold ? "font-semibold text-foreground mt-3 first:mt-0" : "text-foreground/80"}`}>
                    {cleaned}
                  </p>
                );
              })}
            </div>
          </div>
        )}

        {!result && !loading && (
          <p className="text-xs text-muted-foreground">
            Select a product or keep "All Products", optionally enter a unit price, then click <span className="font-medium">Run Analysis</span> for an AI-powered profit impact breakdown.
          </p>
        )}
      </div>
    </div>
  );
}

type SnapshotEntry = {
  id: string;
  name: string;
  inventory: number;
  dailySales: number;
  status: "High Risk" | "Medium Risk" | "Healthy";
  daysLeft: number;
};

type DailySnapshot = {
  date: string;
  products: SnapshotEntry[];
};

function useInventorySnapshots(userId: string, calculated: CalcResult[]) {
  const key = `stocksense_snapshots_${userId}`;

  const loadSnapshots = (): DailySnapshot[] => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };

  const [snapshots, setSnapshots] = useState<DailySnapshot[]>(() => loadSnapshots());

  useEffect(() => {
    if (calculated.length === 0) return;
    const today = new Date().toISOString().slice(0, 10);
    const existing = loadSnapshots();
    if (existing.some((s) => s.date === today)) return;
    const newEntry: DailySnapshot = {
      date: today,
      products: calculated.map((p) => ({
        id: p.id, name: p.name, inventory: p.inventory,
        dailySales: p.dailySales, status: p.status, daysLeft: p.daysLeft,
      })),
    };
    const updated = [...existing, newEntry]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);
    localStorage.setItem(key, JSON.stringify(updated));
    setSnapshots(updated);
  }, [calculated.map((p) => p.id).join(","), userId]);

  const getProductHistory = (productId: string) =>
    snapshots
      .map((s) => {
        const p = s.products.find((x) => x.id === productId);
        return p ? { date: s.date, inventory: p.inventory, status: p.status } : null;
      })
      .filter(Boolean) as { date: string; inventory: number; status: string }[];

  const getTrend = (productId: string): "up" | "down" | "flat" | "none" => {
    const history = getProductHistory(productId);
    if (history.length < 2) return "none";
    const latest = history[history.length - 1].inventory;
    const prev = history[history.length - 2].inventory;
    if (latest > prev) return "up";
    if (latest < prev) return "down";
    return "flat";
  };

  return { snapshots, getProductHistory, getTrend };
}

function Sparkline({ data, width = 80, height = 28 }: { data: number[]; width?: number; height?: number }) {
  if (data.length < 2) return <span className="text-xs text-muted-foreground/40">—</span>;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 2;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * w;
    const y = pad + h - ((v - min) / range) * h;
    return `${x},${y}`;
  });
  const latest = data[data.length - 1];
  const first = data[0];
  const color = latest > first ? "#10b981" : latest < first ? "#ef4444" : "#94a3b8";
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline points={points.join(" ")} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={points[points.length - 1].split(",")[0]} cy={points[points.length - 1].split(",")[1]} r="2" fill={color} />
    </svg>
  );
}

function TrendArrow({ trend }: { trend: "up" | "down" | "flat" | "none" }) {
  if (trend === "none") return <span className="text-xs text-muted-foreground/40">new</span>;
  if (trend === "up") return (
    <span className="inline-flex items-center gap-0.5 text-xs font-medium text-emerald-600">
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" /></svg>
      up
    </span>
  );
  if (trend === "down") return (
    <span className="inline-flex items-center gap-0.5 text-xs font-medium text-red-600">
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
      down
    </span>
  );
  return <span className="text-xs font-medium text-muted-foreground">flat</span>;
}

function TrendSection({
  calculated,
  getProductHistory,
}: {
  calculated: CalcResult[];
  getProductHistory: (id: string) => { date: string; inventory: number; status: string }[];
}) {
  const [expanded, setExpanded] = useState(false);
  const productsWithHistory = calculated.filter((p) => getProductHistory(p.id).length >= 2);

  if (productsWithHistory.length === 0) {
    return (
      <div className="bg-card border border-card-border rounded-xl shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-card-border flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Inventory Trends</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Historical stock levels tracked daily</p>
          </div>
        </div>
        <div className="px-5 py-8 text-center">
          <p className="text-sm font-medium text-foreground">Building your trend history</p>
          <p className="text-xs text-muted-foreground mt-1">
            StockSense saves a daily snapshot each time you log in. Come back tomorrow to see your first trend lines.
          </p>
        </div>
      </div>
    );
  }

  const visible = expanded ? calculated : calculated.slice(0, 4);

  return (
    <div className="bg-card border border-card-border rounded-xl shadow-xs overflow-hidden">
      <div className="px-5 py-4 border-b border-card-border flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
          </svg>
        </div>
        <div className="flex-1">
          <h2 className="font-semibold text-foreground">Inventory Trends</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Daily stock snapshots — {productsWithHistory.length} product{productsWithHistory.length !== 1 ? "s" : ""} tracked
          </p>
        </div>
      </div>

      <div className="divide-y divide-card-border">
        {visible.map((p) => {
          const history = getProductHistory(p.id);
          const inventoryValues = history.map((h) => h.inventory);
          const latestVsPrev =
            history.length >= 2
              ? history[history.length - 1].inventory - history[history.length - 2].inventory
              : 0;
          const changeLabel =
            history.length >= 2
              ? latestVsPrev === 0
                ? "No change"
                : `${latestVsPrev > 0 ? "+" : ""}${latestVsPrev.toLocaleString()} units vs yesterday`
              : "First snapshot today";
          const maxInv = Math.max(...inventoryValues, 1);

          return (
            <div key={p.id} className="px-5 py-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm text-foreground truncate">{p.name}</span>
                  <StatusBadge status={p.status} />
                </div>
                <p className="text-xs text-muted-foreground">{changeLabel}</p>
                {history.length > 0 && (
                  <div className="mt-2 flex items-end gap-1">
                    {inventoryValues.map((v, i) => {
                      const pct = Math.max(4, Math.round((v / maxInv) * 32));
                      const isLatest = i === inventoryValues.length - 1;
                      const barColor = history[i].status === "High Risk"
                        ? isLatest ? "bg-red-500" : "bg-red-200"
                        : history[i].status === "Medium Risk"
                        ? isLatest ? "bg-amber-500" : "bg-amber-200"
                        : isLatest ? "bg-emerald-500" : "bg-emerald-200";
                      return (
                        <div
                          key={i}
                          title={`${history[i].date}: ${v.toLocaleString()} units`}
                          className={`w-2 rounded-sm transition-all ${barColor}`}
                          style={{ height: `${pct}px` }}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="flex-shrink-0 text-right">
                <p className="text-lg font-bold tabular-nums text-foreground">{p.inventory.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">current stock</p>
                <div className="mt-1">
                  <Sparkline data={inventoryValues} width={80} height={24} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {calculated.length > 4 && (
        <div className="px-5 py-3 border-t border-card-border bg-muted/30">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
          >
            {expanded ? (
              <>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                Show less
              </>
            ) : (
              <>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                Show all {calculated.length} products
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function AuthPage({ onLogin }: { onLogin: (user: unknown) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSuccess(""); setLoading(true);
    if (mode === "login") {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else if (data.user) onLogin(data.user);
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else if (data.user) setSuccess("Account created! You can now log in.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary mb-4">
            <svg className="w-6 h-6 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">StockSense</h1>
          <p className="text-sm text-muted-foreground mt-1">Inventory reorder intelligence</p>
        </div>
        <div className="bg-card border border-card-border rounded-xl shadow-sm p-6">
          <div className="flex mb-6 bg-muted rounded-lg p-1 gap-1">
            {(["login", "signup"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)} className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${mode === m ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {m === "login" ? "Log in" : "Sign up"}
              </button>
            ))}
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring" required />
            </div>
            {error && <div className="text-sm text-destructive bg-destructive/8 border border-destructive/20 rounded-lg px-3 py-2">{error}</div>}
            {success && <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{success}</div>}
            <button type="submit" disabled={loading} className="w-full py-2 px-4 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-60">
              {loading ? "Please wait..." : mode === "login" ? "Log in" : "Create account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [user, setUser] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", inventory: "", dailySales: "", leadTime: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", inventory: "", dailySales: "", leadTime: "" });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "High Risk" | "Medium Risk" | "Healthy">("all");
  const [sortBy, setSortBy] = useState<"name" | "daysLeft" | "inventory">("daysLeft");
  const [addingProduct, setAddingProduct] = useState(false);
  const [formError, setFormError] = useState("");
  const [csvLoading, setCsvLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { setUser(data.user); setLoading(false); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => { if (user) fetchProducts(); }, [user]);

  const fetchProducts = async () => {
    const u = user as { id: string } | null;
    if (!u) return;
    const { data, error } = await supabase.from("products").select("*").eq("user_id", u.id).order("name", { ascending: true });
    if (error) { console.error("Fetch error:", error); return; }
    setProducts((data ?? []).map((p: { id: string; name: string; inventory: number; daily_sales: number; lead_time: number }) => ({
      id: p.id, name: p.name, inventory: p.inventory, dailySales: p.daily_sales, leadTime: p.lead_time,
    })));
  };

  const addProduct = async () => {
    setFormError("");
    const u = user as { id: string } | null;
    if (!u) return;
    if (!form.name || !form.inventory || !form.dailySales || !form.leadTime) { setFormError("All fields are required."); return; }
    if (Number(form.dailySales) <= 0) { setFormError("Daily sales must be greater than 0."); return; }
    const { error } = await supabase.from("products").insert([{ user_id: u.id, name: form.name, inventory: Number(form.inventory), daily_sales: Number(form.dailySales), lead_time: Number(form.leadTime) }]);
    if (error) { console.error("Insert error:", error); return; }
    setForm({ name: "", inventory: "", dailySales: "", leadTime: "" });
    setAddingProduct(false);
    fetchProducts();
  };

  const deleteProduct = async (id: string) => {
    const u = user as { id: string } | null;
    if (!u) return;
    await supabase.from("products").delete().eq("id", id).eq("user_id", u.id);
    fetchProducts();
  };

  const startEdit = (p: Product) => {
    setEditingId(p.id);
    setEditForm({ name: p.name, inventory: String(p.inventory), dailySales: String(p.dailySales), leadTime: String(p.leadTime) });
  };

  const saveEdit = async (id: string) => {
    const u = user as { id: string } | null;
    if (!u) return;
    await supabase.from("products").update({ name: editForm.name, inventory: Number(editForm.inventory), daily_sales: Number(editForm.dailySales), lead_time: Number(editForm.leadTime) }).eq("id", id).eq("user_id", u.id);
    setEditingId(null);
    fetchProducts();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const u = user as { id: string } | null;
    if (!u) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvLoading(true);
    const text = await file.text();
    const rows = text.split("\n").slice(1).filter((r) => r.trim());
    const parsed = rows.map((row) => {
      const [name, inventory, dailySales, leadTime] = row.split(",");
      return { user_id: u.id, name: name?.trim(), inventory: Number(inventory), daily_sales: Number(dailySales), lead_time: Number(leadTime) };
    }).filter((p) => p.name);
    const { error } = await supabase.from("products").insert(parsed);
    if (error) console.error("CSV insert error:", error);
    else fetchProducts();
    setCsvLoading(false);
    e.target.value = "";
  };

  const exportCSV = () => {
    const rows = [
      ["Product", "Inventory", "Daily Sales", "Lead Time", "Days Left", "Status", "Action", "Order Qty"],
      ...products.map((p) => {
        const d = calculate(p);
        return [p.name, p.inventory, p.dailySales, p.leadTime, d.daysLeft === 999 ? "N/A" : d.daysLeft, d.status, d.action, d.orderQuantity || "-"];
      }),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "inventory-report.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const calculated = useMemo(() => products.map(calculate), [products]);

  const u = user as { id: string; email?: string } | null;
  const { getProductHistory, getTrend } = useInventorySnapshots(u?.id ?? "", calculated);

  const filtered = useMemo(() => {
    let list = calculated;
    if (search) list = list.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));
    if (filter !== "all") list = list.filter((p) => p.status === filter);
    return [...list].sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "daysLeft") return a.daysLeft - b.daysLeft;
      if (sortBy === "inventory") return a.inventory - b.inventory;
      return 0;
    });
  }, [calculated, search, filter, sortBy]);

  const stats = useMemo(() => ({
    total: products.length,
    highRisk: calculated.filter((p) => p.status === "High Risk").length,
    mediumRisk: calculated.filter((p) => p.status === "Medium Risk").length,
    healthy: calculated.filter((p) => p.status === "Healthy").length,
  }), [calculated]);

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!user) return <AuthPage onLogin={setUser} />;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-sidebar border-b border-sidebar-border sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-sidebar-primary flex items-center justify-center">
              <svg className="w-4 h-4 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <span className="font-semibold text-sidebar-foreground">StockSense</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-sidebar-foreground/60 hidden sm:block">{u.email}</span>
            <button onClick={() => supabase.auth.signOut()} className="text-sm text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-sidebar-accent">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reorder Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Track inventory levels and get reorder recommendations</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Products", value: stats.total, color: "text-foreground", bg: "bg-card" },
            { label: "High Risk", value: stats.highRisk, color: "text-red-600", bg: "bg-red-50 border-red-100" },
            { label: "Medium Risk", value: stats.mediumRisk, color: "text-amber-600", bg: "bg-amber-50 border-amber-100" },
            { label: "Healthy", value: stats.healthy, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100" },
          ].map((s) => (
            <div key={s.label} className={`${s.bg} border border-card-border rounded-xl p-4 shadow-xs`}>
              <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
              <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {stats.highRisk > 0 && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
            <p className="text-sm font-medium text-red-700">
              {stats.highRisk} product{stats.highRisk > 1 ? "s" : ""} at high risk — reorder immediately to avoid stockout.
            </p>
          </div>
        )}

        <div className="bg-card border border-card-border rounded-xl shadow-xs overflow-hidden">
          <div className="px-4 py-4 border-b border-card-border flex items-center justify-between flex-wrap gap-3">
            <h2 className="font-semibold text-foreground">Products</h2>
            <div className="flex gap-2 items-center">
              <label className={`relative cursor-pointer ${csvLoading ? "opacity-60 pointer-events-none" : ""}`}>
                <input type="file" accept=".csv" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileUpload} />
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-input hover:bg-muted transition-colors text-xs text-muted-foreground">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                  {csvLoading ? "Importing..." : "Import CSV"}
                </span>
              </label>
              <button onClick={() => setAddingProduct(!addingProduct)} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-lg hover:opacity-90 transition-opacity">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Add Product
              </button>
            </div>
          </div>

          {addingProduct && (
            <div className="px-4 py-4 border-b border-card-border bg-muted/30">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                {([
                  { key: "name", placeholder: "Product name", type: "text" },
                  { key: "inventory", placeholder: "Current inventory", type: "number" },
                  { key: "dailySales", placeholder: "Daily sales (units)", type: "number" },
                  { key: "leadTime", placeholder: "Lead time (days)", type: "number" },
                ] as const).map((field) => (
                  <input key={field.key} type={field.type} placeholder={field.placeholder} value={form[field.key]}
                    onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                    className="px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                ))}
              </div>
              {formError && <p className="text-xs text-destructive mb-3">{formError}</p>}
              <div className="flex gap-2">
                <button onClick={addProduct} className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-opacity">Save Product</button>
                <button onClick={() => { setAddingProduct(false); setFormError(""); }} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
              </div>
            </div>
          )}

          <div className="px-4 py-3 border-b border-card-border flex flex-wrap gap-3 items-center justify-between">
            <div className="flex gap-2 items-center flex-wrap">
              <div className="relative">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input type="search" placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 pr-3 py-1.5 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring w-48" />
              </div>
              <div className="flex gap-1 bg-muted rounded-lg p-1">
                {(["all", "High Risk", "Medium Risk", "Healthy"] as const).map((f) => (
                  <button key={f} onClick={() => setFilter(f)} className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${filter === f ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                    {f === "all" ? "All" : f}
                  </button>
                ))}
              </div>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className="text-xs border border-input rounded-lg px-2 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="daysLeft">Sort: Days Left</option>
                <option value="name">Sort: Name</option>
                <option value="inventory">Sort: Inventory</option>
              </select>
            </div>
            {products.length > 0 && (
              <button onClick={exportCSV} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-lg border border-input hover:bg-muted">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Export CSV
              </button>
            )}
          </div>

          {products.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
              </div>
              <p className="text-sm font-medium text-foreground">No products yet</p>
              <p className="text-xs text-muted-foreground mt-1">Add a product above or import a CSV to get started.</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center"><p className="text-sm text-muted-foreground">No products match your filters.</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-card-border">
                    {["Product", "Inventory", "Daily Sales", "Lead Time", "Days Left", "Status", "Order Qty", "Trend", "Actions"].map((h, i) => (
                      <th key={h} className={`text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider ${[1,2,3,6].includes(i) ? "text-right" : ""} ${[3].includes(i) ? "hidden sm:table-cell" : ""} ${[6].includes(i) ? "hidden md:table-cell" : ""} ${[7].includes(i) ? "hidden lg:table-cell" : ""}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-card-border">
                  {filtered.map((data) => {
                    const isEditing = editingId === data.id;
                    return (
                      <tr key={data.id} className={`transition-colors hover:bg-muted/30 ${data.status === "High Risk" ? "bg-red-50/40" : data.status === "Medium Risk" ? "bg-amber-50/30" : ""}`}>
                        <td className="px-4 py-3 font-medium">
                          {isEditing ? <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="w-full px-2 py-1 text-sm rounded border border-input focus:outline-none focus:ring-1 focus:ring-ring" /> : <span className="truncate block max-w-[180px]">{data.name}</span>}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {isEditing ? <input type="number" value={editForm.inventory} onChange={(e) => setEditForm({ ...editForm, inventory: e.target.value })} className="w-24 px-2 py-1 text-sm rounded border border-input focus:outline-none focus:ring-1 focus:ring-ring text-right" /> : data.inventory.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {isEditing ? <input type="number" value={editForm.dailySales} onChange={(e) => setEditForm({ ...editForm, dailySales: e.target.value })} className="w-20 px-2 py-1 text-sm rounded border border-input focus:outline-none focus:ring-1 focus:ring-ring text-right" /> : data.dailySales}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums hidden sm:table-cell">
                          {isEditing ? <input type="number" value={editForm.leadTime} onChange={(e) => setEditForm({ ...editForm, leadTime: e.target.value })} className="w-20 px-2 py-1 text-sm rounded border border-input focus:outline-none focus:ring-1 focus:ring-ring text-right" /> : `${data.leadTime}d`}
                        </td>
                        <td className="px-4 py-3"><DaysLeftBar daysLeft={data.daysLeft} leadTime={data.leadTime} /></td>
                        <td className="px-4 py-3"><StatusBadge status={data.status} /></td>
                        <td className="px-4 py-3 text-right tabular-nums hidden md:table-cell">
                          {data.status === "Healthy" ? <span className="text-muted-foreground">—</span> : <span className="font-semibold">{data.orderQuantity.toLocaleString()}</span>}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <div className="flex flex-col gap-0.5 items-start">
                            <TrendArrow trend={getTrend(data.id)} />
                            <Sparkline data={getProductHistory(data.id).map((h) => h.inventory)} width={56} height={18} />
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {isEditing ? (
                              <>
                                <button onClick={() => saveEdit(data.id)} className="px-2.5 py-1 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:opacity-90">Save</button>
                                <button onClick={() => setEditingId(null)} className="px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => startEdit(data)} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors" title="Edit">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                </button>
                                <button onClick={() => deleteProduct(data.id)} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors" title="Delete">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {filtered.length > 0 && (
            <div className="px-4 py-3 border-t border-card-border bg-muted/30">
              <p className="text-xs text-muted-foreground">Showing {filtered.length} of {products.length} products</p>
            </div>
          )}
        </div>

        <TrendSection calculated={calculated} getProductHistory={getProductHistory} />

        <AIAnalysisSection products={products} calculated={calculated} />

        <ProfitImpactSection calculated={calculated} />

        <AlertSection calculated={calculated} userEmail={u.email ?? ""} />
      </main>

      <footer className="border-t border-card-border py-4 px-6 text-center">
        <p className="text-xs text-muted-foreground">StockSense — Inventory reorder intelligence</p>
      </footer>
    </div>
  );
}
