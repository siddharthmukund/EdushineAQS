import React, { useEffect, useState } from 'react';
import { Code2, Zap, BarChart2, Workflow, FileText, Grid, X, Copy, Check, Loader2 } from 'lucide-react';
import { getMarketplaceApps, registerDeveloperApp } from '../services/api';

const CATEGORIES = [
    { value: '', label: 'All', icon: Grid },
    { value: 'analytics', label: 'Analytics', icon: BarChart2 },
    { value: 'integration', label: 'Integration', icon: Zap },
    { value: 'workflow', label: 'Workflow', icon: Workflow },
    { value: 'reporting', label: 'Reporting', icon: FileText },
];

const CATEGORY_COLORS: Record<string, string> = {
    analytics: 'bg-blue-100 text-blue-700',
    integration: 'bg-yellow-100 text-yellow-700',
    workflow: 'bg-purple-100 text-purple-700',
    reporting: 'bg-green-100 text-green-700',
    other: 'bg-gray-100 text-gray-600',
};

const DEMO_APPS = [
    {
        id: 'demo-1', name: 'AQS Analytics Pro', developer_email: 'team@aqsanalytics.com',
        category: 'analytics', description: 'Deep-dive analytics dashboard with cohort analysis and trend prediction for hiring committees.',
        total_requests: 12400,
    },
    {
        id: 'demo-2', name: 'HR Connect Bridge', developer_email: 'dev@hrconnect.io',
        category: 'integration', description: 'Bi-directional sync between AQS and major HRIS platforms including Workday, SAP SuccessFactors, and BambooHR.',
        total_requests: 8750,
    },
    {
        id: 'demo-3', name: 'Faculty Pipeline Pro', developer_email: 'contact@fpipeline.edu',
        category: 'workflow', description: 'End-to-end faculty recruitment workflow with automated shortlisting, calendar scheduling, and decision tracking.',
        total_requests: 6200,
    },
];

interface AppCard {
    id: string;
    name: string;
    developer_email: string;
    category: string;
    description: string | null;
    total_requests: number;
}

