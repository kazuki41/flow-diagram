<h1>🗺️ フロー図制作アプリ</h1>
    <p>直感的な操作性を持つ、リアルタイム自動保存機能付きのフロー図制作Webアプリケーションです。<br>
    ユーザーごとに作成したフロー図を保存でき、PNG画像でエクスポートできます。</p>
    <p>ローカル環境での開発から、AWS（EC2 / RDS）を用いた本番環境へのデプロイ、Nginxによるリバースプロキシ、PM2によるプロセスの永続化まで、モダンなインフラ構成で運用されています。</p>
    <h2>🚀 主要機能</h2>
    <ul>
        <li><strong>インタラクティブなキャンバス機能:</strong> React Flowを活用し、ノードの追加・削除やドラッグ＆ドロップによる自由な配置（X/Y座標管理）、ノード間の線の接続が可能。</li>
        <li><strong>リアルタイム自動保存 (Auto-save):</strong> ユーザーがノードをドラッグして動かした瞬間の座標や変更内容を、バックグラウンドでデータベース（AWS RDS）へノンストップで自動保存。</li>
        <li><strong>堅牢なJWT認証 & 所有者チェック:</strong> 安全なハッシュ化（bcrypt）によるユーザー登録・ログイン機能。発行されたJWTトークンを検証し、一般ユーザーが他人のフロー図を閲覧・上書きできないようAPIレベルで厳重にガード。</li>
    </ul>
    <h2>🛠️ 技術スタック</h2>
    <h3>フロントエンド (Frontend)</h3>
    <ul>
        <li><strong>Framework:</strong> Next.js (App Router) / TypeScript</li>
        <li><strong>Library:</strong> React Flow (高度なキャンバスUI、ドラッグ＆ドロップ、座標・接続管理)</li>
        <li><strong>Styling:</strong> Tailwind CSS</li>
    </ul>
    <h3>バックエンド (Backend)</h3>
    <ul>
        <li><strong>Runtime:</strong> Node.js / TypeScript (<code>ts-node</code>)</li>
        <li><strong>Framework:</strong> Express</li>
        <li><strong>ORM:</strong> Prisma</li>
        <li><strong>Security:</strong> JSON Web Token (JWT) / bcrypt (パスワードハッシュ化) / CORS対策</li>
    </ul>
    <h3>インフラ・データベース</h3>
    <ul>
        <li><strong>Cloud:</strong> AWS (EC2 / RDS)</li>
        <li><strong>Database:</strong> PostgreSQL (AWS RDS)</li>
        <li><strong>Web Server:</strong> Nginx (リバースプロキシ / HTTPS・SSL化（Certbot）)</li>
        <li><strong>Process Manager:</strong> PM2 (サーバー再起動時の自動復旧・永続化)</li>
    </ul>
    <h2>📐 システムインフラ構成</h2>
    <p>本アプリケーションは、信頼性と可用性を考慮した以下の本番インフラ構造で稼働しています。</p>
<pre><code>[ Client Browser ] 
       │  (HTTPS / Port 443)
       ▼
 [ AWS EC2: Nginx ]
       │
       ├─► /         ➡  [ Next.js App ] (Port 3001) ※Port 3000競合回避
       └─► /api/...  ➡  [ Express API ] (Port 5000)
                              │
                              ▼  (SSL 暗号化通信)
                        [ AWS RDS: PostgreSQL ]</code></pre>
   
