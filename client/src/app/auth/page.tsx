'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../store/useAuthStore';
import { Clock, ShieldCheck, Mail, Lock, User, AlertCircle, ArrowRight } from 'lucide-react';

export default function AuthPage() {
  const router = useRouter();
  const { user, login, signup, guestLogin, isLoading, error, clearError } = useAuthStore();
  const [isLoginView, setIsLoginView] = useState(true);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);

  useEffect(() => {
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (forgotMode) {
      if (!email) return;
      setResetSent(true);
      return;
    }

    if (isLoginView) {
      const success = await login(email, password);
      if (success) router.push('/');
    } else {
      const success = await signup(name, email, password);
      if (success) router.push('/');
    }
  };

  const handleGoogleLogin = () => {
    guestLogin();
    router.push('/');
  };

  const handleGuestLogin = () => {
    guestLogin();
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-center items-center px-4 relative overflow-hidden">
      {/* Background glowing gradients */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-600/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/5 rounded-full blur-[120px]" />

      {/* Main card */}
      <div className="w-full max-w-md glass-panel border border-zinc-900 rounded-3xl p-8 shadow-2xl relative z-10 flex flex-col items-center">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-6">
          <div className="p-2.5 rounded-2xl bg-violet-500/10 border border-violet-500/20 glow-blue">
            <Clock className="w-6 h-6 text-violet-400 animate-pulse" />
          </div>
          <h1 className="font-outfit font-extrabold text-2xl tracking-wider bg-gradient-to-r from-white via-zinc-100 to-zinc-400 bg-clip-text text-transparent">
            ORBITTRACK
          </h1>
        </div>

        {/* Title / Description */}
        <h2 className="text-white text-base font-semibold mb-2 font-outfit">
          {forgotMode 
            ? 'Reset your password' 
            : isLoginView 
              ? 'Log in to your account' 
              : 'Create your account'}
        </h2>
        <p className="text-zinc-400 text-xs text-center mb-6 max-w-xs leading-relaxed">
          {forgotMode
            ? 'We will send a password reset link to your email.'
            : 'Plan, execute, and audit your daily work with focused countdown intervals.'}
        </p>

        {/* Errors */}
        {error && (
          <div className="w-full mb-4 p-3 rounded-xl border border-red-500/10 bg-red-500/5 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Success Reset */}
        {resetSent && (
          <div className="w-full mb-4 p-3 rounded-xl border border-green-500/10 bg-green-500/5 text-green-400 text-xs flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 flex-shrink-0" />
            <span>A reset link has been sent to {email}.</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          {!isLoginView && !forgotMode && (
            <div className="flex flex-col gap-1.5 relative">
              <User className="absolute left-4 top-3.5 w-4 h-4 text-zinc-405" />
              <input
                type="text"
                placeholder="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full pl-11 pr-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 text-xs focus:border-violet-500 focus:outline-none transition-all duration-200"
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5 relative">
            <Mail className="absolute left-4 top-3.5 w-4 h-4 text-zinc-405" />
            <input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full pl-11 pr-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 text-xs focus:border-violet-500 focus:outline-none transition-all duration-200"
            />
          </div>

          {!forgotMode && (
            <div className="flex flex-col gap-1.5 relative">
              <Lock className="absolute left-4 top-3.5 w-4 h-4 text-zinc-405" />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pl-11 pr-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-100 text-xs focus:border-violet-500 focus:outline-none transition-all duration-200"
              />
            </div>
          )}

          {!forgotMode && isLoginView && (
            <button
              type="button"
              onClick={() => setForgotMode(true)}
              className="text-right text-xs text-violet-400 hover:text-violet-300 font-semibold focus:outline-none"
            >
              Forgot Password?
            </button>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-bold shadow-md shadow-violet-600/15 active:scale-95 transition-all duration-200 flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {isLoading ? 'Processing...' : forgotMode ? 'Send Reset Link' : isLoginView ? 'Sign In' : 'Sign Up'}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        <div className="w-full flex items-center justify-center gap-3 my-4">
          <div className="h-[1px] bg-zinc-900 flex-1" />
          <span className="text-zinc-600 text-[9px] uppercase font-bold tracking-widest">Or</span>
          <div className="h-[1px] bg-zinc-900 flex-1" />
        </div>

        {/* Google OAuth Button */}
        <button
          onClick={handleGoogleLogin}
          className="w-full py-2.5 border border-zinc-850 hover:border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900 text-zinc-200 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2 mb-2.5"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
            <path
              fill="#EA4335"
              d="M12 5.04c1.62 0 3.06.56 4.21 1.66l3.13-3.13C17.43 1.84 14.94 1 12 1 7.24 1 3.29 3.76 1.45 7.78l3.75 2.91C6.07 7.27 8.79 5.04 12 5.04z"
            />
            <path
              fill="#4285F4"
              d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.47h6.45c-.28 1.47-1.11 2.72-2.36 3.56l3.66 2.84c2.14-1.98 3.38-4.89 3.38-8.51z"
            />
            <path
              fill="#FBBC05"
              d="M5.2 14.31c-.24-.72-.38-1.49-.38-2.31s.14-1.59.38-2.31L1.45 6.78C.52 8.62 0 10.74 0 12s.52 3.38 1.45 5.22l3.75-2.91z"
            />
            <path
              fill="#34A853"
              d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.66-2.84c-1.01.68-2.31 1.09-4.3 1.09-3.21 0-5.93-2.23-6.8-5.65L1.45 15.6C3.29 19.62 7.24 23 12 23z"
            />
          </svg>
          <span>Continue with Google</span>
        </button>

        {/* Guest login */}
        <button
          onClick={handleGuestLogin}
          className="w-full py-2.5 bg-gradient-to-r from-violet-600/10 to-indigo-600/10 border border-violet-500/20 hover:border-violet-500/40 text-violet-400 hover:text-violet-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 glow-blue"
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Explore in Guest Sandbox</span>
        </button>

        {/* Footer toggles */}
        <div className="mt-6 text-xs text-zinc-500">
          {forgotMode ? (
            <button
              onClick={() => {
                setForgotMode(false);
                setResetSent(false);
              }}
              className="text-violet-400 hover:text-violet-300 font-semibold"
            >
              Back to login
            </button>
          ) : isLoginView ? (
            <span>
              Don't have an account?{' '}
              <button
                onClick={() => setIsLoginView(false)}
                className="text-violet-400 hover:text-violet-300 font-semibold"
              >
                Sign up
              </button>
            </span>
          ) : (
            <span>
              Already have an account?{' '}
              <button
                onClick={() => setIsLoginView(true)}
                className="text-violet-400 hover:text-violet-300 font-semibold"
              >
                Log in
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
