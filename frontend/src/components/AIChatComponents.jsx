import React from 'react';
import { Bot, Sparkles, UserRound } from 'lucide-react';
import { Button, ErrorMessage } from './UI';

export function ProductRecommendationCard({ product, onAdd }) {
  return <article className="chat-product"><img src={product.image} alt={product.name}/><div><strong>{product.name}</strong><small>{product.description}</small><b>${Number(product.price).toFixed(2)}</b><small>{product.stock} in stock · {product.category}</small></div><Button variant="small" onClick={() => onAdd(product)} disabled={Number(product.stock) < 1}>Add</Button></article>;
}

export function ProductComparison({ products = [] }) {
  if (products.length !== 2) return null;
  return <div className="ai-comparison-wrap"><table className="ai-comparison"><thead><tr><th>Compare</th>{products.map(item => <th key={item.id}>{item.name}</th>)}</tr></thead><tbody><tr><th>Price</th>{products.map(item => <td key={item.id}>${Number(item.price).toFixed(2)}</td>)}</tr><tr><th>Category</th>{products.map(item => <td key={item.id}>{item.category}</td>)}</tr><tr><th>Availability</th>{products.map(item => <td key={item.id}>{item.stock > 0 ? `${item.stock} in stock` : 'Out of stock'}</td>)}</tr><tr><th>Details</th>{products.map(item => <td key={item.id}>{item.description}</td>)}</tr></tbody></table></div>;
}

export function ChatMessage({ message, onAdd, index = 0 }) {
  const assistant = message.role === 'assistant';
  return <div className={`chat-row ${message.role}`}><div className={assistant ? 'message-avatar' : 'message-user-avatar'}>{assistant ? <Sparkles size={15}/> : <UserRound size={15}/>}</div><div className="message-content"><span className="message-author">{assistant ? 'SELLERSHIELD STYLIST' : 'YOU'}</span><div className="message-bubble">{message.content}</div>{message.comparison?.length === 2 && <ProductComparison products={message.comparison} />}{message.products?.length > 0 && <div className="chat-recommendations">{message.products.map(product => <ProductRecommendationCard key={product.id} product={product} onAdd={onAdd}/>)}</div>}{message.orderStatus && <div className="ai-verified-panel"><strong>Verified order {message.orderStatus.orderId}</strong><span>Order: {message.orderStatus.orderStatus} · Payment: {message.orderStatus.paymentStatus}</span><small>{message.orderStatus.items?.map(item => `${item.name} ×${item.quantity}`).join(', ')}</small></div>}{message.refundAnalysis && <div className="ai-verified-panel"><strong>Refund analysis: {message.refundAnalysis.recommendation?.replaceAll('_', ' ')}</strong><span>{message.refundAnalysis.explanation}</span><small>{Math.round(Number(message.refundAnalysis.confidence || 0) * 100)}% confidence · seller approval required</small></div>}{message.cartUpdated && <div className="ai-verified-panel"><strong>Cart prepared</strong><span>Verified product and quantity were added to your saved cart. Review it before checkout.</span></div>}{assistant && index > 0 && <div className="message-feedback"><button title="Helpful" aria-label="Helpful"><span>👍</span></button><button title="Not helpful" aria-label="Not helpful"><span>👎</span></button><span>Just now</span></div>}</div></div>;
}

export function SuggestedPrompts({ prompts, onSelect }) {
  return <div className="prompt-chips">{prompts.map((prompt, index) => <button key={`${prompt}-${index}`} onClick={() => onSelect(prompt)}><Sparkles size={13}/>{prompt}</button>)}</div>;
}

export function TypingIndicator() {
  return <div className="chat-row assistant"><div className="message-avatar"><Bot size={15}/></div><div className="typing-bubble" aria-label="Assistant is typing"><i/><i/><i/></div></div>;
}

export function AIResponseError({ error }) {
  return error ? <div className="chat-error"><ErrorMessage>{error}</ErrorMessage></div> : null;
}

export function ChatInput({ value, onChange, onSend, disabled }) {
  return <div className="chat-compose"><textarea value={value} onChange={onChange} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); onSend(); } }} placeholder="Tell me what you’re looking for…" rows={1}/><button disabled={!value.trim() || disabled} onClick={onSend} aria-label="Send message">↑</button></div>;
}

export function AIChatWindow({ children }) {
  return <section className="chat-main">{children}</section>;
}
