"use client";

import { useState } from "react";
import { MessageSquare, Send, Sparkles, User, Bot, RefreshCw } from "lucide-react";

interface ChatMessage {
  sender: "user" | "bot";
  text: string;
}

export default function Chatbot() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { sender: "bot", text: "Hello! I am your Grade Change Intelligence Copilot. How can I assist you with process parameters, recipe targets, or status warnings today?" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { sender: "user", text: userMsg }]);
    setLoading(true);

    try {
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${API_BASE_URL}/api/copilot/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg })
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, { sender: "bot", text: data.reply }]);
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => [...prev, { sender: "bot", text: "System exception encountered connecting to AI Engine." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1200px] mx-auto w-full h-[calc(100vh-2rem)] flex flex-col">
      
      {/* Header Banner */}
      <div className="glass-panel p-6 bg-white flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-widest mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            Process Advisory Assistant
          </div>
          <h1 className="font-serif text-3xl font-extrabold text-slate-900 tracking-tight">AI Copilot Assistant</h1>
        </div>
        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
          Live Telemetry Context Bound
        </span>
      </div>

      {/* Main Chat Container */}
      <div className="glass-panel bg-white flex-1 flex flex-col overflow-hidden p-6">
        
        {/* Messages List */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex items-start gap-3 ${msg.sender === "user" ? "flex-row-reverse" : "flex-row"}`}>
              <div className={`p-2 rounded-xl text-white ${msg.sender === "user" ? "bg-blue-600" : "bg-slate-800"}`}>
                {msg.sender === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <div className={`max-w-[75%] p-4 rounded-2xl text-sm leading-relaxed ${
                msg.sender === "user" 
                  ? "bg-blue-600 text-white font-medium" 
                  : "bg-slate-100/90 text-slate-800 border border-slate-200/60 font-medium"
              }`}>
                {msg.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-xs text-slate-400 font-medium italic py-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
              AI Copilot is formulating advice based on telemetry trends...
            </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex gap-3">
          <input 
            type="text" 
            placeholder="Ask questions about steam adjustments, stock flow, or grade transitions..."
            className="flex-1 bg-slate-50 border border-slate-200/90 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
          />
          <button
            onClick={handleSend}
            disabled={loading}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-md shadow-blue-500/20 transition flex items-center gap-2 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            Send
          </button>
        </div>

      </div>

    </div>
  );
}
