import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Sparkles, Bot, User, Wand2, RotateCcw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { API_ORIGIN } from '../config/api';
import { cn } from '../lib/utils';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

interface ChatPanelProps {
    onGenerateTopology: (spec: Record<string, unknown>) => void;
    isGenerating: boolean;
    initialMessages?: Message[];
    initialSessionId?: string | null;
}

export function ChatPanel({ onGenerateTopology, isGenerating, initialMessages, initialSessionId }: ChatPanelProps) {
    const [messages, setMessages] = useState<Message[]>(initialMessages ?? []);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(initialSessionId ?? null);
    const [isReady, setIsReady] = useState(false);
    const [extractedSpec, setExtractedSpec] = useState<Record<string, unknown> | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const [hasInitialized, setHasInitialized] = useState(false);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const startNewSession = async () => {
        try {
            const res = await fetch(`${API_ORIGIN}/api/chat/start`, {
                method: 'POST',
            });
            const data = await res.json();
            setSessionId(data.session_id);
            setMessages([{
                role: 'assistant',
                content: data.greeting
            }]);
            setIsReady(false);
            setExtractedSpec(null);
        } catch (error) {
            console.error('Failed to start session:', error);
        }
    };

    // Only start new session if we don't have initial data
    useEffect(() => {
        if (!hasInitialized) {
            setHasInitialized(true);
            if (!initialSessionId && (!initialMessages || initialMessages.length === 0)) {
                startNewSession();
            }
        }
    }, [hasInitialized, initialSessionId, initialMessages]);

    const sendMessage = async () => {
        if (!input.trim() || !sessionId || isLoading) return;

        const userMessage = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setIsLoading(true);

        try {
            const res = await fetch(`${API_ORIGIN}/api/chat/message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: sessionId,
                    message: userMessage
                })
            });
            const data = await res.json();

            setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
            setIsReady(data.ready_to_generate);
            if (data.extracted_spec) {
                setExtractedSpec(data.extracted_spec);
            }
        } catch (error) {
            console.error('Failed to send message:', error);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Sorry, I encountered an error. Please try again.'
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const handleGenerate = () => {
        if (extractedSpec) {
            onGenerateTopology(extractedSpec);
        }
    };

    const handleReset = () => {
        startNewSession();
    };

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-md flex items-center justify-center">
                        <Bot className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="text-xs font-semibold text-gray-300">Infrastructure Assistant</span>
                </div>
                <button
                    onClick={handleReset}
                    className="p-1.5 rounded-md hover:bg-white/5 text-gray-500 hover:text-gray-300 transition-colors"
                    title="Start new conversation"
                >
                    <RotateCcw className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center px-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-indigo-500/20 to-purple-600/20 rounded-xl flex items-center justify-center mb-4">
                            <Sparkles className="w-6 h-6 text-indigo-400" />
                        </div>
                        <p className="text-sm text-gray-400 mb-2">Start a conversation</p>
                        <p className="text-xs text-gray-600">
                            Describe your infrastructure needs and I'll help you design it.
                        </p>
                    </div>
                ) : (
                    messages.map((msg, i) => (
                        <div
                            key={i}
                            className={cn(
                                "flex gap-3",
                                msg.role === 'user' ? "justify-end" : "justify-start"
                            )}
                        >


                            {msg.role === 'assistant' && (
                                <div className="w-6 h-6 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-md flex items-center justify-center shrink-0 mt-0.5">
                                    <Bot className="w-3.5 h-3.5 text-white" />
                                </div>
                            )}
                            <div
                                className={cn(
                                    "max-w-[85%] px-3 py-2 rounded-lg text-sm",
                                    msg.role === 'user'
                                        ? "bg-indigo-600 text-white"
                                        : "bg-white/5 text-gray-300 border border-white/5"
                                )}
                            >
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                        p: ({ node, ...props }: any) => <p className="mb-1 last:mb-0 leading-relaxed" {...props} />,
                                        ul: ({ node, ...props }: any) => <ul className="list-disc list-outside ml-4 mb-2 space-y-1" {...props} />,
                                        ol: ({ node, ...props }: any) => <ol className="list-decimal list-outside ml-4 mb-2 space-y-1" {...props} />,
                                        li: ({ node, ...props }: any) => <li className="pl-1" {...props} />,
                                        h1: ({ node, ...props }: any) => <h1 className="text-lg font-bold mb-2 mt-1" {...props} />,
                                        h2: ({ node, ...props }: any) => <h2 className="text-base font-bold mb-2 mt-1" {...props} />,
                                        h3: ({ node, ...props }: any) => <h3 className="text-sm font-bold mb-1" {...props} />,
                                        code: ({ node, className, children, ...props }: any) => {
                                            const match = /language-(\w+)/.exec(className || '');
                                            const isInline = !match && !String(children).includes('\n');
                                            return isInline ? (
                                                <code className="bg-black/30 px-1 py-0.5 rounded font-mono text-xs text-indigo-300 border border-white/10" {...props}>
                                                    {children}
                                                </code>
                                            ) : (
                                                <code className="block bg-black/50 p-2 rounded-lg font-mono text-xs text-gray-300 overflow-x-auto border border-white/10 my-2" {...props}>
                                                    {children}
                                                </code>
                                            );
                                        },
                                        a: ({ node, ...props }: any) => <a className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2" target="_blank" rel="noopener noreferrer" {...props} />,
                                        blockquote: ({ node, ...props }: any) => <blockquote className="border-l-2 border-indigo-500/50 pl-3 italic text-gray-400 my-2" {...props} />,
                                        table: ({ node, ...props }: any) => <div className="overflow-x-auto my-2 rounded-lg border border-white/10"><table className="w-full text-left border-collapse" {...props} /></div>,
                                        thead: ({ node, ...props }: any) => <thead className="bg-white/5" {...props} />,
                                        th: ({ node, ...props }: any) => <th className="px-3 py-2 text-xs font-semibold text-gray-300 border-b border-white/10" {...props} />,
                                        td: ({ node, ...props }: any) => <td className="px-3 py-2 text-xs text-gray-400 border-b border-white/5" {...props} />,
                                    }}
                                >
                                    {msg.content}
                                </ReactMarkdown>
                            </div>
                            {msg.role === 'user' && (
                                <div className="w-6 h-6 bg-gray-700 rounded-md flex items-center justify-center shrink-0 mt-0.5">
                                    <User className="w-3.5 h-3.5 text-gray-300" />
                                </div>
                            )}
                        </div>
                    ))
                )}

                {isLoading && (
                    <div className="flex gap-3">
                        <div className="w-6 h-6 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-md flex items-center justify-center shrink-0">
                            <Bot className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div className="bg-white/5 border border-white/5 px-3 py-2 rounded-lg">
                            <div className="flex items-center gap-2">
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                                <span className="text-xs text-gray-400">Thinking...</span>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Generate Button - Shows when ready */}
            {isReady && extractedSpec && (
                <div className="px-4 py-3 border-t border-white/5 bg-indigo-500/10">
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-medium transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Generating...</span>
                            </>
                        ) : (
                            <>
                                <Wand2 className="w-4 h-4" />
                                <span>Generate Topology</span>
                            </>
                        )}
                    </button>
                    <p className="text-[10px] text-indigo-300/60 text-center mt-2">
                        Ready to create your infrastructure diagram
                    </p>
                </div>
            )}

            {/* Input */}
            <div className="p-3 border-t border-white/5">
                <div className="relative">
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Describe your infrastructure..."
                        rows={2}
                        className="w-full px-3 py-2.5 pr-10 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-200 placeholder:text-gray-600 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                    />
                    <button
                        onClick={sendMessage}
                        disabled={!input.trim() || isLoading}
                        className={cn(
                            "absolute bottom-2 right-2 p-1.5 rounded-md transition-all",
                            !input.trim() || isLoading
                                ? "bg-gray-700/50 text-gray-500 cursor-not-allowed"
                                : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg"
                        )}
                    >
                        <Send className="w-3.5 h-3.5" />
                    </button>
                </div>
                <p className="text-[10px] text-gray-600 mt-1.5 px-1">
                    Press Enter to send • Shift+Enter for new line
                </p>
            </div>
        </div>
    );
}
