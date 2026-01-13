import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Box, Cpu, Shield, Zap, Loader2, Send,
    Bot, User, Wand2, Sparkles, ArrowRight
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { generateTopologyFromSpec } from '../api/topologyApi';
import { cn } from '../lib/utils';

const API_BASE = 'http://localhost:3001';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export function LandingPage() {
    const navigate = useNavigate();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [extractedSpec, setExtractedSpec] = useState<Record<string, unknown> | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasStartedChat, setHasStartedChat] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const sendMessage = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput('');
        setIsLoading(true);
        setError(null);

        // If this is the first message, start the session and expand the chat
        let currentSessionId = sessionId;
        if (!hasStartedChat) {
            setHasStartedChat(true);

            // Start session without showing greeting
            try {
                const res = await fetch(`${API_BASE}/api/chat/start`, { method: 'POST' });
                const data = await res.json();
                currentSessionId = data.session_id;
                setSessionId(currentSessionId);
                // Don't add the greeting to messages
            } catch (err) {
                console.error('Failed to start session:', err);
                setError('Failed to connect to server. Please try again.');
                setIsLoading(false);
                return;
            }
        }

        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);

        try {
            const res = await fetch(`${API_BASE}/api/chat/message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session_id: currentSessionId, message: userMessage })
            });
            const data = await res.json();

            setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
            setIsReady(data.ready_to_generate);
            if (data.extracted_spec) {
                setExtractedSpec(data.extracted_spec);
            }
        } catch (err) {
            console.error('Failed to send message:', err);
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

    const handleGenerate = async () => {
        if (!extractedSpec || isGenerating) return;

        setIsGenerating(true);
        setError(null);

        try {
            const result = await generateTopologyFromSpec(extractedSpec);

            // Navigate to editor with topology and chat history
            navigate('/app', {
                state: {
                    topology: result.topology,
                    validation: result.validation,
                    chatHistory: messages,
                    sessionId: sessionId
                }
            });
        } catch (err) {
            console.error('Failed to generate:', err);
            setError('Failed to generate topology. Please try again.');
            setIsGenerating(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#030712] text-white selection:bg-indigo-500/30">
            {/* Background Gradients */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-500/20 rounded-full blur-[100px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-[100px]" />
            </div>

            {/* Navbar */}
            <nav className="relative z-10 border-b border-white/5 backdrop-blur-sm">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
                            <Zap className="w-5 h-5 text-white fill-current" />
                        </div>
                        <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                            TopNet
                        </span>
                    </div>
                    <button
                        onClick={() => navigate('/app')}
                        className="text-sm font-medium text-gray-400 hover:text-white transition-colors"
                    >
                        Open Editor
                    </button>
                </div>
            </nav>

            {/* Main Content */}
            <main className="relative z-10 pt-12 pb-20 px-6">
                <div className="max-w-4xl mx-auto">
                    {/* Hero Text */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="text-center mb-8"
                    >
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-medium mb-4">
                            <span className="flex w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                            AI-Powered Infrastructure Design
                        </div>
                        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3">
                            Infrastructure at the{' '}
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
                                Speed of Thought
                            </span>
                        </h1>
                        <p className="text-gray-400 max-w-xl mx-auto">
                            Turn plain English into validated, deployable cloud architectures. Visualize your network, validate security rules, and export Terraform in seconds.
                        </p>
                    </motion.div>

                    {/* Input / Chat Interface */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className="relative"
                    >
                        <AnimatePresence mode="wait">
                            {!hasStartedChat ? (
                                // Simple Input Box (Initial State)
                                <motion.div
                                    key="simple-input"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    <div className="relative group">
                                        <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-2xl opacity-30 group-hover:opacity-50 blur transition-all duration-300" />
                                        <div className="relative bg-[#0a0a0f] rounded-xl border border-white/10 p-4">
                                            <textarea
                                                ref={inputRef}
                                                value={input}
                                                onChange={(e) => setInput(e.target.value)}
                                                onKeyDown={handleKeyDown}
                                                placeholder="Describe your infrastructure... e.g., 'Create a VPC with 2 public subnets and a load balancer'"
                                                rows={3}
                                                disabled={isGenerating}
                                                className="w-full bg-transparent text-white placeholder:text-gray-500 resize-none focus:outline-none text-base leading-relaxed"
                                            />

                                            <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                                    <Sparkles className="w-3.5 h-3.5" />
                                                    <span>AI will help design your infrastructure</span>
                                                </div>

                                                <button
                                                    onClick={sendMessage}
                                                    disabled={!input.trim()}
                                                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold transition-all shadow-lg shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                                                >
                                                    <span>Start</span>
                                                    <ArrowRight className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <p className="mt-4 text-xs text-gray-600 text-center">
                                        Press Enter to start • Opens chat interface
                                    </p>
                                </motion.div>
                            ) : (
                                // Full Chat Interface (Expanded State)
                                <motion.div
                                    key="chat-interface"
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.4 }}
                                >
                                    <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-2xl opacity-20 blur" />
                                    <div className="relative bg-[#0a0a0f] rounded-xl border border-white/10 overflow-hidden">
                                        {/* Chat Messages */}
                                        <div className="h-[400px] overflow-y-auto p-4 space-y-4 custom-scrollbar">
                                            {messages.map((msg, i) => (
                                                <div
                                                    key={i}
                                                    className={cn(
                                                        "flex gap-3",
                                                        msg.role === 'user' ? "justify-end" : "justify-start"
                                                    )}
                                                >
                                                    {msg.role === 'assistant' && (
                                                        <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shrink-0">
                                                            <Bot className="w-4 h-4 text-white" />
                                                        </div>
                                                    )}
                                                    <div
                                                        className={cn(
                                                            "max-w-[80%] px-4 py-3 rounded-xl text-sm",
                                                            msg.role === 'user'
                                                                ? "bg-indigo-600 text-white"
                                                                : "bg-white/5 text-gray-300 border border-white/5"
                                                        )}
                                                    >
                                                        <ReactMarkdown
                                                            remarkPlugins={[remarkGfm]}
                                                            components={{
                                                                p: ({ ...props }) => <p className="mb-2 last:mb-0 leading-relaxed" {...props} />,
                                                                ul: ({ ...props }) => <ul className="list-disc list-outside ml-4 mb-2 space-y-1" {...props} />,
                                                                li: ({ ...props }) => <li className="pl-1" {...props} />,
                                                                code: ({ className, children, ...props }) => {
                                                                    const isInline = !String(children).includes('\n');
                                                                    return isInline ? (
                                                                        <code className="bg-black/30 px-1 py-0.5 rounded text-xs text-indigo-300" {...props}>
                                                                            {children}
                                                                        </code>
                                                                    ) : (
                                                                        <code className="block bg-black/50 p-2 rounded-lg text-xs overflow-x-auto my-2" {...props}>
                                                                            {children}
                                                                        </code>
                                                                    );
                                                                },
                                                            }}
                                                        >
                                                            {msg.content}
                                                        </ReactMarkdown>
                                                    </div>
                                                    {msg.role === 'user' && (
                                                        <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center shrink-0">
                                                            <User className="w-4 h-4 text-gray-300" />
                                                        </div>
                                                    )}
                                                </div>
                                            ))}

                                            {isLoading && (
                                                <div className="flex gap-3">
                                                    <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shrink-0">
                                                        <Bot className="w-4 h-4 text-white" />
                                                    </div>
                                                    <div className="bg-white/5 border border-white/5 px-4 py-3 rounded-xl">
                                                        <div className="flex items-center gap-2">
                                                            <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                                                            <span className="text-sm text-gray-400">Thinking...</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            <div ref={messagesEndRef} />
                                        </div>

                                        {/* Generate Button - Shows when ready */}
                                        {isReady && extractedSpec && (
                                            <div className="px-4 py-3 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border-t border-white/5">
                                                <button
                                                    onClick={handleGenerate}
                                                    disabled={isGenerating}
                                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold transition-all shadow-lg shadow-indigo-500/25 disabled:opacity-50"
                                                >
                                                    {isGenerating ? (
                                                        <>
                                                            <Loader2 className="w-5 h-5 animate-spin" />
                                                            <span>Generating Topology...</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Wand2 className="w-5 h-5" />
                                                            <span>Generate Infrastructure Topology</span>
                                                        </>
                                                    )}
                                                </button>
                                                <p className="text-xs text-center text-indigo-300/60 mt-2">
                                                    Ready to create your infrastructure diagram
                                                </p>
                                            </div>
                                        )}

                                        {/* Input Area */}
                                        <div className="p-4 border-t border-white/5">
                                            <div className="relative">
                                                <textarea
                                                    value={input}
                                                    onChange={(e) => setInput(e.target.value)}
                                                    onKeyDown={handleKeyDown}
                                                    placeholder="Continue the conversation..."
                                                    rows={2}
                                                    disabled={isGenerating}
                                                    className="w-full px-4 py-3 pr-12 bg-white/5 border border-white/10 rounded-xl text-sm text-gray-200 placeholder:text-gray-600 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all disabled:opacity-50"
                                                />
                                                <button
                                                    onClick={sendMessage}
                                                    disabled={!input.trim() || isLoading || isGenerating}
                                                    className={cn(
                                                        "absolute bottom-3 right-3 p-2 rounded-lg transition-all",
                                                        !input.trim() || isLoading || isGenerating
                                                            ? "bg-gray-700/50 text-gray-500 cursor-not-allowed"
                                                            : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg"
                                                    )}
                                                >
                                                    <Send className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <p className="text-[10px] text-gray-600 mt-2 px-1">
                                                Press Enter to send • Shift+Enter for new line
                                            </p>
                                        </div>
                                    </div>

                                    {error && (
                                        <motion.p
                                            initial={{ opacity: 0, y: 5 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="mt-3 text-sm text-red-400 text-center"
                                        >
                                            {error}
                                        </motion.p>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>

                    {/* Feature Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-24">
                        <FeatureCard
                            icon={<Cpu className="w-6 h-6 text-purple-400" />}
                            title="Natural Language AI"
                            description="Just describe what you need. 'A VPC with 2 public subnets and an RDS instance.' TopNet handles the rest."
                            delay={0.4}
                        />
                        <FeatureCard
                            icon={<Shield className="w-6 h-6 text-emerald-400" />}
                            title="Security First"
                            description="Automatic validation checks for CIDR overlaps, open security groups, and SPOFs before you deploy."
                            delay={0.5}
                        />
                        <FeatureCard
                            icon={<Box className="w-6 h-6 text-orange-400" />}
                            title="Terraform Native"
                            description="Export clean, standard Terraform JSON. No lock-in, just pure infrastructure as code."
                            delay={0.6}
                        />
                    </div>
                </div>
            </main>
        </div>
    );
}

function FeatureCard({ icon, title, description, delay }: { icon: React.ReactNode; title: string; description: string; delay: number }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay }}
            className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/10 transition-all group"
        >
            <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                {icon}
            </div>
            <h3 className="text-xl font-semibold mb-2 text-white">{title}</h3>
            <p className="text-gray-400 leading-relaxed">{description}</p>
        </motion.div>
    );
}
