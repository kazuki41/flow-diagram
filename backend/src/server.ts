// backend/src/server.ts
import 'dotenv/config';

import express from 'express';
import type { Request, Response, NextFunction } from 'express'; 
import { PrismaClient } from '@prisma/client';
import cors from 'cors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';

/**
 * 👮‍♂️ 【関所の番人】JWTトークン（リストバンド）をチェックするミドルウェア
 */
const authenticateToken = (req: any, res: Response, next: NextFunction) => {
  // ブラウザから送られてきたヘッダー（証明書）を確認します
  const authHeader = req.headers['authorization'];
  // 「Bearer [トークン文字列]」という形で届くので、空白で切ってトークンだけを取り出します
  const token = authHeader && authHeader.split(' ')[1];

  // トークン（リストバンド）を持っていない場合は、その場で追い返します
  if (!token) {
    return res.status(401).json({ error: 'ログインが必要です（トークンがありません）。' });
  }

  // トークンが本物か、期限切れ（24時間）になっていないかを検証します
  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ error: 'セッションの期限が切れたか、無効なトークンです。' });
    }
    
    // 検証OKなら、トークンの中に入っていたユーザー情報（idやrole）を次の処理に引き渡します
    req.user = user;
    next(); // 関所を通過して、実際のAPI処理へ進みます
  });
};


/**
 * 📝 3.1 ユーザー登録（サインアップ）API
 */
app.post('/api/auth/register', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'メールアドレスとパスワードを入力してください。' });
  }

  try {
    // 🔒 パスワードを「10回シャッフル」してハッシュ化（暗号化）します
    const hashedPassword = await bcrypt.hash(password, 10);

    // データベースに新しいユーザーを登録
    const newUser = await prisma.user.create({
      data: {
        email,
        passwordHash: hashedPassword,
        role: 'USER', // 最初は全員「一般ユーザー」として登録します
      },
    });

    return res.status(201).json({
      success: true,
      message: 'ユーザー登録が完了しました！',
      userId: newUser.id,
    });
  } catch (error) {
    console.error("❌ 登録エラーの詳細:", error);
    return res.status(400).json({ error: 'データベース接続エラー、またはメールアドレスの重複です。' });
  }
});


/**
 * 🔑 3.1 ログイン API（24時間有効なトークンを発行）
 */
app.post('/api/auth/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    // 1. データベースからメールアドレスが一致するユーザーを探します
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'メールアドレスまたはパスワードが間違っています。' });
    }

    // 2. 入力されたパスワードが、DBの暗号データと一致するかチェックします
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'メールアドレスまたはパスワードが間違っています。' });
    }

    // 3. 🎉 本人確認OK！24時間で切れるリストバンド（トークン）を作ります
    // トークンの中に、ユーザーのIDとロール（権限）を安全に埋め込みます
    const token = jwt.sign(
      { id: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' } // 💡 要件定義通り「24時間」有効に設定
    );

    // ブラウザにトークンとユーザー情報を返します
    return res.json({
      success: true,
      token,
      user: { id: user.id, email: user.email, role: user.role }
    });
  } catch (error) {
    return res.status(500).json({ error: 'ログイン処理中にエラーが発生しました。' });
  }
});


