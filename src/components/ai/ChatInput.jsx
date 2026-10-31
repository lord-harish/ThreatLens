import React, { useState, useRef, useEffect } from 'react';
import { SendIcon } from '../common/Icons';
import { Button } from '../common/Button';

export function ChatInput({ onSendMessage, isLoading, presetPrompts, onSelectPreset }) {
  const [input, setInput] = useState('');
  const textareaRef = useRef(null);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 100)}px`;
    }
  }, [input]);

  return (
    <div className="space-y-2.5">
      {/* Preset Queries */}
      {presetPrompts && presetPrompts.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-mono">
          <span className="text-[10px] text-slate-500 whitespace-nowrap uppercase tracking-wider">
            Quick Inquiries:
          </span>
          {presetPrompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => onSelectPreset(p.prompt)}
              className="px-2 py-0.5 rounded-xs bg-[#f2e8ec] hover:bg-[#ebdbe1] border border-[#decdd4] text-slate-800 text-[10px] whitespace-nowrap"
            >
              {p.title}
            </button>
          ))}
        </div>
      )}

      {/* Input Field */}
      <form onSubmit={handleSubmit} className="relative enterprise-card p-2 rounded-xs">
        <textarea
          ref={textareaRef}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask ThreatLens AI to evaluate blast radius, draft terraform mitigation, or cite audit standards..."
          className="w-full pl-2 pr-20 py-1 bg-transparent text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none resize-none min-h-[38px]"
        />

        <div className="absolute right-2 bottom-2 flex items-center gap-2">
          <span className="text-[9px] font-mono text-slate-400 hidden sm:inline">
            [Enter] to send
          </span>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={!input.trim() || isLoading}
            loading={isLoading}
            className="px-2.5 py-1"
          >
            <SendIcon className="w-3.5 h-3.5" />
          </Button>
        </div>
      </form>
    </div>
  );
}
