'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface UserData {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  diagrams: { title: string }[];
}

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('flow_auth_token');
    if (!token) {
      router.push('/login');
      return;
    }

   // 👑 管理者専用APIを叩く
   fetch('http://localhost:5000/api/admin/users', {
    headers: { 'Authorization': `Bearer ${token}` }
  })
    .then((res) => {
      // 👇 💡 【追記】401（認証エラー）が返ってきたら、トークンを消してログインへ強制送還する
      if (res.status === 401) {
        localStorage.removeItem('flow_auth_token');
        localStorage.removeItem('flow_user');
        router.push('/login');
        throw new Error('🔑 ログインの有効期限が切れました。再ログインしてください');
      }

      if (res.status === 403) throw new Error('🛑 閲覧権限がありません（一般ユーザーです）');
      if (!res.ok) throw new Error('データの取得に失敗しました');
      return res.json();
    })
    .then((data) => setUsers(data))
    .catch((err) => setError(err.message))
    .finally(() => setLoading(false));
}, [router]);

  if (loading) return <div className="p-8 text-gray-500">確認中...</div>;
  if (error) return <div className="p-8 text-red-500 font-bold">{error}</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8 text-gray-900">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">👑 管理者ダッシュボード</h1>
          <button 
            onClick={() => router.push('/')}
            className="text-sm bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 font-medium py-2 px-4 rounded transition-colors shadow-sm"
          >
            ← フロー図画面へ戻る
          </button>
        </div>

        {/* 📊 ユーザー監視テーブル */}
        <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-400 uppercase tracking-wider">
                <th className="p-4">ユーザーID</th>
                <th className="p-4">メールアドレス</th>
                <th className="p-4">権限ロール</th>
                <th className="p-4">作成されたフロー図</th>
                <th className="p-4">登録日</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm text-gray-600">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="p-4 font-mono text-xs text-gray-400">{u.id}</td>
                  <td className="p-4 font-medium text-gray-900">{u.email}</td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${u.role === 'ADMIN' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-700'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="font-bold text-gray-800">{u.diagrams.length} 個</span>
                    <span className="text-xs text-gray-400 block truncate max-w-xs">
                      {u.diagrams.map(d => d.title).join(', ') || 'なし'}
                    </span>
                  </td>
                  <td className="p-4 text-xs text-gray-400">{new Date(u.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}