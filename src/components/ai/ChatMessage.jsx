import React, { useState } from 'react';
import { CopyIcon, CheckIcon, ChevronRightIcon, FileTextIcon } from '../common/Icons';
import { useThreat } from '../../context/ThreatContext';

export function ChatMessage({ message, onSelectCitation }) {
  const isAssistant = message.sender === 'assistant';
  const { showToast } = useThreat();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    showToast('AI response copied to clipboard.', 'info');
    setTimeout(() => setCopied(false), 2000);
  };

  const renderFormattedContent = (content) => {
    const lines = content.split('\n');
    let inCodeBlock = false;
    let codeBuffer = [];
    const elements = [];

    lines.forEach((line, index) => {
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          elements.push(
            <div key={`code-${index}`} className="my-2 rounded-xs bg-[#0f172a] text-slate-100 p-3 font-mono text-[11px] overflow-x-auto border border-slate-800">
              <pre className="whitespace-pre-wrap">{codeBuffer.join('\n')}</pre>
            </div>
          );
          codeBuffer = [];
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
        }
        return;
      }

      if (inCodeBlock) {
        codeBuffer.push(line);
        return;
      }

      if (line.startsWith('### ')) {
        elements.push(
          <h4 key={index} className="text-xs font-mono font-bold uppercase tracking-wider text-slate-900 mt-2.5 mb-1">
            {line.replace('### ', '').replace(/[^\x00-\x7F]/g, "")}
          </h4>
        );
      } else if (line.startsWith('#### ')) {
        elements.push(
          <h5 key={index} className="text-[11px] font-mono font-bold text-[#0369a1] uppercase mt-2 mb-0.5">
            {line.replace('#### ', '').replace(/[^\x00-\x7F]/g, "")}
          </h5>
        );
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        elements.push(
          <li key={index} className="ml-4 list-disc text-xs text-slate-700 my-0.5 leading-relaxed font-sans">
            {renderInlineMarkdown(line.substring(2))}
          </li>
        );
      } else if (line.trim().startsWith('|')) {
        elements.push(
          <div key={index} className="font-mono text-[11px] text-slate-800 my-0.5 overflow-x-auto">
            {line}
          </div>
        );
      } else if (line.trim() === '') {
        elements.push(<div key={index} className="h-1" />);
      } else {
        elements.push(
          <p key={index} className="text-xs text-slate-800 leading-relaxed my-1 font-sans">
            {renderInlineMarkdown(line)}
          </p>
        );
      }
    });

    return elements;
  };

  const renderInlineMarkdown = (text) => {
    // Strip emojis
    const cleanText = text.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
    const parts = cleanText.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={i} className="font-mono text-[11px] px-1 py-0.2 rounded-xs bg-[#f2e8ec] text-slate-900 font-semibold border border-[#decdd4]">
            {part.slice(1, -1)}
          </code>
        );
      }
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-bold text-slate-900">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <div className={`p-3.5 rounded-xs enterprise-card space-y-2 ${isAssistant ? 'bg-[#fefcfd]' : 'bg-[#fbf7f8]'}`}>
      <div className="flex items-center justify-between pb-1.5 border-b border-[#f0e3e7] text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className={`px-1.5 py-0.2 rounded-xs text-[10px] font-bold ${
            isAssistant 
              ? 'bg-[#0369a1] text-white' 
              : 'bg-[#0f172a] text-white'
          }`}>
            {isAssistant ? 'THREATLENS EVIDENCE ASSISTANT' : 'YOU'}
          </span>
          <span className="text-[10px] text-slate-400">
            {message.timestamp}
          </span>
        </div>

        {isAssistant && (
          <button
            onClick={handleCopy}
            className="p-1 text-slate-400 hover:text-slate-800"
            title="Copy Answer"
          >
            {copied ? <CheckIcon className="w-3.5 h-3.5 text-[#047857]" /> : <CopyIcon className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      <div className="space-y-1">
        {renderFormattedContent(message.content)}
      </div>

      {/* Embedded Citations */}
      {message.citations && message.citations.length > 0 && (
        <div className="mt-3 pt-2.5 border-t border-[#f0e3e7] space-y-1.5">
          <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <FileTextIcon className="w-3.5 h-3.5 text-[#0369a1]" />
            Audit Evidence Citations ({message.citations.length})
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {message.citations.map((cite, idx) => (
              <div
                key={idx}
                onClick={() => onSelectCitation && onSelectCitation(cite)}
                className="p-2 rounded-xs bg-[#fbf7f8] border border-[#decdd4] text-xs hover:border-[#0369a1] cursor-pointer"
              >
                <div className="flex items-center justify-between text-[11px] font-bold font-mono text-slate-900">
                  <span className="truncate">{cite.source}</span>
                  <ChevronRightIcon className="w-3 h-3 text-slate-400" />
                </div>
                <div className="text-[10px] font-mono text-[#0369a1] mt-0.5">
                  {cite.page_number ? `Page ${cite.page_number}` : 'Page not specified'}
                  {cite.section_reference ? ` · ${cite.section_reference}` : ''}
                </div>
                <p className="text-[10px] text-slate-600 mt-1 line-clamp-2 font-sans">
                  {cite.evidence_excerpt}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