function AppCardUI({ app }: { app: AppCard }) {
    const [installed, setInstalled] = useState(false);
    const colorClass = CATEGORY_COLORS[app.category] || CATEGORY_COLORS.other;
    const label = CATEGORIES.find(c => c.value === app.category)?.label || app.category;

    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0">
                    <Code2 className="w-5 h-5 text-indigo-600" />
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colorClass}`}>{label}</span>
            </div>

            <div>
                <h3 className="font-bold text-gray-900 text-sm">{app.name}</h3>
                <p className="text-xs text-gray-400 mt-0.5">by {app.developer_email}</p>
            </div>

            {app.description && (
                <p className="text-xs text-gray-600 leading-relaxed flex-1">{app.description}</p>
            )}

            <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">{app.total_requests.toLocaleString()} API calls</span>
                <button
                    onClick={() => setInstalled(i => !i)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${installed ? 'bg-green-100 text-green-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                >
                    {installed ? '✓ Connected' : 'Install'}
                </button>
            </div>
        </div>
    );
}

interface RegisterFormState {
    name: string;
    developer_email: string;
    description: string;
    webhook_url: string;
    category: string;
}

export const AppMarketplace: React.FC = () => {
    const [category, setCategory] = useState('');
    const [marketplaceApps, setMarketplaceApps] = useState<AppCard[]>([]);
    const [showRegister, setShowRegister] = useState(false);
    const [form, setForm] = useState<RegisterFormState>({
        name: '', developer_email: '', description: '', webhook_url: '', category: 'other',
    });
    const [registering, setRegistering] = useState(false);
    const [apiKey, setApiKey] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        getMarketplaceApps(category || undefined)
            .then(r => setMarketplaceApps(r.apps))
            .catch(() => setMarketplaceApps([]));
    }, [category]);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setRegistering(true);
        try {
            const result = await registerDeveloperApp({
                name: form.name,
                developer_email: form.developer_email,
                description: form.description || undefined,
                webhook_url: form.webhook_url || undefined,
                category: form.category,
            });
            setApiKey(result.api_key);
        } catch { /* silent */ } finally {
            setRegistering(false);
        }
    };

    const handleCopy = () => {
        if (apiKey) {
            navigator.clipboard.writeText(apiKey);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    // Merge demo + real marketplace apps, de-dupe by id
    const allApps = [...DEMO_APPS, ...marketplaceApps.filter(a => !DEMO_APPS.find(d => d.id === a.id))]
        .filter(a => !category || a.category === category);

    return (
        <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
            {/* Hero */}
            <div className="bg-gradient-to-br from-indigo-900 to-blue-900 rounded-2xl p-8 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/5 -mr-20 -mt-20 blur-3xl" />
                <div className="relative z-10 flex items-start justify-between gap-6">
                    <div>
                        <h1 className="text-3xl font-black tracking-tight">Developer Ecosystem</h1>
                        <p className="text-indigo-200 text-sm mt-2 max-w-lg">
                            Extend the AQS platform with third-party apps, integrations, and workflows.
                            Build your own and list it in the marketplace.
                        </p>
                        <div className="flex gap-3 mt-4 text-xs text-indigo-300">
                            <span>✦ 70/30 revenue share</span>
                            <span>✦ Webhook events</span>
                            <span>✦ 1,000 req/hr free tier</span>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowRegister(true)}
                        className="shrink-0 px-5 py-3 bg-white text-indigo-900 rounded-xl font-bold text-sm hover:bg-indigo-50 transition-colors"
                    >
                        Register Your App
                    </button>
                </div>
            </div>

            {/* Category filter */}
            <div className="flex gap-2 flex-wrap">
                {CATEGORIES.map(cat => {
                    const Icon = cat.icon;
                    return (
                        <button
                            key={cat.value}
                            onClick={() => setCategory(cat.value)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${category === cat.value ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300'}`}
                        >
                            <Icon className="w-3.5 h-3.5" />
                            {cat.label}
                        </button>
                    );
                })}
            </div>

            {/* App grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {allApps.map(app => <AppCardUI key={app.id} app={app} />)}
            </div>

            {/* Bottom CTA */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6 text-center space-y-3">
                <h3 className="font-bold text-indigo-900">Build on the AQS API</h3>
                <p className="text-sm text-indigo-700">
                    Access candidate scores, batch results, and committee decisions via our REST API.
                    Rate-limited at 1,000 req/hr on the free tier — upgrade for more.
                </p>
                <button
                    onClick={() => setShowRegister(true)}
                    className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700"
                >
                    Get Started — Register App
                </button>
            </div>

            {/* Registration modal */}
            {showRegister && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-gray-900 text-lg">Register Developer App</h3>
                            <button onClick={() => { setShowRegister(false); setApiKey(null); }} className="p-1 text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {apiKey ? (
                            <div className="space-y-4">
                                <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center space-y-2">
                                    <p className="text-sm font-semibold text-green-800">App registered successfully!</p>
                                    <p className="text-xs text-green-700">Save your API key now — it will not be shown again.</p>
                                </div>
                                <div className="bg-gray-900 rounded-xl p-4 flex items-center gap-3">
                                    <code className="flex-1 text-green-400 text-xs font-mono break-all">{apiKey}</code>
                                    <button onClick={handleCopy} className="shrink-0 p-1.5 text-gray-400 hover:text-white">
                                        {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                                    </button>
                                </div>
                                <p className="text-xs text-gray-500 text-center">
                                    Use <code className="bg-gray-100 px-1 rounded">X-API-Key: {apiKey.slice(0, 12)}…</code> in your requests.
                                </p>
                                <button
                                    onClick={() => { setShowRegister(false); setApiKey(null); }}
                                    className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700"
                                >
                                    Done
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleRegister} className="space-y-3">
                                {[
                                    { field: 'name', label: 'App Name *', placeholder: 'My Awesome Integration', required: true, type: 'text' },
                                    { field: 'developer_email', label: 'Developer Email *', placeholder: 'you@company.com', required: true, type: 'email' },
                                    { field: 'description', label: 'Description', placeholder: 'What does your app do?', required: false, type: 'text' },
                                    { field: 'webhook_url', label: 'Webhook URL (optional)', placeholder: 'https://yourapp.com/webhooks/aqs', required: false, type: 'url' },
                                ].map(({ field, label, placeholder, required, type }) => (
                                    <div key={field}>
                                        <label className="text-xs font-medium text-gray-600">{label}</label>
                                        <input
                                            type={type}
                                            required={required}
                                            value={form[field as keyof RegisterFormState]}
                                            onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                                            placeholder={placeholder}
                                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                        />
                                    </div>
                                ))}
                                <div>
                                    <label className="text-xs font-medium text-gray-600">Category</label>
                                    <select
                                        value={form.category}
                                        onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
                                    >
                                        {CATEGORIES.filter(c => c.value).map(c => (
                                            <option key={c.value} value={c.value}>{c.label}</option>
                                        ))}
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                                <button
                                    type="submit"
                                    disabled={registering}
                                    className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 disabled:opacity-60 flex items-center justify-center gap-2"
                                >
                                    {registering ? <><Loader2 className="w-4 h-4 animate-spin" /> Registering…</> : 'Register & Get API Key'}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
