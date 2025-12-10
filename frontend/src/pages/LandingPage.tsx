import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Box, Cpu, Shield, Zap } from 'lucide-react';
import { cn } from '../lib/utils';

export function LandingPage() {
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
                    <div className="flex items-center gap-6">
                        <Link to="/app" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">
                            Sign In
                        </Link>
                        <Link
                            to="/app"
                            className="group relative px-5 py-2 rounded-full bg-white text-black text-sm font-semibold hover:bg-gray-100 transition-colors"
                        >
                            Get Started
                            <ArrowRight className="inline-block ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <main className="relative z-10 pt-32 pb-20 px-6">
                <div className="max-w-4xl mx-auto text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-medium mb-8">
                            <span className="flex w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                            v1.0 Public Beta
                        </div>
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        className="text-5xl md:text-7xl font-bold tracking-tight mb-8"
                    >
                        Infrastructure at the
                        <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 animate-gradient-x">
                            Speed of Thought
                        </span>
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className="text-lg md:text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed"
                    >
                        Turn plain English into validated, deployable cloud architectures.
                        Visualize your network, validate security rules, and export Terraform in seconds.
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.3 }}
                        className="flex flex-col sm:flex-row items-center justify-center gap-4"
                    >
                        <Link
                            to="/app"
                            className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)] active:scale-95"
                        >
                            Start Generating
                        </Link>
                        <a
                            href="#"
                            className="w-full sm:w-auto px-8 py-3.5 rounded-full border border-gray-700 hover:border-gray-600 bg-gray-900/50 hover:bg-gray-800 text-gray-300 transition-all font-medium"
                        >
                            View Documentation
                        </a>
                    </motion.div>
                </div>

                {/* Feature Grid */}
                <div className="max-w-7xl mx-auto mt-32 grid grid-cols-1 md:grid-cols-3 gap-8">
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
