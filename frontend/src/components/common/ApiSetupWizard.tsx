/**
 * ApiSetupWizard — guides admins / first-time users through configuring
 * an LLM API key so the app can analyse CVs.
 *
 * Steps:
 *  1. Intro  – explains why a key is needed
 *  2. Choose – pick Anthropic / OpenAI / Gemini
 *  3. Get    – sign-up link + how to copy the key
 *  4. Config – exact .env line + docker restart command (copy buttons)
 *  5. Verify – ping /api/config/status until the key goes green
 */
import React, { useState, useCallback, useRef } from 'react';
import {
    X, Sparkles, Key, ExternalLink, Copy, Check,
    RefreshCw, CheckCircle2, XCircle, ChevronRight, ChevronLeft,
    Zap, DollarSign, Shield, Eye, EyeOff, AlertCircle,
} from 'lucide-react';
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ── Types ──────────────────────────────────────────────────────────────────

type Provider = 'anthropic' | 'openai' | 'gemini';

interface ProviderInfo {
    id: Provider;
    name: string;
    tagline: string;
    recommended: boolean;
    free: boolean;
    freeNote: string;
    consoleUrl: string;
    envKey: string;
    keyPrefix: string;
    color: string;
    bg: string;
    logo: React.ReactNode;
}

interface Props {
    onClose: () => void;
    /** Called when /api/config/status confirms any_configured = true */
    onConfigured?: () => void;
}

// ── Provider catalogue ─────────────────────────────────────────────────────

const PROVIDERS: ProviderInfo[] = [
    {
        id: 'anthropic',
        name: 'Anthropic Claude',
        tagline: 'Best accuracy for academic CV analysis — recommended',
        recommended: true,
        free: false,
        freeNote: '$5 free credits on sign-up',
        consoleUrl: 'https://console.anthropic.com/settings/keys',
        envKey: 'ANTHROPIC_API_KEY',
        keyPrefix: 'sk-ant-',
        color: 'text-orange-700',
        bg: 'bg-orange-50 border-orange-200',
        logo: (
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
                <path d="M13.827 3.52L19.8 18h-3.04l-1.2-3.24H8.44L7.24 18H4.2l5.973-14.48h3.654zm-1.827 4.09-2.16 5.76h4.32l-2.16-5.76z"
                    fill="#D97706" />
            </svg>
        ),
    },
    {
        id: 'openai',
        name: 'OpenAI GPT-4',
        tagline: 'High-quality analysis with GPT-4o or GPT-4 Turbo',
        recommended: false,
        free: false,
        freeNote: '$18 free trial credits (new accounts)',
        consoleUrl: 'https://platform.openai.com/api-keys',
        envKey: 'OPENAI_API_KEY',
        keyPrefix: 'sk-',
        color: 'text-emerald-700',
        bg: 'bg-emerald-50 border-emerald-200',
        logo: (
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
                <path d="M22.28 9.81a5.56 5.56 0 0 0-.48-4.57 5.64 5.64 0 0 0-6.07-2.71A5.64 5.64 0 0 0 11.5 1a5.63 5.63 0 0 0-5.37 3.9A5.64 5.64 0 0 0 2.4 7.55a5.64 5.64 0 0 0 .69 6.64 5.56 5.56 0 0 0 .48 4.57 5.64 5.64 0 0 0 6.07 2.71A5.62 5.62 0 0 0 12.5 23a5.63 5.63 0 0 0 5.37-3.91 5.63 5.63 0 0 0 3.73-2.65 5.64 5.64 0 0 0-.69-6.63H22.28z"
                    fill="#10B981" />
            </svg>
        ),
    },
    {
        id: 'gemini',
        name: 'Google Gemini',
        tagline: 'Free tier available — Gemini 3 Flash/3.1 Flash Lite are the latest models',
        recommended: false,
        free: true,
        freeNote: 'Free tier: Gemini 3.1 Flash Lite, Gemini 3 Flash, or Gemini 2.0 Flash (stable)',
        consoleUrl: 'https://aistudio.google.com/app/apikey',
        envKey: 'GEMINI_API_KEY',
        keyPrefix: 'AIza',
        color: 'text-blue-700',
        bg: 'bg-blue-50 border-blue-200',
        logo: (
            <svg className="w-6 h-6" viewBox="0 0 24 24">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                    stroke="#2563EB" strokeWidth="2" fill="none" strokeLinecap="round" />
            </svg>
        ),
    },
];

