import React, { useState } from 'react';
import Card from './common/Card';
import { BookOpenIcon, UserIcon, ShieldCheckIcon } from './icons';

interface LoginProps {
  // Updated to return a Promise (Async) for DB check
  onLogin: (role: 'LIBRARIAN' | 'MEMBER', id?: string, password?: string) => Promise<boolean>;
  onLoginAttempt: (success: boolean, username: string) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin, onLoginAttempt }) => {
  const [isMemberLogin, setIsMemberLogin] = useState(false);
  const [username, setUsername] = useState(''); // Acts as Username for Librarian, ID for Member
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false); // New loading state

  const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setLoading(true);

      // Add a small artificial delay for better UX (prevents flickering)
      await new Promise(r => setTimeout(r, 800));

      try {
          const success = await onLogin(
              isMemberLogin ? 'MEMBER' : 'LIBRARIAN', 
              username, 
              password
          );
          
          if (!success) {
               onLoginAttempt(false, username);
               setError(isMemberLogin ? 'Invalid Member ID or Password.' : 'Invalid Username or Password.');
          } else {
               onLoginAttempt(true, username);
          }
      } catch (err) {
          setError('Connection error. Please try again.');
      } finally {
          setLoading(false);
      }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 relative overflow-hidden">
      <div className="absolute inset-0 -z-10 h-full w-full bg-white bg-[linear-gradient(to_right,#f0f0f0_1px,transparent_1px),linear-gradient(to_bottom,#f0f0f0_1px,transparent_1px)] bg-[size:6rem_4rem] dark:bg-slate-950 dark:bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)]"></div>
      <div className="w-full max-w-md z-10">
          <div className="text-center mb-8">
            <BookOpenIcon className="h-12 w-12 text-indigo-600 mx-auto"/>
            <h1 className="text-3xl font-bold text-slate-800 dark:text-white mt-2">Library System Login</h1>
          </div>
          <Card>
            <div className="flex border-b border-slate-200 dark:border-slate-700 mb-6">
                <button
                    type="button"
                    className={`flex-1 py-2 text-sm font-medium text-center transition-colors ${!isMemberLogin ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                    onClick={() => { setIsMemberLogin(false); setError(''); setUsername(''); setPassword(''); }}
                >
                    <span className="flex items-center justify-center gap-2"><ShieldCheckIcon className="h-5 w-5"/> Librarian</span>
                </button>
                <button
                    type="button"
                    className={`flex-1 py-2 text-sm font-medium text-center transition-colors ${isMemberLogin ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                    onClick={() => { setIsMemberLogin(true); setError(''); setUsername(''); setPassword(''); }}
                >
                    <span className="flex items-center justify-center gap-2"><UserIcon className="h-5 w-5"/> Member</span>
                </button>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label
                  htmlFor="username"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  {isMemberLogin ? 'Member ID' : 'Username'}
                </label>
                <div className="mt-1">
                  <input
                    id="username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                    placeholder={isMemberLogin ? "Enter 4-digit ID" : "Enter Admin Username"}
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Password
                </label>
                <div className="mt-1">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {error && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded text-center font-medium">{error}</p>}

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all ${loading ? 'opacity-70 cursor-wait' : ''}`}
                >
                  {loading ? 'Verifying Credentials...' : (isMemberLogin ? 'Login as Member' : 'Sign in as Librarian')}
                </button>
              </div>
            </form>
          </Card>
      </div>
    </div>
  );
};

export default Login;