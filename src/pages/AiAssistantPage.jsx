import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PRESET_PROMPTS } from '../data/chatPrompts';
import { ChatMessage } from '../components/ai/ChatMessage';
import { ChatInput } from '../components/ai/ChatInput';
import { EvidenceCitationPanel } from '../components/ai/EvidenceCitationPanel';
import { useThreat } from '../context/ThreatContext';
import {
  askChatQuestion,
  deleteChatHistory,
  fetchDocuments,
  getChatHistory,
  indexAllDocuments,
  indexDocument,
} from '../api/documents';

const WELCOME_MESSAGE = {
  id: 'welcome',
  sender: 'assistant',
  timestamp: '',
  content: 'ThreatLens evidence assistant is ready. Index extracted audit documents, then ask a question. Answers cite only retrieved report excerpts.',
  citations: [],
};

function mapMessage(message) {
  return {
    id: message.id,
    sender: message.role,
    timestamp: message.created_at
      ? new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '',
    content: message.content,
    citations: message.citations || [],
  };
}

export function AiAssistantPage() {
  const [searchParams] = useSearchParams();
  const { showToast } = useThreat();
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [documents, setDocuments] = useState([]);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState([]);
  const [conversationId, setConversationId] = useState(
    () => window.localStorage.getItem('threatlens-chat-conversation') || ''
  );
  const [isLoading, setIsLoading] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [activeCitation, setActiveCitation] = useState(null);
  const [error, setError] = useState('');
  const [repositoryError, setRepositoryError] = useState('');
  const messagesEndRef = useRef(null);
  const handledPrompt = useRef('');

  const refreshDocuments = useCallback(async () => {
    try {
      const currentDocuments = await fetchDocuments();
      setDocuments(currentDocuments);
      setRepositoryError('');
    } catch (requestError) {
      setRepositoryError(requestError.message);
    }
  }, []);

  useEffect(() => {
    refreshDocuments();
    if (!conversationId) return;
    getChatHistory(conversationId)
      .then(({ messages: history }) => {
        setMessages(history.length ? history.map(mapMessage) : [WELCOME_MESSAGE]);
      })
      .catch(() => {
        window.localStorage.removeItem('threatlens-chat-conversation');
        setConversationId('');
      });
  }, [conversationId, refreshDocuments]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = useCallback(async (userText) => {
    const question = userText.trim();
    if (!question || isLoading) return;
    const userMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      content: question,
      citations: [],
    };
    setMessages((previous) => [...previous, userMessage]);
    setIsLoading(true);
    setError('');

    try {
      const response = await askChatQuestion({
        question,
        conversation_id: conversationId || undefined,
        document_ids: selectedDocumentIds.length ? selectedDocumentIds : undefined,
      });
      setConversationId(response.conversation_id);
      window.localStorage.setItem('threatlens-chat-conversation', response.conversation_id);
      const assistantMessage = {
        id: `assistant-${Date.now()}`,
        sender: 'assistant',
        timestamp: new Date(response.created_at).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        content: response.answer,
        citations: response.citations || [],
        insufficientEvidence: response.insufficient_evidence,
      };
      setMessages((previous) => [...previous, assistantMessage]);
      if (assistantMessage.citations.length) {
        setActiveCitation(assistantMessage.citations[0]);
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, isLoading, selectedDocumentIds]);

  useEffect(() => {
    const promptQuery = searchParams.get('prompt')?.trim();
    if (promptQuery && promptQuery !== handledPrompt.current) {
      handledPrompt.current = promptQuery;
      handleSendMessage(promptQuery);
    }
  }, [handleSendMessage, searchParams]);

  const handleIndexAll = async () => {
    setIndexing(true);
    setError('');
    try {
      const result = await indexAllDocuments();
      await refreshDocuments();
      if (result.failed_count) {
        setError(`${result.indexed_count} indexed; ${result.failed_count} failed. Check document indexing status.`);
      } else {
        showToast(`${result.indexed_count} document(s) indexed.`, 'info');
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIndexing(false);
    }
  };

  const handleIndexDocument = async (document, force = false) => {
    setIndexing(true);
    setError('');
    try {
      await indexDocument(document.id, force);
      await refreshDocuments();
      showToast(`${document.original_filename} indexed.`, 'info');
    } catch (requestError) {
      setError(requestError.message);
      await refreshDocuments();
    } finally {
      setIndexing(false);
    }
  };

  const handleClear = async () => {
    if (conversationId) {
      try {
        await deleteChatHistory(conversationId);
      } catch (requestError) {
        setError(requestError.message);
        return;
      }
    }
    window.localStorage.removeItem('threatlens-chat-conversation');
    setConversationId('');
    setMessages([WELCOME_MESSAGE]);
    setActiveCitation(null);
    setError('');
    showToast('Conversation cleared.', 'info');
  };

  const handleDocumentFilter = (event) => {
    setSelectedDocumentIds(
      Array.from(event.target.selectedOptions, (option) => option.value)
    );
  };

  const extractedDocuments = documents.filter((document) => document.status === 'extracted');
  const indexedCount = extractedDocuments.filter((document) => document.rag_status === 'indexed').length;
  const formatIndexStatus = (document) => {
    if (document.rag_status === 'indexed') return 'indexed';
    if (document.rag_status === 'indexing') return 'indexing…';
    if (document.rag_status === 'failed') return 'index failed';
    return 'not indexed';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-[#e8dbe0]">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide font-mono">
            Evidence Assistant
          </h2>
          <p className="text-[10px] text-slate-500 font-mono mt-1">
            Answers grounded in indexed audit report excerpts
          </p>
        </div>
        <button
          onClick={handleClear}
          className="text-xs font-mono text-slate-500 hover:text-slate-900"
        >
          Clear Chat
        </button>
      </div>

      <section className="enterprise-card p-3 rounded-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-mono font-bold uppercase text-slate-800">
              Audit evidence index
            </h3>
            <p className="text-[10px] text-slate-500 mt-1">
              {indexedCount} of {extractedDocuments.length} extracted reports indexed
            </p>
          </div>
          <button
            type="button"
            onClick={handleIndexAll}
            disabled={indexing || !extractedDocuments.length}
            className="px-3 py-1.5 border border-[#decdd4] bg-[#fbf7f8] text-xs font-mono text-slate-800 disabled:opacity-50"
          >
            {indexing ? 'Indexing…' : 'Index all extracted reports'}
          </button>
        </div>

        {repositoryError && <p className="text-xs text-[#9f1239]">{repositoryError}</p>}
        {!repositoryError && !extractedDocuments.length && (
          <p className="text-xs text-slate-500">
            Extract a PDF, DOCX, or TXT report first to make it searchable.
          </p>
        )}
        {!!extractedDocuments.length && (
          <div className="grid gap-2 sm:grid-cols-2">
            {extractedDocuments.map((document) => (
              <div
                key={document.id}
                className="flex items-center justify-between gap-3 border border-[#eee2e7] px-2.5 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs text-slate-800">{document.original_filename}</p>
                  <p className={`text-[10px] font-mono ${
                    document.rag_status === 'failed' ? 'text-[#9f1239]' : 'text-slate-500'
                  }`}>
                    {formatIndexStatus(document)}
                    {document.rag_error ? ` — ${document.rag_error}` : ''}
                  </p>
                </div>
                {document.rag_status !== 'indexing' && (
                  <button
                    type="button"
                    onClick={() => handleIndexDocument(document, document.rag_status === 'indexed')}
                    disabled={indexing}
                    className="shrink-0 text-[10px] font-mono text-[#0369a1] hover:underline disabled:opacity-50"
                  >
                    {document.rag_status === 'indexed' ? 'Reindex' : 'Index'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {!!indexedCount && (
          <label className="block text-[10px] font-mono text-slate-600">
            Search scope (select none to search all indexed reports)
            <select
              multiple
              value={selectedDocumentIds}
              onChange={handleDocumentFilter}
              className="enterprise-input mt-1 block min-h-20 w-full rounded-xs p-2 text-xs"
            >
              {extractedDocuments
                .filter((document) => document.rag_status === 'indexed')
                .map((document) => (
                  <option key={document.id} value={document.id}>
                    {document.original_filename}
                  </option>
                ))}
            </select>
          </label>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <div className="lg:col-span-8 flex flex-col space-y-3">
          <div className="space-y-2 min-h-[400px] max-h-[580px] overflow-y-auto pr-1">
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                onSelectCitation={setActiveCitation}
              />
            ))}

            {isLoading && (
              <div className="p-3 rounded-xs enterprise-card text-xs font-mono text-slate-500 flex items-center gap-2">
                <span className="w-3 h-3 border border-slate-600 border-t-transparent animate-spin rounded-full" />
                <span>Searching indexed reports and verifying source evidence…</span>
              </div>
            )}
            {error && (
              <div role="alert" className="border border-[#fecdd3] bg-[#fff1f2] p-3 text-xs text-[#9f1239]">
                {error}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <ChatInput
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            presetPrompts={PRESET_PROMPTS}
            onSelectPreset={handleSendMessage}
          />
        </div>

        <div className="lg:col-span-4 sticky top-20">
          <EvidenceCitationPanel activeCitation={activeCitation} />
        </div>
      </div>
    </div>
  );
}
