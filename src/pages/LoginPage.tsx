import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, User, AlertCircle, ArrowRight, ShieldCheck, Eye, EyeOff, Zap } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('prohome2026!');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const executeLogin = async (userToLogin: string, passToLogin: string) => {
    setError(null);
    if (!userToLogin.trim() || !passToLogin) {
      setError('Please enter both username and password. / يرجى إدخال اسم المستخدم وكلمة المرور.');
      return;
    }

    setIsSubmitting(true);
    const result = await login(userToLogin.trim(), passToLogin);
    setIsSubmitting(false);

    if (!result.success) {
      setError(
        result.error ||
        'Authentication failed. Please verify credentials (admin / prohome2026!). / فشل تسجيل الدخول، تأكد من صحة البيانات.'
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeLogin(username, password);
  };

  const handleInstantAdminLogin = async () => {
    setUsername('admin');
    setPassword('prohome2026!');
    await executeLogin('admin', 'prohome2026!');
  };

  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col justify-center items-center px-4 py-12 text-slate-100">
      <div className="w-full max-w-md">
        {/* Brand identity */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <img
              src="/logo.png"
              alt="PROHOME Logo"
              className="w-16 h-16 object-contain drop-shadow-[0_0_25px_rgba(99,102,241,0.35)]"
            />
          </div>

          <h1 className="text-2xl font-bold tracking-tighter text-white">
            PROHOME
          </h1>

          <p className="text-xs text-slate-400 mt-1">
            Commercial Decision & Operations Dashboard V1
          </p>
        </div>



        {/* Login Card */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between gap-2 mb-6 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Administrator Access / لوحة التحكم
              </h2>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              System Active
            </span>
          </div>

          {error && (
            <div
              id="login-error-message"
              className="mb-5 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-medium text-slate-300" htmlFor="login-username">
                  Username or Email / اسم المستخدم أو البريد
                </label>
                <span className="text-[10px] text-slate-500 font-mono">admin</span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="login-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin or jemyneutron228@gmail.com"
                  required
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-hidden focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/60 transition-all font-mono"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-medium text-slate-300" htmlFor="login-password">
                  Password / كلمة المرور
                </label>
                <span className="text-[10px] text-slate-500 font-mono">prohome2026!</span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-hidden focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/60 transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white transition-colors cursor-pointer"
                  tabIndex={-1}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2 space-y-2.5">
              <button
                id="login-submit-button"
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 bg-slate-50 hover:bg-white text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  'Authenticating... / جارٍ الدخول...'
                ) : (
                  <>
                    Sign In to Dashboard / تسجيل الدخول
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* 1-Click Instant Login button */}
              <button
                id="instant-admin-login-button"
                type="button"
                onClick={handleInstantAdminLogin}
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                <Zap className="w-3.5 h-3.5 text-indigo-400" />
                دخول فوري كمسؤول (One-Click Instant Login)
              </button>
            </div>
          </form>

          {/* Helper credentials display box */}
          <div className="mt-6 pt-4 border-t border-slate-800 bg-slate-950/50 -mx-8 -mb-8 p-5 rounded-b-3xl text-center">
            <div className="text-[11px] text-slate-400 mb-2">بيانات الدخول المسجلة للنظام (Default Credentials):</div>
            <div className="flex items-center justify-center gap-3 text-xs">
              <span className="bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800 font-mono text-slate-200">
                User: <strong className="text-white">admin</strong>
              </span>
              <span className="bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800 font-mono text-slate-200">
                Pass: <strong className="text-white">prohome2026!</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Security badge */}
        <div className="text-center mt-6 text-[11px] text-slate-500">
          Protected internal system • Google Sheets persistent store
        </div>
      </div>
    </div>
  );
};