// ── Tiny helpers ───────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    const copy = () => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <button
            onClick={copy}
            className="ml-2 p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0"
            title="Copy"
        >
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
        </button>
    );
}

// ── Step components ────────────────────────────────────────────────────────

function StepIntro({ onNext }: { onNext: () => void }) {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 mx-auto">
                <Key className="w-8 h-8 text-white" />
            </div>
            <div className="text-center">
                <h2 className="text-xl font-bold text-gray-900">Set up your LLM API key</h2>
                <p className="text-gray-500 mt-2 text-sm leading-relaxed">
                    AQS uses a large language model to read and score academic CVs.
                    You need an API key from one of our supported providers.
                    It takes about 2 minutes.
                </p>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
                {[
                    { icon: <Zap className="w-5 h-5 text-yellow-500" />, label: '~2 min setup' },
                    { icon: <DollarSign className="w-5 h-5 text-green-500" />, label: 'Pay-as-you-go' },
                    { icon: <Shield className="w-5 h-5 text-blue-500" />, label: 'Key stays local' },
                ].map(({ icon, label }) => (
                    <div key={label} className="bg-gray-50 rounded-xl p-3 flex flex-col items-center gap-1">
                        {icon}
                        <span className="text-xs font-medium text-gray-600">{label}</span>
                    </div>
                ))}
            </div>

            <button
                onClick={onNext}
                className="w-full bg-blue-600 text-white rounded-xl py-3 font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
                Get started <ChevronRight className="w-4 h-4" />
            </button>
        </div>
    );
}

