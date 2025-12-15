"use client";

import { useState, useRef, useEffect } from "react";
import { Mic, Send, Keyboard, X } from "lucide-react";
import { addTask } from "@/app/actions";

export default function VoiceCommander() {
  const [isOpen, setIsOpen] = useState(false); // Is the panel open?
  const [isListening, setIsListening] = useState(false);
  const [text, setText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Ref for the input to auto-focus
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Initialize Speech Logic
  let recognition: any = null;
  if (typeof window !== "undefined" && (window as any).webkitSpeechRecognition) {
    recognition = new (window as any).webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.lang = "en-US";
    recognition.interimResults = true;
  }

  // --- Voice Handlers ---
  const startListening = () => {
    if (!recognition) {
      // Fallback for iOS/Unsupported browsers: Just open the text box
      setIsOpen(true);
      setTimeout(() => inputRef.current?.focus(), 100); // Focus after render
      return;
    }

    setIsOpen(true);
    setIsListening(true);
    setText("");
    recognition.start();

    recognition.onresult = (event: any) => {
      const current = event.resultIndex;
      const transcript = event.results[current][0].transcript;
      setText(transcript);
    };

    recognition.onend = () => {
      setIsListening(false);
      // Auto-focus the text box so user can edit errors immediately
      inputRef.current?.focus();
    };
  };

  // --- Submit Handler ---
  const handleSend = async () => {
    if (!text.trim()) return;
    
    setIsProcessing(true);
    await addTask(text);
    
    // Cleanup
    setIsProcessing(false);
    setText("");
    setIsOpen(false);
  };

  return (
    <>
      {/* 1. The Floating Action Button (FAB) */}
      {!isOpen && (
        <button
          onClick={startListening}
          className={`fixed bottom-6 right-6 h-16 w-16 rounded-full shadow-2xl flex items-center justify-center transition-all active:scale-90 z-40 ${
            isListening ? "bg-red-500 animate-pulse" : "bg-white"
          }`}
        >
          {isListening ? (
            <Mic className="text-white" size={32} />
          ) : (
            // Show Mic icon, but it works as a generic "Add" button
            <Mic className="text-black" size={28} />
          )}
        </button>
      )}

      {/* 2. The Input Panel (Replaces the FAB when active) */}
      {isOpen && (
        <div className="fixed inset-x-0 bottom-0 p-4 z-50 animate-in slide-in-from-bottom-10 duration-200">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-4 shadow-2xl ring-1 ring-white/10">
            
            {/* Header: Status */}
            <div className="flex justify-between items-center mb-3 px-1">
              <span className="text-xs font-bold uppercase text-neutral-500 tracking-wider">
                {isListening ? "Listening..." : "New Task"}
              </span>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-neutral-500 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            {/* The Text Input Area */}
            <textarea
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. Read Book 10 pts Spiritual"
              className="w-full bg-transparent text-white text-lg font-medium placeholder:text-neutral-700 focus:outline-none resize-none mb-4"
              rows={2}
              onKeyDown={(e) => {
                // Allow Ctrl+Enter to submit
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend();
              }}
            />

            {/* Action Bar */}
            <div className="flex items-center justify-between">
              {/* Left: Re-trigger Voice (if supported) */}
              <button 
                onClick={startListening}
                className="p-3 rounded-full bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white transition-colors"
                title="Restart Voice"
              >
                <Mic size={20} />
              </button>

              {/* Right: Submit Button */}
              <button 
                onClick={handleSend}
                disabled={!text.trim() || isProcessing}
                className="py-3 px-6 rounded-xl bg-white text-black font-bold text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? "Adding..." : "Add Task"} 
                {!isProcessing && <Send size={16} />}
              </button>
            </div>

          </div>
        </div>
      )}
      
      {/* Backdrop (Click to close) */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-30 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}