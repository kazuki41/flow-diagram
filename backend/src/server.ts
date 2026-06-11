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


/**
 * ⚡ 3.2 & 4. フロー図の自動保存 API（関所の番人付き！）
 * 第二引数に「authenticateToken」を挟むことで、ログインしている人しか保存できなくします。
 */
app.post('/api/diagrams/auto-save', authenticateToken, async (req: any, res: Response) => {
  const { id, title, nodes, edges } = req.body;
  
  // 💡 番人がセットしてくれた「ログイン中のユーザーID」を安全に使用します
  const loginUserId = req.user.id; 

  try {
    const savedDiagram = await prisma.flowDiagram.upsert({
      where: {
        id: id || '00000000-0000-0000-0000-000000000000',
      },
      update: {
        title: title || undefined,
        nodes: JSON.stringify(nodes),
        edges: JSON.stringify(edges),
        updatedAt: new Date(),
      },
      create: {
        id: id,
        title: title || '無題のフロー図',
        nodes: JSON.stringify(nodes || []),
        edges: JSON.stringify(edges || []),
        userId: loginUserId, // ログインしている本人のIDで保存！
      },
    });

    return res.status(200).json({
      success: true,
      message: '自動保存が完了しました。',
      diagramId: savedDiagram.id,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: '保存に失敗しました。' });
  }
});


/**
 * 🔍 3.3 過去のフロー図を再編集するための取得 API
 */
app.get('/api/diagrams/:id', authenticateToken, async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const diagram = await prisma.flowDiagram.findUnique({
      where: { id: String(id) },
    });

    if (!diagram) {
      return res.status(404).json({ error: '指定されたフロー図が見つかりません。' });
    }

    return res.status(200).json({
      ...diagram,
      nodes: JSON.parse(diagram.nodes as string),
      edges: JSON.parse(diagram.edges as string),
    });
  } catch (error) {
    return res.status(500).json({ error: 'データの取得に失敗しました。' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 [Backend Server] Running on http://localhost:${PORT}`);
});