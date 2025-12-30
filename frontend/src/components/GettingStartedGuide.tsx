import { Copy, Terminal, Globe, Database, Key } from 'lucide-react';
import { useState } from 'react';

interface GettingStartedGuideProps {
    region: string;
    topology: any;
}

export function GettingStartedGuide({ region, topology }: GettingStartedGuideProps) {
    const [copiedCommand, setCopiedCommand] = useState<string | null>(null);

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedCommand(id);
        setTimeout(() => setCopiedCommand(null), 2000);
    };

    // Check what resources were created
    const hasEC2 = topology?.nodes.some((n: any) => n.kind === 'compute_instance');
    const hasDB = topology?.nodes.some((n: any) => n.kind === 'database');
    const hasLoadBalancer = topology?.nodes.some((n: any) => n.kind === 'load_balancer');

    return (
        <div className="p-4 bg-gradient-to-br from-green-900/20 to-blue-900/20 border border-green-700/30 rounded-lg">
            <h3 className="text-sm font-semibold text-green-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Key className="w-4 h-4" />
                Getting Started
            </h3>

            <div className="space-y-4 text-sm">
                {/* Step 1: View in AWS Console */}
                <div>
                    <p className="text-gray-300 mb-2">
                        <strong className="text-white">1. View Your Resources</strong>
                    </p>
                    <p className="text-gray-400 text-xs mb-2">
                        Click on resources in the <strong>AWS Status</strong> tab to view them in AWS Console
                    </p>
                </div>

                {/* Step 2: EC2 Connection */}
                {hasEC2 && (
                    <div>
                        <p className="text-gray-300 mb-2">
                            <strong className="text-white">2. Connect to Your Instance</strong>
                        </p>
                        <p className="text-gray-400 text-xs mb-2">
                            Go to EC2 → Select your instance → Click "Connect"
                        </p>

                        <div className="relative group">
                            <div className="p-2 bg-black/40 rounded font-mono text-xs text-green-400 overflow-x-auto">
                                # In AWS EC2 Console:
                                <br />
                                1. Click "Connect" button
                                <br />
                                2. Choose "EC2 Instance Connect"
                                <br />
                                3. Click "Connect" to open terminal
                            </div>
                        </div>

                        <p className="text-gray-400 text-xs mt-2">
                            Or use SSH (requires key pair):
                        </p>
                        <div className="relative group mt-1">
                            <button
                                onClick={() => copyToClipboard('ssh -i your-key.pem ec2-user@YOUR_PUBLIC_IP', 'ssh')}
                                className="absolute top-2 right-2 p-1 bg-white/10 hover:bg-white/20 rounded text-gray-400 hover:text-white transition-colors"
                            >
                                <Copy className="w-3 h-3" />
                            </button>
                            <div className="p-2 bg-black/40 rounded font-mono text-xs text-gray-300 overflow-x-auto pr-10">
                                ssh -i your-key.pem ec2-user@YOUR_PUBLIC_IP
                            </div>
                            {copiedCommand === 'ssh' && (
                                <span className="absolute -top-6 right-2 text-xs text-green-400">Copied!</span>
                            )}
                        </div>
                    </div>
                )}

                {/* Step 3: Database Connection */}
                {hasDB && (
                    <div>
                        <p className="text-gray-300 mb-2">
                            <strong className="text-white">3. Connect to Database</strong>
                        </p>
                        <p className="text-gray-400 text-xs mb-2">
                            Find endpoint in RDS Console
                        </p>
                        <div className="relative group">
                            <button
                                onClick={() => copyToClipboard('psql -h YOUR_RDS_ENDPOINT -U admin -d mydb', 'db')}
                                className="absolute top-2 right-2 p-1 bg-white/10 hover:bg-white/20 rounded text-gray-400 hover:text-white transition-colors"
                            >
                                <Copy className="w-3 h-3" />
                            </button>
                            <div className="p-2 bg-black/40 rounded font-mono text-xs text-gray-300 overflow-x-auto pr-10">
                                psql -h YOUR_RDS_ENDPOINT -U admin -d mydb
                            </div>
                            {copiedCommand === 'db' && (
                                <span className="absolute -top-6 right-2 text-xs text-green-400">Copied!</span>
                            )}
                        </div>
                    </div>
                )}

                {/* Step 4: Security Groups */}
                <div>
                    <p className="text-gray-300 mb-2">
                        <strong className="text-white">{hasDB ? '4' : hasEC2 ? '3' : '2'}. Security & Access</strong>
                    </p>
                    <p className="text-gray-400 text-xs">
                        Your security groups allow:<br />
                        • HTTP (80), HTTPS (443) from anywhere<br />
                        • SSH (22) from anywhere (⚠️ restrict in production!)
                    </p>
                </div>

                {/* Next Steps */}
                <div className="pt-3 border-t border-white/10">
                    <p className="text-gray-300 mb-1">
                        <strong className="text-white">Next Steps:</strong>
                    </p>
                    <ul className="text-gray-400 text-xs space-y-1 list-disc list-inside">
                        {hasEC2 && <li>Install your application on the EC2 instance</li>}
                        {hasDB && <li>Configure database users and import data</li>}
                        {hasLoadBalancer && <li>Configure load balancer health checks</li>}
                        <li>Set up CloudWatch monitoring and alarms</li>
                        <li>Configure backups and disaster recovery</li>
                    </ul>
                </div>

                {/* Help Links */}
                <div className="pt-3 border-t border-white/10">
                    <p className="text-gray-400 text-xs mb-2">
                        <strong className="text-white">Helpful Resources:</strong>
                    </p>
                    <div className="space-y-1">
                        <a
                            href={`https://${region}.console.aws.amazon.com/ec2/home?region=${region}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                        >
                            <Globe className="w-3 h-3" />
                            EC2 Console →
                        </a>
                        <a
                            href="https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-instance-connect-methods.html"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                        >
                            <Terminal className="w-3 h-3" />
                            EC2 Connect Guide →
                        </a>
                        {hasDB && (
                            <a
                                href="https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_GettingStarted.html"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                            >
                                <Database className="w-3 h-3" />
                                RDS Setup Guide →
                            </a>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
