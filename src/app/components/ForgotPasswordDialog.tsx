import { useState } from 'react';
import { ArrowLeft, Mail, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';

type Props = {
  open: boolean;
  onClose: () => void;
};

export function ForgotPasswordDialog({ open, onClose }: Props) {
  const { completeSession } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  function resetAndClose() {
    setStep('email');
    setEmail('');
    setCode('');
    setError('');
    onClose();
  }

  async function handleSendCode() {
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Enter your email address.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.requestForgotCode(trimmed);
      toast.success(res.message);
      setStep('code');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send code');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode() {
    const trimmedCode = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(trimmedCode)) {
      setError('Enter the 6-character code from your email.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.verifyForgotCode(email.trim(), trimmedCode);
      completeSession(res.token, res.user);
      toast.success('Welcome to PropVault');
      resetAndClose();
      navigate('/dashboard');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center px-4">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/50"
        onClick={resetAndClose}
      />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-[#1e3a8a] px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-white font-semibold text-lg">Forgot Password</h2>
            <p className="text-blue-200/80 text-xs mt-0.5">
              {step === 'email' ? 'Enter your account email' : 'Enter the code sent to your email'}
            </p>
          </div>
          <button
            type="button"
            onClick={resetAndClose}
            className="text-blue-200 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-6 space-y-4">
          {step === 'email' ? (
            <>
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                  />
                </div>
                <p className="text-[11px] text-gray-500 mt-2">
                  We will check if an account exists before sending a 6-character sign-in code.
                </p>
              </div>
              <button
                type="button"
                disabled={loading}
                onClick={handleSendCode}
                className="w-full bg-[#1e3a8a] hover:bg-[#1e40af] disabled:opacity-60 text-white font-semibold py-3 rounded-lg text-sm"
              >
                {loading ? 'Sending…' : 'Send Verification Code'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setStep('email');
                  setCode('');
                  setError('');
                }}
                className="inline-flex items-center gap-1 text-xs text-blue-700 hover:text-blue-800 font-medium"
              >
                <ArrowLeft size={13} />
                Change email
              </button>
              <p className="text-xs text-gray-600">
                Code sent to <strong>{email.trim()}</strong>
              </p>
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                  Verification Code
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                  placeholder="6-character code"
                  maxLength={6}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg text-lg tracking-[0.35em] text-center font-mono bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 uppercase"
                />
              </div>
              <button
                type="button"
                disabled={loading}
                onClick={handleVerifyCode}
                className="w-full bg-[#1e3a8a] hover:bg-[#1e40af] disabled:opacity-60 text-white font-semibold py-3 rounded-lg text-sm"
              >
                {loading ? 'Verifying…' : 'Verify & Sign In'}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleSendCode}
                className="w-full text-sm text-blue-700 hover:text-blue-800 font-medium py-1"
              >
                Resend code
              </button>
            </>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg text-xs">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
