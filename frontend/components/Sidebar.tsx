"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { 
  LayoutDashboard, 
  Cpu, 
  MessageSquare, 
  Upload, 
  Radio, 
  Layers
} from "lucide-react";

export default function Sidebar() {
  const pathname = usePathname();
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const res = await fetch(`${API_BASE_URL}/api/recipes`);
        if (res.ok) {
          setBackendOnline(true);
        } else {
          setBackendOnline(false);
        }
      } catch (err) {
        setBackendOnline(false);
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const menuItems = [
    { name: "Live Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Digital Twin", href: "/simulator", icon: Cpu },
    { name: "AI Copilot Chat", href: "/chatbot", icon: MessageSquare },
    { name: "Upload Dataset", href: "/upload", icon: Upload },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200/80 flex flex-col h-screen sticky top-0 z-30 shadow-sm">
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-100 flex items-center gap-3.5">
        <div className="bg-blue-600 text-white p-2.5 rounded-xl shadow-md shadow-blue-500/20">
          <Layers className="w-6 h-6" />
        </div>
        <div>
          <h1 className="font-serif font-bold text-slate-900 tracking-tight leading-tight text-lg">APEX GRADE</h1>
          <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wider block mt-0.5">Intelligence System</span>
        </div>
      </div>

      {/* Nav Menu */}
      <nav className="flex-1 p-4 space-y-1.5">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200 group ${
                isActive 
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20 font-semibold" 
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
              }`}
            >
              <Icon className={`w-5 h-5 transition-transform duration-200 group-hover:scale-105 ${
                isActive ? "text-white" : "text-slate-500 group-hover:text-blue-600"
              }`} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Connection & Status Panel */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/50">
        <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2">
            <Radio className={`w-4 h-4 ${
              backendOnline === true ? "text-emerald-500 animate-pulse" : "text-rose-500"
            }`} />
            <span className="text-xs text-slate-700 font-semibold">
              API Engine
            </span>
          </div>
          <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wide ${
            backendOnline === true 
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
              : backendOnline === false 
                ? "bg-rose-50 text-rose-700 border border-rose-200"
                : "bg-slate-100 text-slate-600 border border-slate-200"
          }`}>
            {backendOnline === true ? "ONLINE" : backendOnline === false ? "OFFLINE" : "CHECKING"}
          </span>
        </div>
        <div className="mt-3 text-center">
          <span className="text-[10px] text-slate-400 font-mono">
            SYS v1.0.0 • Honeywell Hackathon
          </span>
        </div>
      </div>
    </aside>
  );
}
