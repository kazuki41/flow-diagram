'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AuthPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true); // trueならログイン、falseなら新規登録
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    
    try {
      const res = await fetch(`http://localhost:5000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'エラーが発生しました。');
      }

      if (isLogin) {
        // 🔑 ログイン成功：トークンをブラウザに保存
        localStorage.setItem('flow_auth_token', data.token);
        localStorage.setItem('flow_user', JSON.stringify(data.user));
        
        setMessage('ログイン成功！編集画面へ移動します...');
        setTimeout(() => {
          router.push('/'); // トップページへ自動リダイレクト
        }, 1500);
      } else {
        // 🎉 新規登録成功：ログイン画面に切り替え
        setMessage('ユーザー登録が完了しました！ログインしてください。');
        setIsLogin(true);
        setPassword('');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="flex justify-center items-center h-screen bg-gray-100">
      <div className="bg-white p-10 rounded-lg shadow-md w-full max-w-md">
        <h2 className="text-center mb-6 text-gray-800 text-2xl font-bold">
          {isLogin ? 'ログイン' : '新規ユーザー登録'}
        </h2>
        
        {message && <div className="p-3 bg-green-100 text-green-800 rounded mb-4 text-sm">{message}</div>}
        {error && <div className="p-3 bg-red-100 text-red-800 rounded mb-4 text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-gray-600 font-medium">メールアドレス</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="p-2.5 border border-gray-300 rounded text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="example@email.com"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-gray-600 font-medium">パスワード</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="p-2.5 border border-gray-300 rounded text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit" 
            className="p-3 rounded bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors mt-2"
          >
            {isLogin ? 'ログインする' : '登録する'}
          </button>
        </form>

        <p className="text-center mt-5 text-sm text-gray-600">
          {isLogin ? 'アカウントをお持ちでないですか？' : '既にアカウントをお持ちですか？'}
          <span 
            className="text-blue-600 cursor-pointer font-bold hover:underline" 
            onClick={() => { setIsLogin(!isLogin); setError(''); setMessage(''); }}
          >
            {isLogin ? ' 新規登録はこちら' : ' ログインはこちら'}
          </span>
        </p>
      </div>
    </div>
  );
}