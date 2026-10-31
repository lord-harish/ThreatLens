import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  INITIAL_CONVERSATION, 
  PRESET_PROMPTS, 
  MOCK_AI_RESPONSES 
} from '../data/mockAiConversations';
import { ChatMessage } from '../components/ai/ChatMessage';
import { ChatInput } from '../components/ai/ChatInput';
import { EvidenceCitationPanel } from '../components/ai/EvidenceCitationPanel';
import { useThreat } from '../context/ThreatContext';

export function AiAssistantPage() {
  const [searchParams] = useSearchParams();
  const { showToast } = useThreat();
  const [messages, setMessages] = useState(INITIAL_CONVERSATION);
  const [isLoading, setIsLoading] = useState(false);
  const [activeCitation, setActiveCitation] = useState(
    INITIAL_CONVERSATION[2]?.citations?.[0] || null
  );

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    const promptQuery = searchParams.get('prompt');
    if (promptQuery && promptQuery.trim()) {
      handleSendMessage(promptQuery.trim());
    }
  }, [searchParams]);

  const handleSendMessage = (userText) => {
    const newMsg = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      content: userText,
      citations: []
    };

    setMessages(prev => [...prev, newMsg]);
    setIsLoading(true);

    setTimeout(() => {
      const lower = userText.toLowerCase();
      let responseTemplate = MOCK_AI_RESPONSES['blast radius'];

      if (lower.includes('iso') || lower.includes('compliance') || lower.includes('brief')) {
        responseTemplate = MOCK_AI_RESPONSES['iso 27001'];
      } else if (lower.includes('bola') || lower.includes('api') || lower.includes('authorization')) {
        responseTemplate = MOCK_AI_RESPONSES['bola'];
      } else if (lower.includes('recurring') || lower.includes('trend') || lower.includes('repeat')) {
        responseTemplate = MOCK_AI_RESPONSES['recurring'];
      } else {
        responseTemplate = {
          content: `### Technical Evaluation: "${userText}"

Cross-referencing across 6 audit archives and 111 active vulnerability records:

#### Threat Analysis:
- Target Scope: Active infrastructure components in the AWS production enclave.
- Access Complexity: Low. Unauthenticated network access path possible.
- Standard Non-conformance: NIST SP 800-53 (Control RA-5) and SOC2 Type II CC7.1.

#### Remediation Sequence:
1. Enforce strict least-privilege IAM policy bounding on affected microservice endpoints.
2. Upgrade vulnerable runtime dependencies in staging container build rings.
3. Validate egress firewall policies on ports 445 and 8443.`,
          citations: [
            {
              source: "PwC_ThreatLens_Infra_PenTest_Q3_2026.pdf",
              section: "Section 3.1: Attack Path Correlation",
              cve: "CVE-2024-3094",
              relevance: "Correlated lateral movement path into production Aurora cluster"
            },
            {
              source: "KPMG_API_Vulnerability_Report_v2.pdf",
              section: "Executive Attestation Findings",
              cve: "AUDIT-SYNTH",
              relevance: "Matches authorization boundary anomalies flagged in Q2 review"
            }
          ]
        };
      }

      const aiMsg = {
        id: `msg-${Date.now() + 1}`,
        sender: 'assistant',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        content: responseTemplate.content,
        citations: responseTemplate.citations || []
      };

      setMessages(prev => [...prev, aiMsg]);
      setIsLoading(false);

      if (responseTemplate.citations && responseTemplate.citations.length > 0) {
        setActiveCitation(responseTemplate.citations[0]);
      }
    }, 700);
  };

  const handleClear = () => {
    setMessages(INITIAL_CONVERSATION.slice(0, 1));
    showToast('Session cleared.', 'info');
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#e8dbe0]">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide font-mono">
          Decision Assistant
        </h2>

        <button
          onClick={handleClear}
          className="text-xs font-mono text-slate-500 hover:text-slate-900"
        >
          Clear Chat
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <div className="lg:col-span-8 flex flex-col space-y-3">
          <div className="space-y-2 min-h-[400px] max-h-[580px] overflow-y-auto pr-1">
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                onSelectCitation={(cite) => setActiveCitation(cite)}
              />
            ))}

            {isLoading && (
              <div className="p-3 rounded-xs enterprise-card text-xs font-mono text-slate-500 flex items-center gap-2">
                <span className="w-3 h-3 border border-slate-600 border-t-transparent animate-spin rounded-full" />
                <span>Evaluating audit evidence...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <ChatInput
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            presetPrompts={PRESET_PROMPTS}
            onSelectPreset={(prompt) => handleSendMessage(prompt)}
          />
        </div>

        <div className="lg:col-span-4 sticky top-20">
          <EvidenceCitationPanel activeCitation={activeCitation} />
        </div>
      </div>
    </div>
  );
}