function StepChoose({ onNext }: { onNext: (p: Provider) => void }) {
    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-lg font-bold text-gray-900">Choose a provider</h2>
                <p className="text-sm text-gray-500 mt-1">
                    All providers work with AQS. You only need one.
                </p>
            </div>

            <div className="space-y-3">
                {PROVIDERS.map((p) => (
                    <button
                        key={p.id}
                        onClick={() => onNext(p.id)}
                        className={`w-full text-left rounded-xl border-2 p-4 transition-all hover:shadow-md ${p.bg} group`}
                    >
                        <div className="flex items-center gap-3">
                            <div className="shrink-0">{p.logo}</div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`font-semibold text-sm ${p.color}`}>{p.name}</span>
                                    {p.recommended && (
                                        <span className="text-xs bg-orange-100 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-full font-medium">
                                            Recommended
                                        </span>
                                    )}
                                    {p.free && (
                                        <span className="text-xs bg-green-100 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-medium">
                                            Free tier
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-gray-500 mt-0.5">{p.tagline}</p>
                                <p className="text-xs text-gray-400 mt-0.5">{p.freeNote}</p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-400 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}

function StepGetKey({ provider, onNext, onBack }: { provider: Provider; onNext: () => void; onBack: () => void }) {
    const p = PROVIDERS.find(x => x.id === provider)!;
    return (
        <div className="space-y-5">
            <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600">
                <ChevronLeft className="w-4 h-4" /> Back
            </button>

            <div className="flex items-center gap-3">
                {p.logo}
                <div>
                    <h2 className="text-lg font-bold text-gray-900">Get your {p.name} key</h2>
                    <p className="text-xs text-gray-400">{p.freeNote}</p>
                </div>
            </div>

            <ol className="space-y-4">
                <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center mt-0.5">1</span>
                    <div>
                        <p className="text-sm font-medium text-gray-800">Open the {p.name} console</p>
                        <a
                            href={p.consoleUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 mt-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-colors"
                        >
                            Open console <ExternalLink className="w-3 h-3" />
                        </a>
                    </div>
                </li>
                <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center mt-0.5">2</span>
                    <div>
                        <p className="text-sm font-medium text-gray-800">Create a new API key</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Look for "Create key", "New secret key", or a <strong>+</strong> button on the keys page.
                        </p>
                    </div>
                </li>
                <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center mt-0.5">3</span>
                    <div>
                        <p className="text-sm font-medium text-gray-800">Copy the key</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                            It starts with <code className="bg-gray-100 px-1 rounded">{p.keyPrefix}</code>.
                            Store it safely — you'll paste it in the next step.
                        </p>
                    </div>
                </li>
            </ol>

            <button
                onClick={onNext}
                className="w-full bg-blue-600 text-white rounded-xl py-3 font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
                I have my key <ChevronRight className="w-4 h-4" />
            </button>
        </div>
    );
}

function StepConfigure({ provider, onNext, onBack }: {
    provider: Provider;
    onNext: () => void;
    onBack: () => void;
}) {
    const p = PROVIDERS.find(x => x.id === provider)!;
    const [apiKey, setApiKey] = useState('');
    const [showKey, setShowKey] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [saveWarning, setSaveWarning] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const handleSave = useCallback(async () => {
        const trimmed = apiKey.trim();
        if (!trimmed) {
            setSaveError('Please paste your API key first.');
            return;
        }
        setSaving(true);
        setSaveError('');
        setSaveWarning('');
        try {
            const res = await fetch(`${API_BASE}/api/config/llm-key`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ provider, api_key: trimmed }),
            });
            const data = await res.json();
            if (!res.ok) {
                setSaveError(data.detail || `Error ${res.status}`);
                return;
            }
            if (data.warning) setSaveWarning(data.warning);
            // Key saved — move to verify step
            onNext();
        } catch {
            setSaveError('Could not reach the server. Make sure the backend is running.');
        } finally {
            setSaving(false);
        }
    }, [apiKey, provider, onNext]);

    const restartCmd = 'docker compose restart backend celery';

    return (
        <div className="space-y-5">
            <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600">
                <ChevronLeft className="w-4 h-4" /> Back
            </button>

            <div>
                <h2 className="text-lg font-bold text-gray-900">Paste your API key</h2>
                <p className="text-sm text-gray-500 mt-1">
                    The key is saved directly to the server — no manual file editing needed.
                </p>
            </div>

            {/* Key input */}
            <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                    {p.envKey}
                </label>
                <div className="relative">
                    <input
                        ref={inputRef}
                        type={showKey ? 'text' : 'password'}
                        value={apiKey}
                        onChange={e => { setApiKey(e.target.value); setSaveError(''); }}
                        placeholder={`${p.keyPrefix}…`}
                        className="w-full rounded-xl border border-gray-300 px-4 py-3 pr-10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-300"
                        autoFocus
                        autoComplete="off"
                        spellCheck={false}
                    />
                    <button
                        type="button"
                        onClick={() => setShowKey(v => !v)}
                        className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                        title={showKey ? 'Hide key' : 'Show key'}
                    >
                        {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                </div>
                <p className="text-xs text-gray-400 mt-1.5">
                    Starts with <code className="bg-gray-100 px-1 rounded">{p.keyPrefix}</code>.
                    The key is stored only on your server and never transmitted elsewhere.
                </p>
            </div>

            {/* Warnings / errors */}
            {saveWarning && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    {saveWarning}
                </div>
            )}
            {saveError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    {saveError}
                </div>
            )}

            {/* Save button */}
            <button
                onClick={handleSave}
                disabled={saving || !apiKey.trim()}
                className="w-full bg-blue-600 text-white rounded-xl py-3 font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
                {saving ? <><RefreshCw className="w-4 h-4 animate-spin" /> Saving…</> : <>Save key <ChevronRight className="w-4 h-4" /></>}
            </button>

            {/* Fallback: manual .env instructions */}
            <details className="group">
                <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600 select-none">
                    Prefer to edit <code>.env</code> manually instead?
                </summary>
                <div className="mt-3 space-y-3">
                    <div className="flex items-center bg-gray-900 rounded-xl px-4 py-3">
                        <code className="text-green-400 text-xs font-mono flex-1 break-all">
                            {p.envKey}=your-key-here
                        </code>
                        <CopyButton text={`${p.envKey}=your-key-here`} />
                    </div>
                    <p className="text-xs text-gray-500">
                        Edit the <code className="bg-gray-100 px-1 rounded">.env</code> file in the project root,
                        then restart:
                    </p>
                    <div className="flex items-center bg-gray-900 rounded-xl px-4 py-3">
                        <code className="text-cyan-400 text-xs font-mono flex-1 break-all">{restartCmd}</code>
                        <CopyButton text={restartCmd} />
                    </div>
                    <button
                        onClick={onNext}
                        className="text-xs text-blue-600 hover:underline"
                    >
                        I edited the file manually → go to verify
                    </button>
                </div>
            </details>
        </div>
    );
}

function StepVerify({ provider, onBack, onSuccess }: {
    provider: Provider;
    onBack: () => void;
    onSuccess: () => void;
}) {
    const p = PROVIDERS.find(x => x.id === provider)!;
    const [checking, setChecking] = useState(false);
    const [result, setResult] = useState<'idle' | 'ok' | 'fail'>('idle');

    const check = useCallback(async () => {
        setChecking(true);
        setResult('idle');
        try {
            const res = await fetch(`${API_BASE}/api/config/status`);
            const data = await res.json();
            const llm = data?.llm ?? {};
            if (llm[provider] || llm.any_configured) {
                setResult('ok');
                setTimeout(onSuccess, 1200);
            } else {
                setResult('fail');
            }
        } catch {
            setResult('fail');
        } finally {
            setChecking(false);
        }
    }, [provider, onSuccess]);

    // Auto-check once on mount — the key was just saved via the API, no restart needed
    React.useEffect(() => { check(); }, [check]);

    return (
        <div className="space-y-5">
            <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600">
                <ChevronLeft className="w-4 h-4" /> Back
            </button>

            <div>
                <h2 className="text-lg font-bold text-gray-900">Verifying your key…</h2>
                <p className="text-sm text-gray-500 mt-1">
                    Checking that the key is active. This should be instant.
                </p>
            </div>

            <button
                onClick={check}
                disabled={checking}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white rounded-xl py-3 font-semibold hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
                <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
                {checking ? 'Checking…' : 'Check connection'}
            </button>

            {result === 'ok' && (
                <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                    <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                    <div>
                        <p className="text-sm font-semibold text-green-800">{p.name} is configured!</p>
                        <p className="text-xs text-green-600">You can now analyse CVs.</p>
                    </div>
                </div>
            )}

            {result === 'fail' && (
                <div className="space-y-3">
                    <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                        <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-semibold text-red-800">Key not detected yet</p>
                            <p className="text-xs text-red-600 mt-0.5">
                                Make sure you saved <code className="bg-red-100 px-1 rounded">.env</code> and
                                ran <code className="bg-red-100 px-1 rounded">docker compose restart backend celery</code>.
                            </p>
                        </div>
                    </div>
                    <details className="text-xs text-gray-500">
                        <summary className="cursor-pointer hover:text-gray-700">Troubleshooting tips</summary>
                        <ul className="mt-2 space-y-1 pl-4 list-disc">
                            <li>The <code>.env</code> file must be in the project root (same folder as <code>docker-compose.yml</code>)</li>
                            <li>Make sure there are no spaces around the <code>=</code></li>
                            <li>The value must not be quoted: <code>KEY=sk-ant-abc</code> not <code>KEY="sk-ant-abc"</code></li>
                            <li>Check backend logs: <code>docker compose logs backend --tail=20</code></li>
                        </ul>
                    </details>
                </div>
            )}
        </div>
    );
}

// ── Main wizard ────────────────────────────────────────────────────────────

type Step = 'intro' | 'choose' | 'get-key' | 'configure' | 'verify';

export const ApiSetupWizard: React.FC<Props> = ({ onClose, onConfigured }) => {
    const [step, setStep] = useState<Step>('intro');
    const [provider, setProvider] = useState<Provider>('anthropic');

    const steps: Step[] = ['intro', 'choose', 'get-key', 'configure', 'verify'];
    const stepIndex = steps.indexOf(step);
    const progress = Math.round(((stepIndex + 1) / steps.length) * 100);

    const handleConfigured = useCallback(() => {
        onConfigured?.();
        onClose();
    }, [onClose, onConfigured]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative">
                {/* Header bar */}
                <div className="px-6 pt-5 pb-0 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-blue-500" />
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                            LLM Setup Wizard
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Progress bar */}
                <div className="px-6 pt-3 pb-0">
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-blue-500 rounded-full transition-all duration-500"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <p className="text-xs text-gray-400 mt-1 text-right">Step {stepIndex + 1} of {steps.length}</p>
                </div>

                {/* Step content */}
                <div className="px-6 py-5">
                    {step === 'intro'     && <StepIntro onNext={() => setStep('choose')} />}
                    {step === 'choose'    && (
                        <StepChoose onNext={(p) => { setProvider(p); setStep('get-key'); }} />
                    )}
                    {step === 'get-key'   && (
                        <StepGetKey provider={provider} onNext={() => setStep('configure')} onBack={() => setStep('choose')} />
                    )}
                    {step === 'configure' && (
                        <StepConfigure provider={provider} onNext={() => setStep('verify')} onBack={() => setStep('get-key')} />
                    )}
                    {step === 'verify'    && (
                        <StepVerify provider={provider} onBack={() => setStep('configure')} onSuccess={handleConfigured} />
                    )}
                </div>
            </div>
        </div>
    );
};
