import React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Bot, ChevronDown, Lightbulb, MessageSquare, Plus, Sparkles, WandSparkles } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { services, getError } from '../services/api';
import { AIChatWindow, AIResponseError, ChatInput, ChatMessage, SuggestedPrompts, TypingIndicator } from '../components/AIChatComponents';

const starters = [
  'Find me a birthday gift under $50',
  'Compare two products in the catalog',
  'Show eco-friendly products',
  'Where is my order?',
];
const welcome = 'Hi there! I’m your SellerShield shopping stylist. Tell me what you’re looking for and I’ll search the live catalog.';

export function AssistantPage() {
  const [messages, setMessages] = useState([{ role: 'assistant', content: welcome, products: [] }]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const bottom = useRef(null);
  const { add, refresh } = useCart();

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy]);
  const loadHistory = async () => {
    try {
      const response = await services.ai.history();
      setHistory(Array.isArray(response.data) ? response.data : response.data?.conversations || []);
    } catch { /* Conversation history is optional; chat errors remain visible in the main pane. */ }
  };
  useEffect(() => { loadHistory(); }, []);

  const startConversation = () => {
    setConversationId(null);
    setMessages([{ role: 'assistant', content: welcome, products: [] }]);
    setError('');
  };

  const openConversation = conversation => {
    setConversationId(conversation.id);
    setMessages((conversation.messages || []).map(message => ({
      role: message.role,
      content: message.content,
      products: message.metadata?.products || [],
      comparison: message.metadata?.comparison || null,
      orderStatus: message.metadata?.orderStatus || null,
      refundAnalysis: message.metadata?.refundAnalysis || null,
      cartUpdated: message.metadata?.cartUpdated || false,
    })));
    setError('');
  };

  const send = async text => {
    const prompt = (text || input).trim();
    if (!prompt || busy) return;
    setMessages(current => [...current, { role: 'user', content: prompt }]);
    setInput('');
    setBusy(true);
    setError('');
    try {
      const response = await services.ai.chat({ message: prompt, conversationId: conversationId || undefined });
      const payload = response.data || {};
      const result = payload.data || payload;
      if (payload.conversationId) setConversationId(payload.conversationId);
      if (result.cartUpdated) await refresh().catch(() => {});
      setMessages(current => [...current, {
        role: 'assistant',
        content: payload.message || payload.reply || 'The assistant returned no response.',
        products: result.products || [],
        comparison: result.comparison || null,
        orderStatus: result.orderStatus || null,
        refundAnalysis: result.refundAnalysis || null,
        cartUpdated: result.cartUpdated || false,
        type: payload.type || 'text',
      }]);
      await loadHistory();
    } catch (reason) {
      setError(getError(reason));
    } finally {
      setBusy(false);
    }
  };

  return <div className="assistant-app">
    <aside className="chat-sidebar">
      <div className="chat-sidebar-head"><div><span className="eyebrow">YOUR SHOPPING STUDIO</span><h2>Conversations</h2></div><button className="icon-button" onClick={startConversation} aria-label="New conversation"><Plus size={17}/></button></div>
      <button className="new-chat-button" onClick={startConversation}><Plus size={15}/> New conversation</button>
      <div className="history-label">RECENT</div>
      <div className="chat-history">{history.slice(0, 8).map((item, index) => <button key={item.id || index} onClick={() => openConversation(item)}><MessageSquare size={15}/><span>{item.title || item.messages?.[0]?.content || 'Shopping conversation'}</span><ChevronDown size={13}/></button>)}{!history.length && <small>Your saved conversations will appear here.</small>}</div>
      <div className="chat-sidebar-footer"><Sparkles size={17}/><span>Recommendations use products from the live catalog.</span></div>
    </aside>
    <AIChatWindow>
      <div className="chat-header"><div className="chat-bot-avatar"><Bot size={19}/><i/></div><div><strong>Your AI stylist</strong><small><span/> Connected to the SellerShield catalog</small></div><span className="chat-powered">Groq · SellerShield AI</span></div>
      <div className="chat-messages">
        <div className="chat-welcome"><div className="welcome-sparkle"><WandSparkles size={19}/></div><h2>Good finds start<br/>with a <em>conversation.</em></h2><p>Ask about real products, compare items, or check an order you own.</p><SuggestedPrompts prompts={starters} onSelect={send}/></div>
        {messages.map((message, index) => <ChatMessage key={`${conversationId || 'new'}-${index}`} message={message} index={index} onAdd={add}/>)}
        {busy && <TypingIndicator/>}
        <AIResponseError error={error}/>
        <div ref={bottom}/>
      </div>
      <div className="chat-compose-wrap"><ChatInput value={input} onChange={event => setInput(event.target.value)} onSend={() => send()} disabled={busy}/><div className="compose-hint"><span><Lightbulb size={13}/> Product facts are verified against the catalog</span><span>Enter to send · Shift + Enter for a new line</span></div></div>
    </AIChatWindow>
  </div>;
}
