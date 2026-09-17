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
    <div className="min-h-screen bg-[#0C0B0A] flex flex-col justify-center items-center px-4 py-12 text-[#FBF9F5]">
      <div className="w-full max-w-md">
        {/* Brand identity */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 rounded-2xl bg-[#181614] border border-[#332F2A] p-2 flex items-center justify-center shadow-[0_4px_25px_rgba(0,0,0,0.6)]">
              <img
                src="/logo.png"
                alt="PROHOME Logo"
                className="w-full h-full object-contain drop-shadow-[0_0_20px_rgba(237,225,211,0.35)]"
              />
            </div>
          </div>

          <h1 className="text-2xl font-bold tracking-tighter text-[#EDE1D3]">
            PROHOME
          </h1>

          <p className="text-xs text-[#A8A096] mt-1">
            Commercial Decision & Operations Dashboard V1
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-[#161412]/90 border border-[#2E2A25] rounded-3xl p-8 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between gap-2 mb-6 pb-4 border-b border-[#26231F]">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#52C48D]" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#EDE1D3]">
                Administrator Access / لوحة التحكم
              </h2>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#52C48D]/10 text-[#52C48D] border border-[#52C48D]/25">
              System Active
            </span>
          </div>

          {error && (
            <div
              id="login-error-message"
              className="mb-5 p-3.5 rounded-2xl bg-[#E06A6A]/10 border border-[#E06A6A]/30 text-[#E06A6A] text-xs flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 text-[#E06A6A] shrink-0 mt-0.5" />
              <div className="leading-relaxed">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-medium text-[#A8A096]" htmlFor="login-username">
                  Username or Email / اسم المستخدم أو البريد
                </label>
                <span className="text-[10px] text-[#787066] font-mono">admin</span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#787066]">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="login-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin or jemyneutron228@gmail.com"
                  required
                  className="w-full pl-10 pr-3.5 py-2.5 bg-[#100F0E] border border-[#2E2A25] rounded-xl text-xs text-[#FBF9F5] placeholder-[#5C554D] focus:outline-hidden focus:border-[#EDE1D3]/70 focus:ring-1 focus:ring-[#EDE1D3]/70 transition-all font-mono"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-medium text-[#A8A096]" htmlFor="login-password">
                  Password / كلمة المرور
                </label>
                <span className="text-[10px] text-[#787066] font-mono">prohome2026!</span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#787066]">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full pl-10 pr-10 py-2.5 bg-[#100F0E] border border-[#2E2A25] rounded-xl text-xs text-[#FBF9F5] placeholder-[#5C554D] focus:outline-hidden focus:border-[#EDE1D3]/70 focus:ring-1 focus:ring-[#EDE1D3]/70 transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#787066] hover:text-[#EDE1D3] transition-colors cursor-pointer"
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
                className="w-full py-3 px-4 bg-[#EDE1D3] hover:bg-[#F7EFE6] text-[#121110] font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-[0_4px_20px_rgba(237,225,211,0.18)] disabled:opacity-50 cursor-pointer"
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
                className="w-full py-2.5 px-4 bg-[#201D1A] hover:bg-[#282420] text-[#EDE1D3] border border-[#EDE1D3]/30 font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                <Zap className="w-3.5 h-3.5 text-[#EDE1D3]" />
                دخول فوري كمسؤول (One-Click Instant Login)
              </button>
            </div>
          </form>

          {/* Helper credentials display box */}
          <div className="mt-6 pt-4 border-t border-[#26231F] bg-[#100F0E]/80 -mx-8 -mb-8 p-5 rounded-b-3xl text-center">
            <div className="text-[11px] text-[#A8A096] mb-2">بيانات الدخول المسجلة للنظام (Default Credentials):</div>
            <div className="flex items-center justify-center gap-3 text-xs">
              <span className="bg-[#181614] px-2.5 py-1 rounded-lg border border-[#2E2A25] font-mono text-[#A8A096]">
                User: <strong className="text-[#EDE1D3]">admin</strong>
              </span>
              <span className="bg-[#181614] px-2.5 py-1 rounded-lg border border-[#2E2A25] font-mono text-[#A8A096]">
                Pass: <strong className="text-[#EDE1D3]">prohome2026!</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Security badge */}
        <div className="text-center mt-6 text-[11px] text-[#787066]">
          Protected internal system • Google Sheets persistent store
        </div>
      </div>
    </div>
  );
};
