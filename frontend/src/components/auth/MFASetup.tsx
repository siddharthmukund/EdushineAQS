/**
 * MFASetup — 3-step TOTP wizard (ICCV #3).
 *
 * Step 1: Intro + "Enable 2FA" button
 * Step 2: QR code + manual secret + 6-digit verification
 * Step 3: Recovery codes grid + "Done" button
 *
 * Props:
 *   onEnabled  — called when MFA is fully confirmed and enabled
 *   onCancel   — called when user dismisses the wizard
 */
import React, { useState } from 'react';
import { ShieldCheck, ShieldOff, Copy, Check, AlertCircle, Download } from 'lucide-react';
import { setupMFA, confirmMFA } from '../../services/api';
import type { MFASetupResponse } from '../../types/api';

interface Props {
    onEnabled: () => void;
    onCancel?: () => void;
}

export const MFASetup: React.FC<Props> = ({ onEnabled, onCancel }) => {
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [setupData, setSetupData] = useState<MFASetupResponse | null>(null);
    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [copiedSecret, setCopiedSecret] = useState(false);
    const [copiedCodes, setCopiedCodes] = useState(false);

    // -----------------------------------------------------------------------
    // Step 1 → 2: Generate secret + QR
    // -----------------------------------------------------------------------
    const handleSetup = async () => {
        setError('');
        setLoading(true);
        try {
            const data = await setupMFA();
            setSetupData(data);
            setStep(2);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to generate MFA secret');
        } finally {
            setLoading(false);
        }
    };

    // -----------------------------------------------------------------------
    // Step 2 → 3: Verify code + enable MFA
    // -----------------------------------------------------------------------
    const handleConfirm = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await confirmMFA(code);
            setStep(3);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Invalid code. Try again.');
        } finally {
            setLoading(false);
        }
    };

    const copySecret = () => {
        if (setupData?.secret) {
            navigator.clipboard.writeText(setupData.secret);
            setCopiedSecret(true);
            setTimeout(() => setCopiedSecret(false), 2000);
        }
    };

    const copyCodes = () => {
        if (setupData?.recovery_codes) {
            navigator.clipboard.writeText(setupData.recovery_codes.join('\n'));
            setCopiedCodes(true);
            setTimeout(() => setCopiedCodes(false), 2000);
        }
    };

    const downloadCodes = () => {
        if (!setupData?.recovery_codes) return;
        const blob = new Blob([setupData.recovery_codes.join('\n')], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'aqs-recovery-codes.txt';
        a.click();
        URL.revokeObjectURL(url);
    };

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------
    return (
        <div className="space-y-4">
            {/* Step indicator */}
            <div className="flex items-center gap-2 mb-2">
                {([1, 2, 3] as const).map(s => (
                    <React.Fragment key={s}>
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                            step === s
                                ? 'bg-blue-600 text-white'
                                : step > s
                                ? 'bg-emerald-500 text-white'
                                : 'bg-gray-200 text-gray-500'
                        }`}>
                            {step > s ? <Check className="w-4 h-4" /> : s}
                        </div>
                        {s < 3 && <div className={`flex-1 h-0.5 ${step > s ? 'bg-emerald-400' : 'bg-gray-200'}`} />}
                    </React.Fragment>
                ))}
            </div>

            {/* Error */}
            {error && (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* ---- Step 1: Intro ---- */}
            {step === 1 && (
                <div className="space-y-4">
                    <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-xl">
                        <ShieldCheck className="w-6 h-6 text-blue-600 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-semibold text-blue-900 text-sm">Two-factor authentication</p>
                            <p className="text-blue-700 text-xs mt-1">
                                Add an extra layer of security by requiring a one-time code from your
                                authenticator app (Google Authenticator, Authy, etc.) when logging in.
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={handleSetup}
                            disabled={loading}
                            className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition-colors"
                        >
                            {loading ? 'Generating…' : 'Enable 2FA'}
                        </button>
                        {onCancel && (
                            <button
                                onClick={onCancel}
                                className="px-4 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* ---- Step 2: QR + verification ---- */}
            {step === 2 && setupData && (
                <div className="space-y-4">
                    <p className="text-sm text-gray-600">
                        Scan this QR code with your authenticator app, then enter the 6-digit code to confirm.
                    </p>

                    {/* QR Code */}
                    <div className="flex justify-center">
                        <img
                            src={setupData.qr_code}
                            alt="TOTP QR code"
                            className="w-44 h-44 rounded-lg border border-gray-200 shadow-sm"
                        />
                    </div>

                    {/* Manual secret */}
                    <div>
                        <p className="text-xs text-gray-500 mb-1">Can't scan? Enter the secret manually:</p>
                        <div className="flex items-center gap-2 bg-gray-50 rounded-lg border border-gray-200 px-3 py-2">
                            <code className="flex-1 text-xs font-mono text-gray-700 break-all">
                                {setupData.secret}
                            </code>
                            <button
                                type="button"
                                onClick={copySecret}
                                className="text-gray-400 hover:text-gray-600 shrink-0"
                            >
                                {copiedSecret ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    {/* Code verification */}
                    <form onSubmit={handleConfirm} className="space-y-3">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Enter the 6-digit code from your app
                            </label>
                            <input
                                type="text"
                                required
                                autoFocus
                                maxLength={6}
                                value={code}
                                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-center text-lg tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="000000"
                            />
                        </div>
                        <div className="flex gap-3">
                            <button
                                type="submit"
                                disabled={loading || code.length !== 6}
                                className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition-colors"
                            >
                                {loading ? 'Verifying…' : 'Verify & Enable'}
                            </button>
                            <button
                                type="button"
                                onClick={() => { setStep(1); setSetupData(null); setCode(''); }}
                                className="px-4 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                            >
                                Back
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* ---- Step 3: Recovery codes ---- */}
            {step === 3 && setupData && (
                <div className="space-y-4">
                    <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-700">
                            <strong>Save these recovery codes</strong> — each can be used once to access your account
                            if you lose your authenticator device. Store them somewhere safe.
                        </p>
                    </div>

                    {/* Grid */}
                    <div className="grid grid-cols-2 gap-2">
                        {setupData.recovery_codes.map((rc) => (
                            <div
                                key={rc}
                                className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-center font-mono text-sm tracking-widest text-gray-800"
                            >
                                {rc}
                            </div>
                        ))}
                    </div>

                    {/* Copy / Download */}
                    <div className="flex gap-2">
                        <button
                            onClick={copyCodes}
                            className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
                        >
                            {copiedCodes ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                            Copy all
                        </button>
                        <button
                            onClick={downloadCodes}
                            className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
                        >
                            <Download className="w-3.5 h-3.5" />
                            Download
                        </button>
                    </div>

                    {/* Done */}
                    <button
                        onClick={onEnabled}
                        className="w-full bg-emerald-600 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-emerald-700 transition-colors"
                    >
                        <span className="flex items-center justify-center gap-2">
                            <ShieldOff className="w-4 h-4" />
                            Done — 2FA is now active
                        </span>
                    </button>
                </div>
            )}
        </div>
    );
};
