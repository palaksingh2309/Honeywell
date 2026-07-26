"use client";

import { useEffect, useState, useRef } from "react";
import { 
  Play, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  RotateCcw, 
  ChevronRight, 
  ThumbsUp, 
  ThumbsDown,
  Gauge,
  Activity,
  Flame,
  Gauge as SpeedIcon,
  Droplet,
  Printer,
  History,
  Sparkles,
  Layers,
  ArrowUpRight,
  Sliders
} from "lucide-react";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from "recharts";

interface SensorState {
  timestamp: string;
  current_grade: string;
  target_grade: string;
  machine_speed: number;
  steam_pressure: number;
  stock_flow: number;
  moisture: number;
  ash: number;
  caliper: number;
  basis_weight_dev: number;
  is_transitioning: boolean;
  transition_progress: number;
  active_run_id: number | null;
  status: string;
}

interface AIAnalysis {
  status: string;
  confidence: number;
  stabilization_score: number;
  explainability: Record<string, number>;
  recommendations: Array<{
    parameter: string;
    action: string;
    value: string;
    description: string;
  }>;
  similar_runs: Array<any>;
}

export default function Dashboard() {
  const [dataPoints, setDataPoints] = useState<SensorState[]>([]);
  const [currentState, setCurrentState] = useState<SensorState | null>(null);
  const [targetGrade, setTargetGrade] = useState<string>("Grade B");
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<string[]>([]);
  const [feedbackLogged, setFeedbackLogged] = useState<Record<string, string>>({});
  const [feedbackHistory, setFeedbackHistory] = useState<any[]>([]);
  
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const eventSourceRef = useRef<EventSource | null>(null);

  const fetchFeedbackHistory = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/grade-change/feedback`);
      if (res.ok) {
        const history = await res.json();
        setFeedbackHistory(history);
      }
    } catch (err) {
      console.error("Failed to fetch feedback history", err);
    }
  };

  useEffect(() => {
    fetchFeedbackHistory();
  }, []);

  // Subscribe to live SSE sensor feed
  useEffect(() => {
    eventSourceRef.current = new EventSource(`${API_BASE_URL}/api/grade-change/live`);

    eventSourceRef.current.onmessage = (event) => {
      const parsedData: SensorState = JSON.parse(event.data);
      setCurrentState(parsedData);
      
      setDataPoints((prev) => {
        const next = [...prev, parsedData];
        if (next.length > 25) {
          next.shift();
        }
        return next;
      });
    };

    eventSourceRef.current.onerror = () => {
      console.error("SSE connection failed.");
    };

    setTimelineEvents(["System monitoring live steady-state of Grade A."]);

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // Fetch AI Predictions & Recommendations periodically
  useEffect(() => {
    if (!currentState) return;

    const fetchAIAnalysis = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/grade-change/predict`);
        if (res.ok) {
          const analysis: AIAnalysis = await res.json();
          setAiAnalysis(analysis);
          updateTimeline(parsedAnalysisEvents(analysis, currentState));
        }
      } catch (err) {
        console.error("Failed to fetch AI analysis", err);
      }
    };

    fetchAIAnalysis();
  }, [currentState]);

  const updateTimeline = (newEvents: string[]) => {
    setTimelineEvents((prev) => {
      const filtered = newEvents.filter(e => !prev.includes(e));
      if (filtered.length > 0) {
        const updated = [...filtered, ...prev];
        return updated.slice(0, 10);
      }
      return prev;
    });
  };

  const parsedAnalysisEvents = (analysis: AIAnalysis, state: SensorState): string[] => {
    const events: string[] = [];
    if (state.is_transitioning) {
      events.push(`Grade transition in progress: ${state.current_grade} → ${state.target_grade} (${state.transition_progress}%).`);
    }
    if (analysis.status === "Warning") {
      events.push(`AI triggered WARNING: Basis weight deviation shifted to ${state.basis_weight_dev}%.`);
    }
    if (analysis.status === "Critical") {
      events.push(`AI triggered CRITICAL: Out of spec bounds breached.`);
    }
    if (analysis.recommendations.length > 0) {
      events.push(`AI setpoint corrective suggestions compiled.`);
    }
    return events;
  };

  const handleStartGradeChange = async () => {
    if (!currentState) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/grade-change/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_grade: currentState.current_grade,
          to_grade: targetGrade
        })
      });
      if (res.ok) {
        const data = await res.json();
        setTimelineEvents((prev) => [
          `Operator initiated Grade Change run #${data.run_id} to ${targetGrade}.`,
          ...prev
        ]);
        setFeedbackLogged({});
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleApplyTweak = async (param: string, action: string) => {
    let speed_tweak = 0;
    let steam_tweak = 0;
    let stock_tweak = 0;

    if (param === "steam_pressure") {
      steam_tweak = action === "Increase" ? 0.15 : -0.10;
    } else if (param === "machine_speed") {
      speed_tweak = action === "Increase" ? 15 : -10;
    } else if (param === "stock_flow") {
      stock_tweak = action === "Increase" ? 100 : -80;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/grade-change/tweak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ speed_tweak, steam_tweak, stock_tweak })
      });
      if (res.ok) {
        await fetch(`${API_BASE_URL}/api/grade-change/feedback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recommendation: `${action} ${param}`,
            action: "Accepted",
            notes: "Manually adjusted through recommendation panel"
          })
        });

        fetchFeedbackHistory();
        setFeedbackLogged(prev => ({ ...prev, [param]: "Accepted" }));
        setTimelineEvents(prev => [
          `Operator accepted recommendation: Adjusted ${param.replace("_", " ")} ${action === "Increase" ? "+" : "-"}.`,
          ...prev
        ]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRejectTweak = async (param: string, action: string) => {
    try {
      await fetch(`${API_BASE_URL}/api/grade-change/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recommendation: `${action} ${param}`,
          action: "Rejected",
          notes: "Operator rejected suggestion."
        })
      });
      fetchFeedbackHistory();
      setFeedbackLogged(prev => ({ ...prev, [param]: "Rejected" }));
      setTimelineEvents(prev => [
        `Operator rejected recommendation for ${param.replace("_", " ")}.`,
        ...prev
      ]);
    } catch (err) {
      console.error(err);
    }
  };

  const formatFeatureLabel = (key: string) => {
    return key.replace("_", " ").toUpperCase();
  };

  const explainabilityData = aiAnalysis?.explainability 
    ? Object.entries(aiAnalysis.explainability).map(([name, value]) => ({
        name: formatFeatureLabel(name),
        contribution: value
      })).sort((a, b) => b.contribution - a.contribution)
    : [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Safe": return "text-emerald-700 border-emerald-300 bg-emerald-50";
      case "Warning": return "text-amber-700 border-amber-300 bg-amber-50";
      case "Critical": return "text-rose-700 border-rose-300 bg-rose-50";
      default: return "text-slate-700 border-slate-300 bg-slate-50";
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case "Safe": return "glow-safe";
      case "Warning": return "glow-warning";
      case "Critical": return "glow-critical";
      default: return "border-slate-200";
    }
  };

  const barColors = ["#2563eb", "#059669", "#d97706", "#0d9488", "#6366f1", "#e11d48"];

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1500px] mx-auto w-full">
      
      {/* Header Command Center Banner */}
      <div className="glass-panel p-6 bg-white flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-widest mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            Process Intelligence Command Center
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-1">
            <h1 className="font-serif text-3xl font-extrabold text-slate-900 tracking-tight">Active Operation Dashboard</h1>
            {currentState && (
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${getStatusColor(aiAnalysis?.status || currentState.status)}`}>
                {aiAnalysis?.status || currentState.status} ({aiAnalysis?.confidence || 95}% CONF)
              </span>
            )}
          </div>
        </div>
        
        {currentState && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-slate-50 border border-slate-200/90 rounded-xl px-4 py-2">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Current Grade</span>
              <span className="text-sm font-bold text-slate-900 font-sans">{currentState.current_grade}</span>
            </div>
            
            <ChevronRight className="w-4 h-4 text-slate-400 hidden sm:block" />
            
            <div className="bg-slate-50 border border-slate-200/90 rounded-xl px-3.5 py-1.5 flex items-center gap-3">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Target Grade</span>
                <select 
                  className="bg-transparent text-sm font-bold text-slate-900 focus:outline-none cursor-pointer pr-2"
                  value={targetGrade}
                  onChange={(e) => setTargetGrade(e.target.value)}
                  disabled={currentState.is_transitioning}
                >
                  <option value="Grade A">Grade A (80gsm Copy)</option>
                  <option value="Grade B">Grade B (120gsm Board)</option>
                  <option value="Grade C">Grade C (60gsm News)</option>
                  <option value="Grade D">Grade D (150gsm Card)</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleStartGradeChange}
              disabled={currentState.is_transitioning}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-md ${
                currentState.is_transitioning
                  ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20 cursor-pointer"
              }`}
            >
              <Play className="w-4 h-4 fill-current" />
              Transition Grade
            </button>

            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition-all shadow-xs cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-500" />
              Export PDF Report
            </button>
          </div>
        )}
      </div>

      {/* KPI Stats Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Stabilization Time", val: currentState?.is_transitioning ? `${currentState.transition_progress}%` : "18.5 mins", desc: "Avg stabilization speed", color: "text-blue-600" },
          { label: "Predicted Waste Saved", val: "3.4 tons", desc: "Cumulative waste offset", color: "text-emerald-600" },
          { label: "Successful Changes", val: "148 / 152", desc: "97.3% success rate", color: "text-indigo-600" },
          { label: "AI Rec Accuracy", val: "94.2%", desc: "Validation confidence", color: "text-teal-600" },
          { label: "Operator Acceptance", val: "88%", desc: "Recommendation compliance", color: "text-amber-600" }
        ].map((kpi, idx) => (
          <div key={idx} className="glass-panel p-5 bg-white flex flex-col justify-between">
            <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400">{kpi.label}</span>
            <div className="my-3">
              <span className={`text-2xl font-black tracking-tight ${kpi.color}`}>{kpi.val}</span>
            </div>
            <span className="text-[11px] text-slate-500 font-medium">{kpi.desc}</span>
          </div>
        ))}
      </div>

      {/* Main 2-Column Dashboard Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Columns (Col Span 2) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Live Process Telemetry Chart */}
          <div className="glass-panel p-6 bg-white">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="font-serif font-bold text-slate-900 text-xl tracking-tight">Live Telemetry Trends</h2>
                <p className="text-xs text-slate-500 mt-0.5">Real-time telemetry feeds of paper machine speed, steam pressure, and pulp slurry stock flow</p>
              </div>
              <div className="flex items-center gap-4 text-xs font-semibold">
                <span className="flex items-center gap-1.5 text-blue-600"><span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span> Speed</span>
                <span className="flex items-center gap-1.5 text-amber-600"><span className="w-2.5 h-2.5 rounded-full bg-amber-600"></span> Steam</span>
                <span className="flex items-center gap-1.5 text-emerald-600"><span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span> Stock Flow</span>
              </div>
            </div>

            <div className="h-[300px] w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dataPoints}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="timestamp" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "#ffffff", borderColor: "#e2e8f0", borderRadius: "12px", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.05)", fontSize: "12px" }} 
                  />
                  <Line type="monotone" dataKey="machine_speed" stroke="#2563eb" strokeWidth={2.5} dot={false} name="Speed (m/min)" />
                  <Line type="monotone" dataKey="steam_pressure" stroke="#d97706" strokeWidth={2.5} dot={false} name="Steam (bar)" />
                  <Line type="monotone" dataKey="stock_flow" stroke="#059669" strokeWidth={2} dot={false} name="Stock Flow (L/min)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Key Process Sensor Telemetry Grid */}
          {currentState && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { name: "Machine Speed", val: currentState.machine_speed, unit: "m/min", icon: SpeedIcon, color: "text-blue-600", bg: "bg-blue-50" },
                { name: "Steam Pressure", val: currentState.steam_pressure, unit: "bar", icon: Flame, color: "text-amber-600", bg: "bg-amber-50" },
                { name: "Stock Flow", val: currentState.stock_flow, unit: "L/min", icon: Activity, color: "text-emerald-600", bg: "bg-emerald-50" },
                { name: "Moisture Content", val: currentState.moisture, unit: "%", icon: Droplet, color: "text-teal-600", bg: "bg-teal-50" },
                { name: "Ash Content", val: currentState.ash, unit: "%", icon: Layers, color: "text-indigo-600", bg: "bg-indigo-50" },
                { name: "Caliper Thickness", val: currentState.caliper, unit: "mm", icon: Gauge, color: "text-purple-600", bg: "bg-purple-50" }
              ].map((sensor, idx) => {
                const Icon = sensor.icon;
                return (
                  <div key={idx} className="glass-panel p-4 bg-white flex items-center justify-between">
                    <div>
                      <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">{sensor.name}</span>
                      <div className="text-xl font-bold text-slate-900 mt-1 font-sans">
                        {sensor.val} <span className="text-xs font-normal text-slate-400">{sensor.unit}</span>
                      </div>
                    </div>
                    <div className={`p-3 rounded-xl ${sensor.bg}`}>
                      <Icon className={`w-5 h-5 ${sensor.color}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* SHAP Root Cause Analysis */}
          <div className="glass-panel p-6 bg-white">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="font-serif font-bold text-slate-900 text-xl tracking-tight">SHAP Root Cause Feature Importance</h2>
                <p className="text-xs text-slate-500 mt-0.5">Machine learning TreeExplainer parameters driving active deviation predictions</p>
              </div>
              <span className="text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full">
                XGBoost SHAP XAI
              </span>
            </div>

            {explainabilityData.length > 0 ? (
              <div className="h-[220px] w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={explainabilityData} layout="vertical" margin={{ left: 20, right: 30, top: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" stroke="#94a3b8" fontSize={11} unit="%" tickLine={false} axisLine={false} />
                    <YAxis dataKey="name" type="category" stroke="#475569" fontSize={11} width={130} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: "#ffffff", borderColor: "#e2e8f0", borderRadius: "12px", fontSize: "12px" }} />
                    <Bar dataKey="contribution" radius={[0, 8, 8, 0]} barSize={16}>
                      {explainabilityData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={barColors[index % barColors.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-xs text-slate-400 py-12 text-center border border-dashed border-slate-200 rounded-xl">
                Computing real-time SHAP feature importance vectors...
              </div>
            )}
          </div>

          {/* Similar Historical Runs Matcher */}
          <div className="glass-panel p-6 bg-white">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="font-serif font-bold text-slate-900 text-xl tracking-tight">Similar Historical Transition Runs</h2>
                <p className="text-xs text-slate-500 mt-0.5">Top 3 closest successful past transitions retrieved via KNN Cosine Similarity</p>
              </div>
              <span className="text-xs text-slate-500 bg-slate-100 border border-slate-200 px-3 py-1 rounded-full font-semibold">
                KNN Cosine Search
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {aiAnalysis?.similar_runs && aiAnalysis.similar_runs.length > 0 ? (
                aiAnalysis.similar_runs.map((run, idx) => (
                  <div key={idx} className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/80 flex flex-col justify-between hover:border-slate-300 transition">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-800">Run #{run.run_id}</span>
                        <span className="text-xs font-bold text-blue-700 bg-blue-100/70 border border-blue-200 px-2.5 py-0.5 rounded-full">
                          {run.similarity}% Match
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 space-y-1.5 mt-3">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Route:</span>
                          <span className="font-semibold text-slate-800">{run.from_grade} → {run.to_grade}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Stabilization:</span>
                          <span className="font-semibold text-slate-800">{run.stabilization_time} mins</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Waste Generated:</span>
                          <span className="font-semibold text-slate-800">{run.waste_tons} tons</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-3 text-xs text-slate-400 py-8 text-center border border-dashed border-slate-200 rounded-xl">
                  Searching historical similarity matrix for matching runs...
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Right Column (Col Span 1) */}
        <div className="space-y-6">

          {/* Stability Gauge Card */}
          <div className={`glass-panel p-6 bg-white ${getStatusBg(aiAnalysis?.status || "Safe")}`}>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">Process Status</span>
            <div className="flex items-center justify-between my-3">
              <h3 className="font-serif text-3xl font-extrabold text-slate-900 tracking-tight">
                {aiAnalysis?.status || "Safe"}
              </h3>
              <span className={`text-xl font-black ${getStatusColor(aiAnalysis?.status || "Safe")}`}>
                {aiAnalysis?.stabilization_score || 95}/100
              </span>
            </div>

            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden my-3 border border-slate-200/60">
              <div 
                className={`h-full transition-all duration-500 ${
                  (aiAnalysis?.stabilization_score || 95) > 75 
                    ? "bg-emerald-500" 
                    : (aiAnalysis?.stabilization_score || 95) > 50 
                      ? "bg-amber-500" 
                      : "bg-rose-500"
                }`}
                style={{ width: `${aiAnalysis?.stabilization_score || 95}%` }}
              ></div>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Calculated Stabilization Health Index based on basis weight tolerance ($\pm 2.5\%$).
            </p>
          </div>

          {/* AI Active Recommendations */}
          <div className="glass-panel p-6 bg-white">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <h2 className="font-serif font-bold text-slate-900 text-lg tracking-tight">Corrective Setpoints</h2>
              <span className="text-[10px] text-blue-700 font-bold uppercase bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
                AI Advisory
              </span>
            </div>

            <div className="space-y-3.5">
              {aiAnalysis?.recommendations && aiAnalysis.recommendations.length > 0 ? (
                aiAnalysis.recommendations.map((rec, idx) => {
                  const isAccepted = feedbackLogged[rec.parameter] === "Accepted";
                  const isRejected = feedbackLogged[rec.parameter] === "Rejected";

                  return (
                    <div key={idx} className="p-4 rounded-xl bg-slate-50 border border-slate-200/90 flex flex-col justify-between gap-3">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                            {rec.parameter.replace("_", " ")}
                          </span>
                          <span className="text-xs font-bold text-blue-700 bg-blue-100/70 border border-blue-200 px-2 py-0.5 rounded-md">
                            {rec.action} {rec.value}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed font-medium">
                          {rec.description}
                        </p>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/60">
                        {isAccepted ? (
                          <span className="text-xs text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg">
                            ✓ Applied
                          </span>
                        ) : isRejected ? (
                          <span className="text-xs text-rose-700 font-bold bg-rose-50 border border-rose-200 px-3 py-1 rounded-lg">
                            ✗ Dismissed
                          </span>
                        ) : (
                          <>
                            <button
                              onClick={() => handleRejectTweak(rec.parameter, rec.action)}
                              className="p-2 rounded-lg bg-white hover:bg-rose-50 hover:text-rose-600 text-slate-400 transition border border-slate-200 cursor-pointer shadow-2xs"
                              title="Dismiss suggestion"
                            >
                              <ThumbsDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleApplyTweak(rec.parameter, rec.action)}
                              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
                            >
                              <ThumbsUp className="w-3.5 h-3.5 fill-current" />
                              Apply Adjust
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-xs text-slate-400 py-8 text-center border border-dashed border-slate-200 rounded-xl">
                  No active recommendations required. Steady-state operational bounds intact.
                </div>
              )}
            </div>
          </div>

          {/* Smart Timeline */}
          <div className="glass-panel p-6 bg-white">
            <h2 className="font-serif font-bold text-slate-900 text-lg tracking-tight mb-4">Smart Timeline Log</h2>
            <div className="relative pl-4 border-l-2 border-slate-100 space-y-4">
              {timelineEvents.map((event, i) => (
                <div key={i} className="relative">
                  <span className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-blue-600 ring-4 ring-blue-50"></span>
                  <p className="text-xs text-slate-700 font-medium leading-relaxed">{event}</p>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* Operator Feedback History & Compliance Log */}
      <div className="glass-panel p-6 bg-white w-full mt-6 print:break-inside-avoid">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="font-serif font-bold text-slate-900 text-xl tracking-tight">Operator Compliance Audit Log</h2>
            <p className="text-xs text-slate-500 mt-0.5">Chronological record of human-in-the-loop decisions for model reinforcement</p>
          </div>
          <span className="text-xs text-slate-700 bg-slate-100 border border-slate-200 px-3 py-1 rounded-full font-bold self-start sm:self-auto">
            {feedbackHistory.length} Decision(s) Logged
          </span>
        </div>

        <div className="overflow-x-auto">
          {feedbackHistory.length > 0 ? (
            <table className="min-w-full divide-y divide-slate-100">
              <thead>
                <tr className="text-left text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50/80">
                  <th className="py-3 px-4 rounded-l-xl">Timestamp</th>
                  <th className="py-3 px-4">Recommendation</th>
                  <th className="py-3 px-4">Operator Action</th>
                  <th className="py-3 px-4 rounded-r-xl">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {feedbackHistory.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 font-mono text-slate-500">
                      {new Date(row.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} ({new Date(row.timestamp).toLocaleDateString()})
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {row.recommendation}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        row.action === 'Accepted' 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {row.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-medium">
                      {row.notes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-xs text-slate-400 py-8 text-center border border-dashed border-slate-200 rounded-xl">
              No operator decisions logged for the active session.
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
