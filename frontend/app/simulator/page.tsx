"use client";

import { useState } from "react";
import { 
  Sliders, 
  HelpCircle, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  TrendingDown, 
  Zap,
  Gauge,
  Cpu,
  Sparkles,
  ArrowRight
} from "lucide-react";

interface SimulationResult {
  success_probability: number;
  predicted_stabilization_time: number;
  predicted_waste_saved_tons: number;
  status: string;
  reasons: string[];
}

export default function Simulator() {
  const [fromGrade, setFromGrade] = useState("Grade A");
  const [toGrade, setToGrade] = useState("Grade B");
  
  // Slide parameter controls
  const [speed, setSpeed] = useState(380);
  const [steam, setSteam] = useState(2.8);
  const [stockFlow, setStockFlow] = useState(2850);
  const [moisture, setMoisture] = useState(5.8);
  const [ash, setAsh] = useState(11.2);
  const [caliper, setCaliper] = useState(0.14);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);

  const handleRunSimulation = async () => {
    setLoading(true);
    try {
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${API_BASE_URL}/api/grade-change/twin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_grade: fromGrade,
          to_grade: toGrade,
          machine_speed: speed,
          steam_pressure: steam,
          stock_flow: stockFlow,
          moisture,
          ash,
          caliper
        })
      });
      if (res.ok) {
        const data = await res.json();
        setResult(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1500px] mx-auto w-full">
      
      {/* Header Banner */}
      <div className="glass-panel p-6 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-widest mb-1">
            <Cpu className="w-3.5 h-3.5" />
            Digital Twin What-If Laboratory
          </div>
          <h1 className="font-serif text-3xl font-extrabold text-slate-900 tracking-tight">Process Variable Simulator</h1>
        </div>
        <p className="text-xs text-slate-500 max-w-md">
          Experiment with machine speed, steam pressure, and stock flow setpoints in real-time without risking physical pulp slurry waste or paper machine downtime.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Sliders Input Panel (Col Span 2) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Target Transition Route */}
          <div className="glass-panel p-6 bg-white">
            <h2 className="font-serif font-bold text-slate-900 text-xl tracking-tight mb-4">Grade Transition Pair</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Source Grade (From)</label>
                <select 
                  className="w-full bg-slate-50 border border-slate-200/90 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-900 focus:outline-none cursor-pointer"
                  value={fromGrade}
                  onChange={(e) => setFromGrade(e.target.value)}
                >
                  <option value="Grade A">Grade A (80gsm Copy)</option>
                  <option value="Grade B">Grade B (120gsm Board)</option>
                  <option value="Grade C">Grade C (60gsm News)</option>
                  <option value="Grade D">Grade D (150gsm Card)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Destination Grade (To)</label>
                <select 
                  className="w-full bg-slate-50 border border-slate-200/90 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-900 focus:outline-none cursor-pointer"
                  value={toGrade}
                  onChange={(e) => setToGrade(e.target.value)}
                >
                  <option value="Grade A">Grade A (80gsm Copy)</option>
                  <option value="Grade B">Grade B (120gsm Board)</option>
                  <option value="Grade C">Grade C (60gsm News)</option>
                  <option value="Grade D">Grade D (150gsm Card)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Interactive Setpoint Sliders */}
          <div className="glass-panel p-6 bg-white space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="font-serif font-bold text-slate-900 text-xl tracking-tight">Simulated Setpoints</h2>
                <p className="text-xs text-slate-500 mt-0.5">Drag control sliders to simulate custom operational setpoint conditions</p>
              </div>
              <Sliders className="w-5 h-5 text-blue-600" />
            </div>

            <div className="space-y-6">
              {[
                { label: "Machine Speed", val: speed, set: setSpeed, min: 250, max: 600, unit: "m/min", step: 5 },
                { label: "Steam Pressure", val: steam, set: setSteam, min: 1.5, max: 4.5, unit: "bar", step: 0.1 },
                { label: "Stock Flow Slurry", val: stockFlow, set: setStockFlow, min: 2000, max: 4000, unit: "L/min", step: 25 },
                { label: "Sheet Moisture", val: moisture, set: setMoisture, min: 3.5, max: 8.5, unit: "%", step: 0.1 },
                { label: "Ash Content", val: ash, set: setAsh, min: 4.0, max: 20.0, unit: "%", step: 0.2 },
                { label: "Caliper Thickness", val: caliper, set: setCaliper, min: 0.05, max: 0.25, unit: "mm", step: 0.01 }
              ].map((slider, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="flex justify-between items-center text-sm font-semibold">
                    <span className="text-slate-700">{slider.label}</span>
                    <span className="text-blue-600 font-bold font-sans bg-blue-50 px-2.5 py-0.5 rounded-lg border border-blue-100">
                      {slider.val} {slider.unit}
                    </span>
                  </div>
                  <input 
                    type="range" 
                    min={slider.min} 
                    max={slider.max} 
                    step={slider.step}
                    value={slider.val}
                    onChange={(e) => slider.set(parseFloat(e.target.value))}
                    className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>
              ))}
            </div>

            <button
              onClick={handleRunSimulation}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-md shadow-blue-500/20 transition cursor-pointer"
            >
              {loading ? (
                <span>Executing What-If Neural Engine...</span>
              ) : (
                <>
                  <Zap className="w-4 h-4 fill-current" />
                  Run Twin Simulation
                </>
              )}
            </button>
          </div>

        </div>

        {/* Results Panel (Col Span 1) */}
        <div className="space-y-6">
          
          <div className="glass-panel p-6 bg-white space-y-6">
            <h2 className="font-serif font-bold text-slate-900 text-xl tracking-tight border-b border-slate-100 pb-3">Simulation Report</h2>

            {result ? (
              <div className="space-y-5">
                
                {/* Status Badge */}
                <div className={`p-4 rounded-xl border flex items-center gap-3 ${
                  result.status === "Safe" 
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
                    : result.status === "Warning" 
                      ? "bg-amber-50 border-amber-200 text-amber-800" 
                      : "bg-rose-50 border-rose-200 text-rose-800"
                }`}>
                  {result.status === "Safe" ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="w-6 h-6 text-amber-600" />
                  )}
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider block">Predicted Outcome</span>
                    <span className="font-bold text-base">{result.status} Transition</span>
                  </div>
                </div>

                {/* Metrics */}
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Success Probability</span>
                    <span className="text-xl font-black text-blue-600 font-sans">{result.success_probability}%</span>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Stabilization Time</span>
                    <span className="text-xl font-black text-slate-900 font-sans">{result.predicted_stabilization_time} mins</span>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Waste Reduction</span>
                    <span className="text-xl font-black text-emerald-600 font-sans">{result.predicted_waste_saved_tons} tons</span>
                  </div>
                </div>

                {/* Diagnostic Reasons */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Model Diagnostic Reasons</span>
                  <div className="space-y-1.5">
                    {result.reasons.map((reason, idx) => (
                      <div key={idx} className="p-2.5 rounded-lg bg-slate-50 text-xs text-slate-700 border border-slate-200/60 font-medium">
                        • {reason}
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            ) : (
              <div className="text-xs text-slate-400 py-16 text-center border border-dashed border-slate-200 rounded-xl space-y-2">
                <Sparkles className="w-8 h-8 text-slate-300 mx-auto" />
                <p>Adjust the sliders and click <br /><strong className="text-slate-600 font-semibold">Run Twin Simulation</strong> to generate predictions.</p>
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
