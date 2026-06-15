'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ReactFlow, {
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';

// 🎨 共通の青い矢印スタイル定義
const arrowStyle = {
  markerEnd: {
    type: MarkerType.ArrowClosed,
    width: 10,
    height: 10,
    color: '#3b82f6',
  },
  style: { stroke: '#3b82f6', strokeWidth: 1 },
};

// 💡 HMR（自動更新）時の誤検知によるReactFlowの警告ノイズを完全に消し去るための定義
const nodeTypes = {};
const edgeTypes = {};

export default function FlowPage() {
  const router = useRouter();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [title, setTitle] = useState('無題のフロー図');

  // 💡 改善：型定義に「id: string」もしっかり追加してTypeScriptに教えます
  const [user, setUser] = useState<{ id: string, email: string, role: string } | null>(null);

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [isLoading, setIsLoading] = useState(true);
  const [edgeType, setEdgeType] = useState<string>('smoothstep');

  // 🎯 選択状態を追跡するステート
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // 🕒 タイムマシン（履歴管理）用のステート
  const [past, setPast] = useState<{ nodes: Node[]; edges: Edge[] }[]>([]);
  const [future, setFuture] = useState<{ nodes: Node[]; edges: Edge[] }[]>([]);

  // 📸 現在の状態を「過去」に記録する共通関数
  const takeSnapshot = useCallback(() => {
    setPast((prev) => [...prev, { nodes, edges }]);
    setFuture([]);
  }, [nodes, edges]);

  // ↩️ 戻る（Undo）
  const handleUndo = () => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    setPast((prev) => prev.slice(0, -1));
    setFuture((prev) => [{ nodes, edges }, ...prev]);
    setNodes(previous.nodes);
    setEdges(previous.edges);
  };

  // ↪️ 進む（Redo）
  const handleRedo = () => {
    if (future.length === 0) return;
    const next = future[0];
    setFuture((prev) => prev.slice(1));
    setPast((prev) => [...prev, { nodes, edges }]);
    setNodes(next.nodes);
    setEdges(next.edges);
  };

  // ログインチェック ＆ 過去データの読み込み
  useEffect(() => {
    const token = localStorage.getItem('flow_auth_token');
    const savedUser = localStorage.getItem('flow_user');

    if (!token || !savedUser) {
      router.push('/login');
      return;
    }
    const currentUser = JSON.parse(savedUser);
    setUser(currentUser);

    const fetchSavedDiagram = async () => {
      try {
        const diagramId = currentUser.role === 'ADMIN' ? 'test-flow-1' : `flow-${currentUser.id}`;

        const res = await fetch(`/api/diagrams/${diagramId}`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setTitle(data.title || '無題のフロー図');

          const parsedNodes = typeof data.nodes === 'string' ? JSON.parse(data.nodes) : (data.nodes || []);
          const parsedEdges = typeof data.edges === 'string' ? JSON.parse(data.edges) : (data.edges || []);

          setNodes(parsedNodes);
          setEdges(parsedEdges.map((e: any) => ({ ...e, ...arrowStyle })));
        } else {
          setNodes([
            { id: '1', position: { x: 150, y: 100 }, data: { label: 'スタート' }, type: 'input' },
            { id: '2', position: { x: 150, y: 250 }, data: { label: '処理A' } },
          ]);
        }
      } catch (err) {
        console.error('データの読み込みに失敗しました:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSavedDiagram();
  }, [router, setNodes, setEdges]);

  // 🔌 矢印が繋がったときの処理
  const onConnect = useCallback((params: Connection | Edge) => {
    takeSnapshot();
    setEdges((eds) => addEdge({ ...params, type: edgeType, ...arrowStyle }, eds));
  }, [setEdges, edgeType, takeSnapshot]);

  // 🗑️ 選択中の部品・線を削除
  const handleDeleteSelected = () => {
    takeSnapshot();
    setNodes((nds) => nds.filter((n) => !n.selected && n.id !== selectedNodeId));
    setEdges((eds) => eds.filter((e) => !e.selected && e.id !== selectedEdgeId));
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  };

  // 🎯 線や部品のクリック・背景イベント
  const onNodeClick = useCallback((_: any, node: Node) => setSelectedNodeId(node.id), []);
  const onEdgeClick = useCallback((_: any, edge: Edge) => setSelectedEdgeId(edge.id), []);
  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, []);
  const onNodeDragStart = useCallback(() => takeSnapshot(), [takeSnapshot]);

  // ✏️ 線の種類変更
  const handleEdgeTypeChange = (type: string) => {
    takeSnapshot();
    setEdgeType(type);
    setEdges((eds) => eds.map((e) => e.id === selectedEdgeId || e.selected ? { ...e, type, ...arrowStyle } : e));
  };

  // 🎨 部品の色変更
  const handleNodeColorChange = (color: string) => {
    takeSnapshot();
    setNodes((nds) => nds.map((n) => n.id === selectedNodeId || n.selected ? { ...n, style: { ...n.style, backgroundColor: color } } : n));
  };

  // 📐 部品の形状変更
  const handleNodeShapeChange = (shapeType: string) => {
    takeSnapshot();
    const borderRadius = shapeType === 'rounded' ? '16px' : shapeType === 'circle' ? '50%' : '4px';
    setNodes((nds) => nds.map((n) => n.id === selectedNodeId || n.selected ? { ...n, style: { ...n.style, borderRadius } } : n));
  };

  // ➕ 新しい部品（ノード）を追加
  const handleAddNode = () => {
    takeSnapshot();
    const maxId = nodes.length > 0 ? Math.max(...nodes.map(n => Number(n.id) || 0)) : 0;
    const id = String(maxId + 1);

    const newNode: Node = {
      id,
      position: { x: 150 + (nodes.length * 20), y: 150 + (nodes.length * 20) },
      data: { label: `新しい手順 ${id}` },
    };
    setNodes((nds) => nds.concat(newNode));
  };

  // 🔄 新機能：キャンバスを最初の状態にリセットする関数
  const handleReset = () => {
    // ユーザーがうっかり触って消してしまわないよう、一度確認を挟みます
    if (!window.confirm('本当にキャンバスを初期状態にリセットしますか？（一つ戻るボタンで元に戻せます）')) return;

    takeSnapshot(); // 🕒 タイムマシンに現在の状態を記録（間違えてもUndoできます！）
    setTitle('無題のフロー図');
    setNodes([
      { id: '1', position: { x: 150, y: 100 }, data: { label: 'スタート' }, type: 'input' },
      { id: '2', position: { x: 150, y: 250 }, data: { label: '処理A' } },
    ]);
    setEdges([]);
  };

  // 📸 フロー図をPNG画像としてダウンロード
  const handleExportPng = () => {
    const element = document.querySelector('.react-flow__viewport') as HTMLElement;
    if (!element) return;

    import('html-to-image').then(({ toPng }) => {
      toPng(element, { backgroundColor: '#f8fafc' })
        .then((dataUrl) => {
          const link = document.createElement('a');
          link.download = `${title}.png`;
          link.href = dataUrl;
          link.click();
        })
        .catch((err) => {
          console.error('画像のエクスポートに失敗しました:', err);
        });
    });
  };

  // 📝 テキスト変更
  const onNodeDoubleClick = useCallback((_: any, node: Node) => {
    const newLabel = prompt('新しいテキストを入力してください：', node.data.label);
    if (newLabel !== null && newLabel.trim() !== '') {
      takeSnapshot();
      setNodes((nds) => nds.map((n) => n.id === node.id ? { ...n, data: { ...n.data, label: newLabel } } : n));
    }
  }, [setNodes, takeSnapshot]);

  // ☁️ 自動保存 API（関数内部で安全に diagramId を決定する形に改善）
  const triggerAutoSave = useCallback(async (currentTitle: string, currentNodes: any[], currentEdges: any[]) => {
    const token = localStorage.getItem('flow_auth_token');
    if (!token || !user) return; // 💡 user情報がセットされるまで待機

    // 💡 改善：ここで安全にユーザーごとのIDを算出します
    const diagramId = user.role === 'ADMIN' ? 'test-flow-1' : `flow-${user.id}`;

    setSaveStatus('saving');
    try {
      const res = await fetch('/api/diagrams/auto-save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ id: diagramId, title: currentTitle, nodes: currentNodes, edges: currentEdges }),
      });

      if (res.ok) {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        setSaveStatus('idle');
      }
    } catch {
      setSaveStatus('idle');
    }
  }, [user]); // 💡 user情報が変わったら関数を再生成

  // 🕒 変化検知自動保存（引数から存在しない id を排除）
  useEffect(() => {
    if (isLoading || !user) return; // 💡 userがいない間は動かさない
    const delayDebounceFn = setTimeout(() => {
      triggerAutoSave(title, nodes, edges);
    }, 1500);
    return () => clearTimeout(delayDebounceFn);
  }, [title, nodes, edges, triggerAutoSave, isLoading, user]);

  const handleLogout = () => {
    localStorage.removeItem('flow_auth_token');
    localStorage.removeItem('flow_user');
    router.push('/login');
  };

  if (isLoading || !user) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-gray-50 gap-4">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
        <p className="text-gray-500 font-medium text-sm">データをロード中...</p>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen flex flex-col bg-gray-50 text-gray-900">
      {/* 👑 ヘッダーエリア */}
      <header className="h-16 border-b border-gray-200 bg-white px-6 flex items-center justify-between shadow-sm z-10">

        <div className="flex items-center gap-4">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-xl font-bold border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none px-1 py-0.5 rounded transition-colors"
          />
          {saveStatus === 'saving' && <span className="text-xs bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full font-medium animate-pulse">☁️ 保存中...</span>}
          {saveStatus === 'saved' && <span className="text-xs bg-green-100 text-green-800 px-2.5 py-1 rounded-full font-medium">✅ データベースへ保存完了！</span>}
          {saveStatus === 'idle' && <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-medium">● 自動保存有効</span>}
        </div>

        <div className="flex items-center gap-4">
          {user?.role === 'ADMIN' && (
            <button
              onClick={() => router.push('/admin')}
              className="w-43 bg-purple-600 text-white text-xs font-bold py-2 px-4 rounded hover:bg-purple-700 transition-colors shadow-sm flex items-center justify-center gap-1 mb-1"
            >
              管理者ダッシュボードへ
            </button>
          )}
          <span className="text-sm text-gray-600">👤 {user.email}</span>
          <button onClick={handleLogout} className="text-sm px-3 py-1.5 border border-gray-300 rounded text-gray-700 hover:bg-gray-100 font-medium transition-colors">
            ログアウト
          </button>
        </div>
      </header>

      {/* 🏢 メインエリア */}
      <div className="flex-1 flex flex-row overflow-hidden">
        {/* 🗂️ 左サイドバー */}
        <aside className="w-64 bg-white border-r border-gray-200 p-4 flex flex-col gap-5 shadow-sm z-10 overflow-y-auto">

          {/* 基本操作 */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">基本操作</h3>
            <div className="flex flex-col gap-2">

              {/* 🕒 タイムマシン */}
              <div className="grid grid-cols-2 gap-2 mb-1">
                <button
                  onClick={handleUndo}
                  disabled={past.length === 0}
                  className="bg-gray-100 text-gray-700 text-xs font-bold py-2 px-3 rounded hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors border border-gray-200"
                >
                  ↩️ 一つ戻る
                </button>
                <button
                  onClick={handleRedo}
                  disabled={future.length === 0}
                  className="bg-gray-100 text-gray-700 text-xs font-bold py-2 px-3 rounded hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors border border-gray-200"
                >
                  ↪️ 一つ進む
                </button>
              </div>

              <button
                onClick={handleAddNode}
                className="w-full bg-blue-600 text-white text-sm font-bold py-2 px-4 rounded hover:bg-blue-700 transition-colors shadow-sm flex items-center justify-center gap-1"
              >
                ＋ 部品を追加
              </button>

              <button
                onClick={handleDeleteSelected}
                className="w-full bg-red-500 text-white text-sm font-bold py-2 px-4 rounded hover:bg-red-600 transition-colors shadow-sm flex items-center justify-center gap-1"
              >
                🗑️ 選択中を削除
              </button>

              {/* 🔄 💡 追記：リセットボタン */}
              <button
                onClick={handleReset}
                className="w-full bg-amber-500 text-white text-sm font-bold py-2 px-4 rounded hover:bg-amber-600 transition-colors shadow-sm flex items-center justify-center gap-1"
              >
                🔄 キャンバスをリセット
              </button>
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* 線の設定 */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">線の設定</h3>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 font-medium">矢印の形状</label>
              <select
                value={edgeType}
                onChange={(e) => handleEdgeTypeChange(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 rounded text-gray-700 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 py-2 px-2 transition-all"
              >
                <option value="smoothstep">直角（角丸）</option>
                <option value="straight">直線</option>
                <option value="default">なめらかな曲線</option>
                <option value="step">階段状（直角）</option>
              </select>
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* 部品の設定 */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">部品の設定</h3>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500 font-medium">図形の形</label>
                <select
                  onChange={(e) => handleNodeShapeChange(e.target.value)}
                  defaultValue="default"
                  className="w-full bg-gray-50 border border-gray-300 rounded text-gray-700 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 py-2 px-2 transition-all"
                >
                  <option value="default">シャープな四角</option>
                  <option value="rounded">マイルドな角丸</option>
                  <option value="circle">完全な丸（円）</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-gray-500 font-medium">付箋の色</label>
                <div className="grid grid-cols-5 gap-2">
                  <button onClick={() => handleNodeColorChange('#ffffff')} className="w-8 h-8 rounded-full bg-white border border-gray-300 hover:scale-110 active:scale-95 transition-all shadow-sm" title="白"></button>
                  <button onClick={() => handleNodeColorChange('#fef08a')} className="w-8 h-8 rounded-full bg-yellow-200 border border-yellow-300 hover:scale-110 active:scale-95 transition-all shadow-sm" title="黄"></button>
                  <button onClick={() => handleNodeColorChange('#fbcfe8')} className="w-8 h-8 rounded-full bg-pink-200 border border-pink-300 hover:scale-110 active:scale-95 transition-all shadow-sm" title="ピンク"></button>
                  <button onClick={() => handleNodeColorChange('#bbf7d0')} className="w-8 h-8 rounded-full bg-green-200 border border-green-300 hover:scale-110 active:scale-95 transition-all shadow-sm" title="緑"></button>
                  <button onClick={() => handleNodeColorChange('#bfdbfe')} className="w-8 h-8 rounded-full bg-blue-200 border border-blue-300 hover:scale-110 active:scale-95 transition-all shadow-sm" title="青"></button>
                </div>
              </div>
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* ファイルの出力 */}
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">ファイルの出力</h3>
            <button
              onClick={handleExportPng}
              className="w-full bg-emerald-600 text-white text-sm font-bold py-2 px-4 rounded hover:bg-emerald-700 transition-colors shadow-sm flex items-center justify-center gap-1"
            >
              💾 PNG画像として<br/>ダウンロード
            </button>
          </div>

        </aside>

        {/* 🎨 右エリア：キャンバス */}
        <div className="flex-1 h-full relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDoubleClick={onNodeDoubleClick}
            onEdgeClick={onEdgeClick}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onNodeDragStart={onNodeDragStart}
            fitView
          >
            <Background color="#ccc" gap={16} />
            <Controls />
          </ReactFlow>
        </div>

      </div>
    </div>
  );
}