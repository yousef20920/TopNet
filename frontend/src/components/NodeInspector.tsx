// src/components/NodeInspector.tsx
// Side panel for inspecting and editing selected node properties

import { useState, useEffect } from 'react';
import type { BaseNode, ApplicationConfig, EnvironmentVariable, ProjectType } from '../types/topology';
import {
  Save,
  GitBranch,
  Plus,
  Trash2,
  Code2,
  Terminal,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Link2,
  Play,
  Wrench,
  Globe,
  Lock,
  Info
} from 'lucide-react';
import { generateUserDataPreview, validateApplicationConfig } from '../utils/userDataGenerator';

interface NodeInspectorProps {
  node: BaseNode | null;
  allNodes?: BaseNode[];
  onUpdate?: (nodeId: string, newProps: Record<string, unknown>) => void;
}

const PROJECT_TYPES: { value: ProjectType; label: string; icon: string }[] = [
  { value: 'nodejs', label: 'Node.js', icon: '🟢' },
  { value: 'python', label: 'Python', icon: '🐍' },
  { value: 'go', label: 'Go', icon: '🔵' },
  { value: 'java', label: 'Java', icon: '☕' },
  { value: 'ruby', label: 'Ruby', icon: '💎' },
  { value: 'php', label: 'PHP', icon: '🐘' },
  { value: 'static', label: 'Static Site', icon: '📄' },
  { value: 'docker', label: 'Docker', icon: '🐳' },
  { value: 'custom', label: 'Custom', icon: '⚙️' },
];

// Get available node references for env var autocomplete
function getAvailableReferences(nodes: BaseNode[]): { label: string; value: string; description: string }[] {
  const refs: { label: string; value: string; description: string }[] = [];

  for (const node of nodes) {
    const nodeName = node.name || node.id;

    switch (node.kind) {
      case 'database':
        refs.push(
          { label: `${nodeName}.endpoint`, value: `{{${nodeName}.endpoint}}`, description: 'Database connection endpoint' },
          { label: `${nodeName}.port`, value: `{{${nodeName}.port}}`, description: 'Database port' },
          { label: `${nodeName}.address`, value: `{{${nodeName}.address}}`, description: 'Database address (without port)' }
        );
        break;
      case 'compute_instance':
        refs.push(
          { label: `${nodeName}.private_ip`, value: `{{${nodeName}.private_ip}}`, description: 'Private IP address' },
          { label: `${nodeName}.public_ip`, value: `{{${nodeName}.public_ip}}`, description: 'Public IP address' }
        );
        break;
      case 'load_balancer':
        refs.push(
          { label: `${nodeName}.dns_name`, value: `{{${nodeName}.dns_name}}`, description: 'Load balancer DNS name' }
        );
        break;
    }
  }

  return refs;
}

