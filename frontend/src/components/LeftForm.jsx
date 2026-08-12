import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  KeyRound,
  Mail,
  ShieldCheck,
  User,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  UserCheck,
  ArrowLeft,
  CheckCircle2,
  Lock,
  Send
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api';

const LeftForm = () => {
  const { user, login, register, error, setError } = useAuth();
  const navigate = useNavigate();

  

  // Mode state: 'auth' (signin/signup), 'forgot' (send OTP), 'reset' (verify OTP & change password)
  const [viewMode, setViewMode] = useState('auth'); 
  const [isSignUp, setIsSignUp] = useState(false);

  // Form input states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Password reset states
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Local state for async actions & success notifications
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Redirect if already logged in
  if (user) {
    return <Navigate to="/" replace />;
  }

  const resetMessages = () => {
    setError(null);
    setSuccessMessage('');
  };

  const toggleMode = (mode) => {
    resetMessages();
    setIsSignUp(mode);
  };

  const handleSwitchView = (mode) => {
    resetMessages();
    setViewMode(mode);
  };

  // Main Authentication Form Handler (Login / Register)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    resetMessages();

    try {
      if (isSignUp) {
        await register(name, email, password);
      } else {
        await login(email, password);
      }
      navigate('/');
    } catch (err) {
      console.error('Auth error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // 1. Send OTP Request
  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!email) return;

    setSubmitting(true);
    resetMessages();

    try {
      const response = await fetch(`${API_BASE}/users/send-reset-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to send OTP.');
      }

      setSuccessMessage('OTP sent to your email! Check your inbox.');
      setViewMode('reset');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // 2. Verify OTP & Reset Password Request
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!email || !otp || !newPassword) return;

    setSubmitting(true);
    resetMessages();

    try {
      const response = await fetch(`${API_BASE}/users/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, newPassword })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to reset password.');
      }

      setSuccessMessage('Password reset successfully! You can now log in.');
      setOtp('');
      setNewPassword('');
      setPassword('');
      setViewMode('auth');
      setIsSignUp(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="lg:col-span-6 p-6 sm:p-12 lg:p-16 flex flex-col justify-between bg-slate-900 border-r border-slate-800/80 h-full">
      <div className="w-full max-w-md mx-auto lg:mx-0 mt-10">

        
        
        {/* Dynamic Headers */}
        <div className="mb-6">
          {viewMode === 'auth' && (
            <>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                {isSignUp ? 'Create an Account' : 'Sign in'}
              </h1>
              <p className="text-sm text-slate-400 mt-2">
                {isSignUp ? (
                  <span>
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => toggleMode(false)}
                      className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors cursor-pointer"
                    >
                      Sign in
                    </button>
                  </span>
                ) : (
                  <span>
                    Don't have an account?{' '}
                    <button
                      type="button"
                      onClick={() => toggleMode(true)}
                      className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors cursor-pointer"
                    >
                      Create now
                    </button>
                  </span>
                )}
              </p>
            </>
          )}

          {viewMode === 'forgot' && (
            <>
              <button
                type="button"
                onClick={() => handleSwitchView('auth')}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-indigo-400 transition-colors mb-4 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
              </button>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Reset Password
              </h1>
              <p className="text-sm text-slate-400 mt-2">
                Enter your account email and we'll send you a 6-digit OTP code.
              </p>
            </>
          )}

          {viewMode === 'reset' && (
            <>
              <button
                type="button"
                onClick={() => handleSwitchView('forgot')}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-indigo-400 transition-colors mb-4 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Resend OTP
              </button>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Verify OTP
              </h1>
              <p className="text-sm text-slate-400 mt-2">
                Enter the OTP sent to <span className="text-indigo-300 font-medium">{email}</span> along with your new password.
              </p>
            </>
          )}
        </div>

        {/* Global Feedback Banners */}
        {error && (
          <div className="flex items-center gap-3 p-3.5 mb-6 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm animate-in fade-in duration-200">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400" />
            <p className="flex-1 leading-snug">{error}</p>
          </div>
        )}

        {successMessage && (
          <div className="flex items-center gap-3 p-3.5 mb-6 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-sm animate-in fade-in duration-200">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />
            <p className="flex-1 leading-snug">{successMessage}</p>
          </div>
        )}

        {/* ================= VIEW 1: SIGN IN / SIGN UP ================= */}
        {viewMode === 'auth' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name Input */}
            <div
              className={`grid transition-all duration-300 ease-in-out ${
                isSignUp
                  ? 'grid-rows-[1fr] opacity-100'
                  : 'grid-rows-[0fr] opacity-0 pointer-events-none'
              }`}
            >
              <div className="overflow-hidden">
                <label htmlFor="name" className="block text-xs font-medium text-slate-400 mb-1.5">
                  Full Name
                </label>
                <div className="relative pb-1">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    id="name"
                    type="text"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required={isSignUp}
                    className="w-full pl-10 pr-4 py-3 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-slate-400 mb-1.5">
                E-mail
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="email"
                  type="email"
                  placeholder="example@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-xs font-medium text-slate-400 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-10 pr-10 py-3 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 cursor-pointer transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Role Display */}
            <div
              className={`grid transition-all duration-300 ease-in-out ${
                isSignUp
                  ? 'grid-rows-[1fr] opacity-100'
                  : 'grid-rows-[0fr] opacity-0 pointer-events-none'
              }`}
            >
              <div className="overflow-hidden">
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Account Role
                </label>
                <div className="w-full pl-3.5 pr-4 py-3 bg-slate-950/30 border border-slate-800/60 rounded-xl flex items-center justify-between text-slate-400 text-sm select-none">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-indigo-400" />
                    <span className="font-medium text-slate-200">Member</span>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-md uppercase font-semibold tracking-wider">
                    Default
                  </span>
                </div>
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div
              className={`grid transition-all duration-300 ease-in-out ${
                !isSignUp
                  ? 'grid-rows-[1fr] opacity-100'
                  : 'grid-rows-[0fr] opacity-0 pointer-events-none'
              }`}
            >
              <div className="overflow-hidden">
                <div className="flex items-center justify-between text-xs py-1">
                  <label className="flex items-center text-slate-400 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900 mr-2"
                    />
                    Remember me
                  </label>
                  <button
                    type="button"
                    onClick={() => handleSwitchView('forgot')}
                    className="text-slate-400 hover:text-indigo-400 transition-colors cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-2 py-3 px-4 flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-medium rounded-xl shadow-lg shadow-indigo-600/20 active:scale-[0.99] transition-all duration-200 disabled:opacity-60 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{isSignUp ? 'Creating account...' : 'Signing in...'}</span>
                </>
              ) : (
                <span>{isSignUp ? 'Register as Member' : 'Sign in'}</span>
              )}
            </button>
          </form>
        )}

        {/* ================= VIEW 2: FORGOT PASSWORD (REQUEST OTP) ================= */}
        {viewMode === 'forgot' && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label htmlFor="reset-email" className="block text-xs font-medium text-slate-400 mb-1.5">
                E-mail Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="reset-email"
                  type="email"
                  placeholder="example@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || !email}
              className="w-full py-3 px-4 flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-medium rounded-xl shadow-lg shadow-indigo-600/20 active:scale-[0.99] transition-all duration-200 disabled:opacity-60 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sending OTP...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Send Reset OTP</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* ================= VIEW 3: RESET PASSWORD (VERIFY & SUBMIT) ================= */}
        {viewMode === 'reset' && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            {/* OTP Code */}
            <div>
              <label htmlFor="otp" className="block text-xs font-medium text-slate-400 mb-1.5">
                6-Digit OTP Code
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="otp"
                  type="text"
                  maxLength={6}
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 text-sm tracking-widest font-mono focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>
            </div>

            {/* New Password */}
            <div>
              <label htmlFor="new-password" className="block text-xs font-medium text-slate-400 mb-1.5">
                New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  id="new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="w-full pl-10 pr-10 py-3 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-600 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 cursor-pointer transition-colors"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting || !otp || !newPassword}
              className="w-full py-3 px-4 flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-medium rounded-xl shadow-lg shadow-indigo-600/20 active:scale-[0.99] transition-all duration-200 disabled:opacity-60 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Updating password...</span>
                </>
              ) : (
                <span>Reset Password</span>
              )}
            </button>
          </form>
        )}

      </div>
    </div>
  );
};

export default LeftForm;