import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Box, Cpu, Shield, Zap, Loader2, Send,
    Bot, User, Wand2, Sparkles, ArrowRight,
    Network, DollarSign, LayoutDashboard, AlertCircle, X, TrendingDown
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { generateTopologyFromSpec } from '../api/topologyApi';
import { AwsAccountStatus } from '../components/AwsAccountStatus';
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

    // Auto-focus input on mount
    useEffect(() => {
        if (inputRef.current && !hasStartedChat) {
            inputRef.current.focus();
        }
    }, [hasStartedChat]);

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
                    <div className="flex items-center gap-4">
                        <AwsAccountStatus compact />
                        <button
                            onClick={() => navigate('/app')}
                            className="text-sm font-medium text-gray-400 hover:text-white transition-colors"
                        >
                            Open Editor
                        </button>
                    </div>
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
                            Describe your infrastructure in plain English. Get an interactive visual topology with automatic validation, cost estimates, and one-click deployment to AWS.
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
                                                placeholder="Describe your infrastructure... e.g., 'I need a highly available web app with load balancer, auto-scaling, and RDS database'"
                                                rows={3}
                                                disabled={isGenerating}
                                                className="w-full bg-transparent text-white placeholder:text-gray-500 resize-none focus:outline-none text-base leading-relaxed"
                                            />

                                            <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                                    <Sparkles className="w-3.5 h-3.5" />
                                                    <span>AI designs, validates, and deploys your infrastructure</span>
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

                                    {/* Quick Start Templates */}
                                    <div className="mt-8 space-y-4">
                                        <div className="text-center">
                                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Popular Templates</p>
                                            <p className="text-xs text-gray-600">Click to auto-fill, then chat to customize</p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {/* Template 1: WordPress/Blog */}
                                            <button
                                                onClick={() => {
                                                    setInput("I need a WordPress site with MySQL database and CDN for a small business");
                                                    inputRef.current?.focus();
                                                }}
                                                className="group p-4 bg-white/5 hover:bg-indigo-500/10 border border-white/10 hover:border-indigo-500/30 rounded-xl text-left transition-all hover:scale-[1.02] relative overflow-hidden"
                                            >
                                                <div className="flex items-start gap-3 mb-3">
                                                    <div className="text-2xl">📝</div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-semibold text-white mb-1 group-hover:text-indigo-300 transition-colors">WordPress / Blog</div>
                                                        <div className="text-xs text-gray-500">EC2 + MySQL + Load Balancer</div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 pl-9">
                                                    <DollarSign className="w-3 h-3 text-emerald-400" />
                                                    <span className="text-xs font-mono text-emerald-400">~$44/mo</span>
                                                    <span className="text-xs text-gray-600">•</span>
                                                    <span className="text-xs text-gray-500">+Load Balancer</span>
                                                </div>
                                            </button>

                                            {/* Template 2: MVP App */}
                                            <button
                                                onClick={() => {
                                                    setInput("I'm building a startup MVP - need a scalable backend API with PostgreSQL database");
                                                    inputRef.current?.focus();
                                                }}
                                                className="group p-4 bg-white/5 hover:bg-emerald-500/10 border border-white/10 hover:border-emerald-500/30 rounded-xl text-left transition-all hover:scale-[1.02] relative overflow-hidden"
                                            >
                                                <div className="flex items-start gap-3 mb-3">
                                                    <div className="text-2xl">🚀</div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-semibold text-white mb-1 group-hover:text-emerald-300 transition-colors">Startup MVP Backend</div>
                                                        <div className="text-xs text-gray-500">API Server + PostgreSQL + HA</div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 pl-9">
                                                    <DollarSign className="w-3 h-3 text-emerald-400" />
                                                    <span className="text-xs font-mono text-emerald-400">~$77/mo</span>
                                                    <span className="text-xs text-gray-600">•</span>
                                                    <span className="text-xs text-gray-500">HA + NAT Gateway</span>
                                                </div>
                                            </button>

                                            {/* Template 3: Game Server */}
                                            <button
                                                onClick={() => {
                                                    setInput("I want to host a Minecraft server for my friends - needs 4GB RAM");
                                                    inputRef.current?.focus();
                                                }}
                                                className="group p-4 bg-white/5 hover:bg-purple-500/10 border border-white/10 hover:border-purple-500/30 rounded-xl text-left transition-all hover:scale-[1.02] relative overflow-hidden"
                                            >
                                                <div className="flex items-start gap-3 mb-3">
                                                    <div className="text-2xl">🎮</div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-semibold text-white mb-1 group-hover:text-purple-300 transition-colors">Game Server</div>
                                                        <div className="text-xs text-gray-500">Minecraft / Valheim / Private Gaming</div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 pl-9">
                                                    <DollarSign className="w-3 h-3 text-emerald-400" />
                                                    <span className="text-xs font-mono text-emerald-400">~$30/mo</span>
                                                    <span className="text-xs text-gray-600">•</span>
                                                    <span className="text-xs text-gray-500">4GB RAM</span>
                                                </div>
                                            </button>

                                            {/* Template 4: Dev Environment */}
                                            <button
                                                onClick={() => {
                                                    setInput("I need a development environment with staging and production databases");
                                                    inputRef.current?.focus();
                                                }}
                                                className="group p-4 bg-white/5 hover:bg-blue-500/10 border border-white/10 hover:border-blue-500/30 rounded-xl text-left transition-all hover:scale-[1.02] relative overflow-hidden"
                                            >
                                                <div className="flex items-start gap-3 mb-3">
                                                    <div className="text-2xl">💼</div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-semibold text-white mb-1 group-hover:text-blue-300 transition-colors">Dev Environment</div>
                                                        <div className="text-xs text-gray-500">Staging + Production Setup</div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 pl-9">
                                                    <DollarSign className="w-3 h-3 text-emerald-400" />
                                                    <span className="text-xs font-mono text-emerald-400">~$104/mo</span>
                                                    <span className="text-xs text-gray-600">•</span>
                                                    <span className="text-xs text-gray-500">Staging + Production</span>
                                                </div>
                                            </button>

                                            {/* Template 5: Personal VPN */}
                                            <button
                                                onClick={() => {
                                                    setInput("I want a personal VPN server for secure browsing while traveling");
                                                    inputRef.current?.focus();
                                                }}
                                                className="group p-4 bg-white/5 hover:bg-amber-500/10 border border-white/10 hover:border-amber-500/30 rounded-xl text-left transition-all hover:scale-[1.02] relative overflow-hidden"
                                            >
                                                <div className="flex items-start gap-3 mb-3">
                                                    <div className="text-2xl">🔒</div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-semibold text-white mb-1 group-hover:text-amber-300 transition-colors">Personal VPN</div>
                                                        <div className="text-xs text-gray-500">Secure browsing + Privacy</div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 pl-9">
                                                    <TrendingDown className="w-3 h-3 text-emerald-400" />
                                                    <span className="text-xs font-mono text-emerald-400">~$8/mo</span>
                                                    <span className="text-xs text-gray-600">•</span>
                                                    <span className="text-xs text-gray-500">Cheapest option</span>
                                                </div>
                                            </button>

                                            {/* Template 6: Portfolio + DB */}
                                            <button
                                                onClick={() => {
                                                    setInput("I need to host my portfolio website with a contact form that saves to a database");
                                                    inputRef.current?.focus();
                                                }}
                                                className="group p-4 bg-white/5 hover:bg-pink-500/10 border border-white/10 hover:border-pink-500/30 rounded-xl text-left transition-all hover:scale-[1.02] relative overflow-hidden"
                                            >
                                                <div className="flex items-start gap-3 mb-3">
                                                    <div className="text-2xl">🎨</div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-semibold text-white mb-1 group-hover:text-pink-300 transition-colors">Portfolio + Forms</div>
                                                        <div className="text-xs text-gray-500">Website + Database + Contact Forms</div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 pl-9">
                                                    <DollarSign className="w-3 h-3 text-emerald-400" />
                                                    <span className="text-xs font-mono text-emerald-400">~$20/mo</span>
                                                    <span className="text-xs text-gray-600">•</span>
                                                    <span className="text-xs text-gray-500">Micro instance + DB</span>
                                                </div>
                                            </button>
                                        </div>

                                        <p className="text-xs text-gray-600 text-center mt-4">
                                            Or describe your own use case above ↑
                                        </p>

                                        {/* Cost Info Banner */}
                                        <div className="mt-6 p-4 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 rounded-xl">
                                            <div className="flex items-start gap-3">
                                                <div className="p-2 bg-emerald-500/20 rounded-lg">
                                                    <DollarSign className="w-4 h-4 text-emerald-400" />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="text-sm font-semibold text-emerald-300 mb-1">Real AWS Pricing</div>
                                                    <div className="text-xs text-gray-400 leading-relaxed">
                                                        Costs calculated using AWS Pricing API. Includes EC2 instances, RDS databases, load balancers, and NAT gateways. Data transfer costs not included. See detailed breakdown before deploying.
                                                    </div>
                                                    <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                                                        <span>💡 Tip:</span>
                                                        <span>Start with Free Tier eligible instances to minimize costs</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
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
                                        {/* Chat Header */}
                                        <div className="px-4 py-3 border-b border-white/10 bg-white/5 backdrop-blur">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                                    <span className="text-sm font-medium text-gray-300">AI Infrastructure Assistant</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {messages.length > 0 && (
                                                        <>
                                                            <span className="text-xs text-gray-500">
                                                                {messages.length} message{messages.length > 1 ? 's' : ''}
                                                            </span>
                                                            <button
                                                                onClick={() => {
                                                                    setMessages([]);
                                                                    setHasStartedChat(false);
                                                                    setIsReady(false);
                                                                    setExtractedSpec(null);
                                                                    setError(null);
                                                                }}
                                                                className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                                                                title="Start over"
                                                            >
                                                                Clear
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Error Banner */}
                                        {error && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                className="bg-red-500/10 border-b border-red-500/20 px-4 py-3"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                                                    <span className="text-sm text-red-300 flex-1">{error}</span>
                                                    <button
                                                        onClick={() => setError(null)}
                                                        className="p-1 hover:bg-red-500/20 rounded transition-colors"
                                                    >
                                                        <X className="w-3.5 h-3.5 text-red-400" />
                                                    </button>
                                                </div>
                                            </motion.div>
                                        )}

                                        {/* Chat Messages */}
                                        <div className="h-[400px] overflow-y-auto p-4 space-y-4 custom-scrollbar">
                                            {/* Empty State */}
                                            {messages.length === 0 && !isLoading && (
                                                <div className="h-full flex flex-col items-center justify-center text-center px-8">
                                                    <motion.div
                                                        initial={{ opacity: 0, scale: 0.9 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        transition={{ duration: 0.5 }}
                                                        className="space-y-6"
                                                    >
                                                        <div className="w-16 h-16 mx-auto bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center border border-indigo-500/30">
                                                            <Sparkles className="w-8 h-8 text-indigo-400" />
                                                        </div>
                                                        <div>
                                                            <h3 className="text-lg font-semibold text-white mb-2">
                                                                Let's Design Your Infrastructure
                                                            </h3>
                                                            <p className="text-sm text-gray-400 max-w-sm">
                                                                Tell me about your infrastructure needs, and I'll help you create a complete, validated architecture.
                                                            </p>
                                                        </div>
                                                        <div className="space-y-2">
                                                            <p className="text-xs text-gray-600 font-medium uppercase tracking-wider">Try asking:</p>
                                                            <div className="space-y-2">
                                                                {[
                                                                    "I need a scalable web application setup",
                                                                    "Create a multi-tier architecture with database",
                                                                    "Set up a development environment in AWS"
                                                                ].map((example, idx) => (
                                                                    <button
                                                                        key={idx}
                                                                        onClick={() => {
                                                                            setInput(example);
                                                                            setTimeout(() => sendMessage(), 100);
                                                                        }}
                                                                        className="block w-full px-4 py-2 bg-white/5 hover:bg-indigo-500/10 border border-white/10 hover:border-indigo-500/30 rounded-lg text-sm text-gray-300 hover:text-indigo-300 transition-all text-left"
                                                                    >
                                                                        "{example}"
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                </div>
                                            )}


                                            {messages.map((msg, i) => (
                                                <motion.div
                                                    key={i}
                                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                                    transition={{ duration: 0.3, delay: i * 0.05 }}
                                                    className={cn(
                                                        "flex gap-3",
                                                        msg.role === 'user' ? "justify-end" : "justify-start"
                                                    )}
                                                >
                                                    {msg.role === 'assistant' && (
                                                        <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20">
                                                            <Bot className="w-4 h-4 text-white" />
                                                        </div>
                                                    )}
                                                    <div
                                                        className={cn(
                                                            "max-w-[80%] px-4 py-3 rounded-xl text-sm shadow-lg",
                                                            msg.role === 'user'
                                                                ? "bg-indigo-600 text-white shadow-indigo-600/20"
                                                                : "bg-white/5 text-gray-300 border border-white/5 hover:bg-white/10 transition-colors"
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
                                                        <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center shrink-0 shadow-lg shadow-gray-700/20">
                                                            <User className="w-4 h-4 text-gray-300" />
                                                        </div>
                                                    )}
                                                </motion.div>
                                            ))}

                                            {isLoading && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className="flex gap-3"
                                                >
                                                    <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20">
                                                        <Bot className="w-4 h-4 text-white" />
                                                    </div>
                                                    <div className="bg-white/5 border border-white/5 px-4 py-3 rounded-xl">
                                                        <div className="flex items-center gap-2">
                                                            <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                                                            <span className="text-sm text-gray-400">Analyzing your requirements...</span>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}

                                            <div ref={messagesEndRef} />
                                        </div>

                                        {/* Generate Button - Shows when ready */}
                                        {isReady && extractedSpec && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="px-4 py-4 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border-t border-indigo-500/30"
                                            >
                                                <div className="flex items-center gap-2 mb-3">
                                                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />
                                                    <span className="text-xs font-medium text-indigo-300">Specification Ready</span>
                                                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />
                                                </div>
                                                <button
                                                    onClick={handleGenerate}
                                                    disabled={isGenerating}
                                                    className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold transition-all shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
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
                                                            <ArrowRight className="w-4 h-4 ml-1" />
                                                        </>
                                                    )}
                                                </button>
                                                <p className="text-xs text-center text-indigo-300/60 mt-2.5 flex items-center justify-center gap-1.5">
                                                    <Sparkles className="w-3 h-3" />
                                                    <span>Ready to visualize your infrastructure</span>
                                                </p>
                                            </motion.div>
                                        )}

                                        {/* Input Area */}
                                        <div className="p-4 border-t border-white/5 bg-black/20">
                                            <div className="relative">
                                                <textarea
                                                    value={input}
                                                    onChange={(e) => setInput(e.target.value)}
                                                    onKeyDown={handleKeyDown}
                                                    placeholder={isReady ? "Refine your requirements or click Generate above..." : "Continue the conversation..."}
                                                    rows={2}
                                                    disabled={isGenerating}
                                                    className="w-full px-4 py-3 pr-12 bg-white/5 border border-white/10 rounded-xl text-sm text-gray-200 placeholder:text-gray-600 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all disabled:opacity-50 hover:bg-white/10"
                                                />
                                                <button
                                                    onClick={sendMessage}
                                                    disabled={!input.trim() || isLoading || isGenerating}
                                                    className={cn(
                                                        "absolute bottom-3 right-3 p-2 rounded-lg transition-all",
                                                        !input.trim() || isLoading || isGenerating
                                                            ? "bg-gray-700/50 text-gray-500 cursor-not-allowed"
                                                            : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg hover:scale-110"
                                                    )}
                                                >
                                                    {isLoading ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <Send className="w-4 h-4" />
                                                    )}
                                                </button>
                                            </div>
                                            <div className="flex items-center justify-between mt-2 px-1">
                                                <p className="text-[10px] text-gray-600">
                                                    Press Enter to send • Shift+Enter for new line
                                                </p>
                                                {input.length > 0 && (
                                                    <span className={cn(
                                                        "text-[10px] font-mono",
                                                        input.length > 500 ? "text-amber-400" : "text-gray-600"
                                                    )}>
                                                        {input.length}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>

                    {/* Target Audience Section */}
                    <div className="mt-32 text-center max-w-3xl mx-auto">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs font-medium mb-4">
                            <span className="flex w-2 h-2 rounded-full bg-emerald-500" />
                            Perfect for Individuals & Small Startups
                        </div>
                        <h2 className="text-3xl font-bold text-white mb-4">
                            Build What <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">Real People</span> Actually Deploy
                        </h2>
                        <p className="text-gray-400 leading-relaxed">
                            Whether you're a freelancer hosting client sites, a startup building an MVP, or a hobbyist running a game server - TopNet handles the most common AWS patterns without the complexity.
                        </p>
                    </div>

                    {/* Feature Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
                        <FeatureCard
                            icon={<Cpu className="w-6 h-6 text-purple-400" />}
                            title="Natural Language AI"
                            description="Describe your infrastructure in plain English. The AI asks clarifying questions and generates a complete topology specification."
                            delay={0.3}
                        />
                        <FeatureCard
                            icon={<Network className="w-6 h-6 text-blue-400" />}
                            title="Visual Graph Editor"
                            description="Interactive topology visualization with React Flow. Click nodes to inspect properties, zoom and pan to explore your architecture."
                            delay={0.4}
                        />
                        <FeatureCard
                            icon={<Shield className="w-6 h-6 text-emerald-400" />}
                            title="Security Validation"
                            description="Automatic checks for CIDR overlaps, open security groups, orphaned nodes, and reachability issues before deployment."
                            delay={0.5}
                        />
                        <FeatureCard
                            icon={<DollarSign className="w-6 h-6 text-amber-400" />}
                            title="Cost Transparency"
                            description="See estimated monthly costs upfront ($8-104/mo depending on setup). Real AWS Pricing API data. Templates show pricing before you even start. No surprises."
                            delay={0.6}
                        />
                        <FeatureCard
                            icon={<Zap className="w-6 h-6 text-pink-400" />}
                            title="One-Click Deploy"
                            description="Generate Terraform, review the plan, and deploy to your AWS account with a single click. Real infrastructure in minutes."
                            delay={0.7}
                        />
                        <FeatureCard
                            icon={<LayoutDashboard className="w-6 h-6 text-cyan-400" />}
                            title="AWS Monitoring"
                            description="Real-time dashboard showing your deployed resources. Track EC2 instances, VPCs, and other AWS services from one place."
                            delay={0.8}
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