export function NodeInspector({ node, allNodes = [], onUpdate }: NodeInspectorProps) {
  const [props, setProps] = useState<Record<string, unknown>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [appConfigExpanded, setAppConfigExpanded] = useState(true);
  const [envVarsExpanded, setEnvVarsExpanded] = useState(true);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<number, boolean>>({});

  // Application config state
  const [appConfig, setAppConfig] = useState<ApplicationConfig>({});

  // Sync local state when node changes
  useEffect(() => {
    if (node) {
      setProps(node.props || {});
      setAppConfig(node.props?.application || {});
      setIsDirty(false);
    }
  }, [node]);

  if (!node) {
    return (
      <div className="p-4 text-gray-400">
        <p className="text-sm">Select a node to view its properties</p>
      </div>
    );
  }

  const handlePropChange = (key: string, value: string) => {
    // Try to parse numbers or booleans
    let parsedValue: string | number | boolean = value;
    if (value === 'true') parsedValue = true;
    else if (value === 'false') parsedValue = false;
    else if (!isNaN(Number(value)) && value.trim() !== '') parsedValue = Number(value);

    setProps(prev => ({
      ...prev,
      [key]: parsedValue
    }));
    setIsDirty(true);
  };

  const handleAppConfigChange = (updates: Partial<ApplicationConfig>) => {
    const newConfig = { ...appConfig, ...updates };
    setAppConfig(newConfig);
    setProps(prev => ({
      ...prev,
      application: newConfig
    }));
    setIsDirty(true);
  };

  const handleSourceChange = (field: string, value: string | number) => {
    const newSource = { ...(appConfig.source || { repoUrl: '', projectType: 'nodejs' as ProjectType }), [field]: value };
    handleAppConfigChange({ source: newSource });
  };

  const handleEnvVarChange = (index: number, field: keyof EnvironmentVariable, value: string | boolean) => {
    const newEnvVars = [...(appConfig.envVars || [])];
    newEnvVars[index] = { ...newEnvVars[index], [field]: value };
    handleAppConfigChange({ envVars: newEnvVars });
  };

  const addEnvVar = () => {
    const newEnvVars = [...(appConfig.envVars || []), { key: '', value: '' }];
    handleAppConfigChange({ envVars: newEnvVars });
  };

  const removeEnvVar = (index: number) => {
    const newEnvVars = (appConfig.envVars || []).filter((_, i) => i !== index);
    handleAppConfigChange({ envVars: newEnvVars });
  };

  const handleSave = () => {
    if (onUpdate && node) {
      onUpdate(node.id, props);
      setIsDirty(false);
    }
  };

  const isComputeInstance = node.kind === 'compute_instance';
  const validationErrors = isComputeInstance ? validateApplicationConfig(appConfig) : [];
  const deploymentPreview = isComputeInstance && appConfig.source ? generateUserDataPreview(appConfig) : [];
  const availableRefs = getAvailableReferences(allNodes.filter(n => n.id !== node.id));

  return (
    <div className="p-4 space-y-6 overflow-y-auto h-full pb-20">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-white truncate pr-2">{node.name || node.id}</h3>
          {isDirty && (
            <button
              onClick={handleSave}
              className="p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition-colors"
              title="Save changes"
            >
              <Save className="w-4 h-4" />
            </button>
          )}
        </div>
        <span className="inline-block px-2 py-1 text-xs font-medium bg-indigo-600 text-white rounded">
          {node.kind}
        </span>
      </div>

      {/* Details */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-300 uppercase tracking-wider text-xs border-b border-gray-700 pb-1">Details</h4>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between items-center group">
            <dt className="text-gray-400">ID</dt>
            <dd className="text-gray-200 font-mono text-xs bg-gray-900 px-2 py-1 rounded select-all">{node.id}</dd>
          </div>
          {node.provider && (
            <div className="flex justify-between items-center">
              <dt className="text-gray-400">Provider</dt>
              <dd className="text-gray-200">{node.provider}</dd>
            </div>
          )}
          {node.region && (
            <div className="flex justify-between items-center">
              <dt className="text-gray-400">Region</dt>
              <dd className="text-gray-200">{node.region}</dd>
            </div>
          )}
          {node.az && (
            <div className="flex justify-between items-center">
              <dt className="text-gray-400">AZ</dt>
              <dd className="text-gray-200">{node.az}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Properties */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-gray-700 pb-1">
          <h4 className="text-sm font-medium text-gray-300 uppercase tracking-wider text-xs">Properties</h4>
          <span className="text-[10px] text-gray-500">Editable</span>
        </div>

        {Object.entries(props).filter(([key]) => key !== 'application').length === 0 ? (
          <p className="text-xs text-gray-500 italic">No properties available</p>
        ) : (
          <div className="space-y-3">
            {Object.entries(props)
              .filter(([key]) => key !== 'application')
              .map(([key, value]) => (
              <div key={key} className="space-y-1">
                <label className="text-xs text-gray-400 font-medium block">{key}</label>
                {Array.isArray(value) || typeof value === 'object' ? (
                  <pre className="text-xs bg-gray-900 p-2 rounded text-gray-300 overflow-x-auto border border-gray-800">
                    {JSON.stringify(value, null, 2)}
                  </pre>
                ) : (
                  <input
                    type="text"
                    value={String(value)}
                    onChange={(e) => handlePropChange(key, e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded px-2 py-1.5 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors"
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Application Deployment (only for compute instances) */}
      {isComputeInstance && (
        <div className="space-y-3">
          <button
            onClick={() => setAppConfigExpanded(!appConfigExpanded)}
            className="w-full flex items-center justify-between border-b border-gray-700 pb-1 hover:text-white transition-colors"
          >
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-indigo-400" />
              <h4 className="text-sm font-medium text-gray-300 uppercase tracking-wider text-xs">Application Deployment</h4>
            </div>
            {appConfigExpanded ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>

          {appConfigExpanded && (
            <div className="space-y-4 bg-gray-900/50 rounded-lg p-3 border border-gray-800">
              {/* Repository URL */}
              <div className="space-y-1">
                <label className="text-xs text-gray-400 font-medium flex items-center gap-1">
                  <GitBranch className="w-3 h-3" />
                  GitHub Repository URL
                </label>
                <input
                  type="url"
                  placeholder="https://github.com/user/repo"
                  value={appConfig.source?.repoUrl || ''}
                  onChange={(e) => handleSourceChange('repoUrl', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded px-2 py-1.5 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors placeholder:text-gray-600"
                />
              </div>

              {/* Branch */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs text-gray-400 font-medium">Branch</label>
                  <input
                    type="text"
                    placeholder="main"
                    value={appConfig.source?.branch || ''}
                    onChange={(e) => handleSourceChange('branch', e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded px-2 py-1.5 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors placeholder:text-gray-600"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-gray-400 font-medium">App Port</label>
                  <input
                    type="number"
                    placeholder="3000"
                    value={appConfig.source?.appPort || ''}
                    onChange={(e) => handleSourceChange('appPort', parseInt(e.target.value) || 3000)}
                    className="w-full bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded px-2 py-1.5 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors placeholder:text-gray-600"
                  />
                </div>
              </div>

              {/* Project Type */}
              <div className="space-y-1">
                <label className="text-xs text-gray-400 font-medium flex items-center gap-1">
                  <Wrench className="w-3 h-3" />
                  Project Type
                </label>
                <select
                  value={appConfig.source?.projectType || 'nodejs'}
                  onChange={(e) => handleSourceChange('projectType', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded px-2 py-1.5 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors"
                >
                  {PROJECT_TYPES.map(pt => (
                    <option key={pt.value} value={pt.value}>
                      {pt.icon} {pt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Custom Commands (optional) */}
              <div className="space-y-2">
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Terminal className="w-3 h-3" />
                  <span>Custom Commands (optional)</span>
                </div>
                <div className="space-y-2">
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500">Build Command</label>
                    <input
                      type="text"
                      placeholder="npm run build"
                      value={appConfig.source?.buildCommand || ''}
                      onChange={(e) => handleSourceChange('buildCommand', e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded px-2 py-1 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors font-mono placeholder:text-gray-600"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500">Start Command</label>
                    <input
                      type="text"
                      placeholder="npm start"
                      value={appConfig.source?.startCommand || ''}
                      onChange={(e) => handleSourceChange('startCommand', e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded px-2 py-1 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors font-mono placeholder:text-gray-600"
                    />
                  </div>
                </div>
              </div>

              {/* Additional Options */}
              <div className="space-y-2 pt-2 border-t border-gray-800">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="enablePm2"
                    checked={appConfig.enableProcessManager || false}
                    onChange={(e) => handleAppConfigChange({ enableProcessManager: e.target.checked })}
                    className="rounded bg-gray-800 border-gray-700 text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="enablePm2" className="text-xs text-gray-400 flex items-center gap-1">
                    <Play className="w-3 h-3" />
                    Enable PM2 (Node.js process manager)
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="enableHttps"
                    checked={appConfig.enableHttps || false}
                    onChange={(e) => handleAppConfigChange({ enableHttps: e.target.checked })}
                    className="rounded bg-gray-800 border-gray-700 text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="enableHttps" className="text-xs text-gray-400 flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    Enable HTTPS (Let's Encrypt)
                  </label>
                </div>
                {appConfig.enableHttps && (
                  <div className="pl-5 space-y-1">
                    <label className="text-[10px] text-gray-500 flex items-center gap-1">
                      <Globe className="w-3 h-3" />
                      Domain Name
                    </label>
                    <input
                      type="text"
                      placeholder="myapp.example.com"
                      value={appConfig.domain || ''}
                      onChange={(e) => handleAppConfigChange({ domain: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded px-2 py-1 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors placeholder:text-gray-600"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Environment Variables (only for compute instances with app config) */}
      {isComputeInstance && appConfig.source?.repoUrl && (
        <div className="space-y-3">
          <button
            onClick={() => setEnvVarsExpanded(!envVarsExpanded)}
            className="w-full flex items-center justify-between border-b border-gray-700 pb-1 hover:text-white transition-colors"
          >
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <h4 className="text-sm font-medium text-gray-300 uppercase tracking-wider text-xs">
                Environment Variables
              </h4>
              {(appConfig.envVars?.length || 0) > 0 && (
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">
                  {appConfig.envVars?.length}
                </span>
              )}
            </div>
            {envVarsExpanded ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>

          {envVarsExpanded && (
            <div className="space-y-3 bg-gray-900/50 rounded-lg p-3 border border-gray-800">
              {/* Info about node references */}
              {availableRefs.length > 0 && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-2 text-xs">
                  <div className="flex items-start gap-2">
                    <Info className="w-3 h-3 text-blue-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-blue-300 font-medium">Dynamic References Available</p>
                      <p className="text-blue-300/70 mt-1">Use <code className="bg-blue-500/20 px-1 rounded">{'{{NodeName.property}}'}</code> to reference other nodes:</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {availableRefs.slice(0, 4).map(ref => (
                          <button
                            key={ref.value}
                            onClick={() => navigator.clipboard.writeText(ref.value)}
                            className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded hover:bg-blue-500/30 transition-colors"
                            title={`${ref.description} - Click to copy`}
                          >
                            {ref.label}
                          </button>
                        ))}
                        {availableRefs.length > 4 && (
                          <span className="text-[10px] text-blue-300/50">+{availableRefs.length - 4} more</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Env var list */}
              {(appConfig.envVars || []).map((envVar, index) => (
                <div key={index} className="flex items-start gap-2">
                  <div className="flex-1 space-y-1">
                    <input
                      type="text"
                      placeholder="KEY_NAME"
                      value={envVar.key}
                      onChange={(e) => handleEnvVarChange(index, 'key', e.target.value.toUpperCase())}
                      className="w-full bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded px-2 py-1 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors font-mono placeholder:text-gray-600"
                    />
                    <div className="relative">
                      <input
                        type={envVar.isSecret && !showSecrets[index] ? 'password' : 'text'}
                        placeholder="value or {{Node.property}}"
                        value={envVar.value}
                        onChange={(e) => handleEnvVarChange(index, 'value', e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded px-2 py-1 pr-16 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors font-mono placeholder:text-gray-600"
                      />
                      <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        {envVar.isSecret && (
                          <button
                            onClick={() => setShowSecrets(prev => ({ ...prev, [index]: !prev[index] }))}
                            className="p-0.5 text-gray-500 hover:text-gray-300 transition-colors"
                            title={showSecrets[index] ? 'Hide value' : 'Show value'}
                          >
                            {showSecrets[index] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          </button>
                        )}
                        <button
                          onClick={() => handleEnvVarChange(index, 'isSecret', !envVar.isSecret)}
                          className={`p-0.5 transition-colors ${envVar.isSecret ? 'text-amber-400' : 'text-gray-500 hover:text-gray-300'}`}
                          title={envVar.isSecret ? 'Mark as non-secret' : 'Mark as secret'}
                        >
                          <Lock className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => removeEnvVar(index)}
                    className="p-1 text-gray-500 hover:text-red-400 transition-colors mt-1"
                    title="Remove variable"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              <button
                onClick={addEnvVar}
                className="w-full flex items-center justify-center gap-1 py-1.5 text-xs text-gray-400 hover:text-white border border-dashed border-gray-700 hover:border-gray-500 rounded transition-colors"
              >
                <Plus className="w-3 h-3" />
                Add Variable
              </button>

              {/* Common templates */}
              <div className="pt-2 border-t border-gray-800">
                <p className="text-[10px] text-gray-500 mb-2">Quick Add:</p>
                <div className="flex flex-wrap gap-1">
                  {[
                    { key: 'NODE_ENV', value: 'production' },
                    { key: 'PORT', value: String(appConfig.source?.appPort || 3000) },
                    { key: 'DATABASE_URL', value: availableRefs.find(r => r.label.includes('endpoint'))?.value || '' },
                  ].map(template => (
                    <button
                      key={template.key}
                      onClick={() => {
                        if (!(appConfig.envVars || []).find(e => e.key === template.key)) {
                          handleAppConfigChange({
                            envVars: [...(appConfig.envVars || []), template]
                          });
                        }
                      }}
                      disabled={(appConfig.envVars || []).some(e => e.key === template.key)}
                      className="text-[10px] bg-gray-800 text-gray-400 px-2 py-1 rounded hover:bg-gray-700 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {template.key}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Deployment Preview */}
      {isComputeInstance && appConfig.source?.repoUrl && (
        <div className="space-y-3">
          <button
            onClick={() => setPreviewExpanded(!previewExpanded)}
            className="w-full flex items-center justify-between border-b border-gray-700 pb-1 hover:text-white transition-colors"
          >
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-purple-400" />
              <h4 className="text-sm font-medium text-gray-300 uppercase tracking-wider text-xs">
                Deployment Preview
              </h4>
            </div>
            {previewExpanded ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>

          {previewExpanded && (
            <div className="space-y-2 bg-gray-900/50 rounded-lg p-3 border border-gray-800">
              {/* Validation errors */}
              {validationErrors.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 mb-2">
                  <p className="text-xs text-red-400 font-medium mb-1">Configuration Issues:</p>
                  <ul className="text-xs text-red-300/70 space-y-1 list-disc list-inside">
                    {validationErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Preview steps */}
              <p className="text-[10px] text-gray-500 mb-2">On instance launch, this will:</p>
              <ol className="text-xs text-gray-300 space-y-1.5">
                {deploymentPreview.map((step, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-indigo-400 font-mono text-[10px] mt-0.5">{i + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>

              <div className="pt-2 border-t border-gray-800 text-[10px] text-gray-500">
                User data script will be generated automatically during deployment
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tags */}
      {node.tags && Object.keys(node.tags).length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-300 uppercase tracking-wider text-xs border-b border-gray-700 pb-1">Tags</h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(node.tags).map(([key, value]) => (
              <span
                key={key}
                className="inline-flex items-center px-2 py-1 text-xs bg-gray-800 border border-gray-700 text-gray-300 rounded-md"
              >
                <span className="font-medium text-gray-400 mr-1">{key}:</span> {value}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