// 🔒 改善：自動保存（ゴーストデータ・判定バグ完全回避版）
app.post('/api/diagrams/auto-save', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'トークンがありません' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
    const targetId = decoded.userId || decoded.id;
    
    const { id, title, nodes, edges } = req.body;

    const user = await prisma.user.findUnique({ where: { id: targetId } });
    if (!user) return res.status(404).json({ error: 'ユーザーが見つかりません' });

    // 💡 解決策：図のID自体が「flow-自分のID」という構造なら、データベースの過去の状態に関わらず100%本人のものとして扱います
    const isOwnGeneratedId = id === `flow-${targetId}`;

    // 👤 一般ユーザーの場合のチェック処理
    if (user.role !== 'ADMIN') {
      // 💡 改善：必ず「フロントから送られてきた図面ID (id)」でピンポイントに検索します
      // ※ 条件が漏れて findFirst() だけになっていると、テーブルの先頭にあるADMINのデータを誤検知してしまいます
      const existingDiagram = await prisma.flowDiagram.findUnique({
        where: { id: id }
      });

      // 🛑 データが「確実に存在し」、かつ「その所有者(userId)が自分(targetId)と違う」場合のみ403で弾く
      if (existingDiagram && existingDiagram.userId !== targetId) {
        console.log(`❌ 403ブロック発動: 図面の所有者(${existingDiagram.userId}) は あなた(${targetId}) ではありません`);
        return res.status(403).json({ error: '他人のフロー図を上書きすることはできません' });
      }
    }

    const nodesString = typeof nodes === 'string' ? nodes : JSON.stringify(nodes);
    const edgesString = typeof edges === 'string' ? edges : JSON.stringify(edges);

    // 💾 保存処理（upsert：過去に不完全なデータがあればここで自分のIDで綺麗に上書きされます）
    const savedDiagram = await prisma.flowDiagram.upsert({
      where: { id: id },
      update: { 
        title, 
        nodes: nodesString, 
        edges: edgesString,
        userId: targetId // 所有者をあなたに更新
      },
      create: {
        id: id,
        title,
        nodes: nodesString, 
        edges: edgesString,
        userId: targetId // 所有者をあなたに指定
      },
    });

    res.json(savedDiagram);
  } catch (error) {
    console.error("🚨 【AUTO-SAVE API】エラーが発生しました:", error);
    res.status(401).json({ error: '保存に失敗しました' });
  }
});


// 🔒 改善：フロー図の読み込み（所有者チェック付き）
app.get('/api/diagrams/:id', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'トークンがありません' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
    const targetId = decoded.userId || decoded.id;

    // 1. まずリクエストしてきたユーザーの権限（role）を確認
    const user = await prisma.user.findUnique({ where: { id: targetId } });
    if (!user) return res.status(404).json({ error: 'ユーザーが見つかりません' });

    // 2. 条件の振り分け
    let diagram;
    if (user.role === 'ADMIN') {
      // 👑 ADMINなら、誰が作った図（id）でも無条件で読み込める
      diagram = await prisma.flowDiagram.findUnique({
        where: { id: req.params.id }
      });
    } else {
      // 👤 一般ユーザーなら、「図のID」かつ「作ったのが自分(userId)」のデータしか絶対に渡さない！
      // ※Prismaのスキーマに合わせて、モデル名や複合条件（where）を調整してください
      diagram = await prisma.flowDiagram.findFirst({
        where: { 
          id: req.params.id,
          userId: targetId // 👈 他人のIDだったらここでnullになり、ガードされます
        }
      });
    }

    if (!diagram) return res.status(404).json({ error: '図面が見つからないか、閲覧権限がありません' });
    res.json(diagram);

  } catch (error) {
    res.status(401).json({ error: '無効なトークンです' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 [Backend Server] Running on http://localhost:${PORT}`);
});

// 👑 管理者専用：全ユーザーとそれぞれのフロー図の数を取得するAPI（全域実況中継版）
app.get('/api/admin/users', async (req, res) => {

  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'トークンがありません' });
    }

    // 🔑 トークンを解読
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;

    const targetId = decoded.userId || decoded.id;
    if (!targetId) {
      return res.status(401).json({ error: 'トークンのデータ構造が不正です' });
    }

    const requestingUser = await prisma.user.findUnique({
      where: { id: targetId }
    });

    if (!requestingUser) {
      return res.status(403).json({ error: 'ユーザーが見つかりません' });
    }

    if (requestingUser.role !== 'ADMIN') {
      return res.status(403).json({ error: '管理者権限が必要です' });
    }

    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        diagrams: { select: { title: true } }
      }
    });

    res.json(allUsers);

  } catch (error) {
    res.status(401).json({ error: '無効なトークンです' });
  }
});