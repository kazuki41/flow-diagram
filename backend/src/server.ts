import 'dotenv/config';

import express from 'express';
import type { Request, Response } from 'express'; 
import { PrismaClient } from '@prisma/client';
import cors from 'cors';

const prisma = new PrismaClient();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;


app.post('/api/diagrams/auto-save', async (req: Request, res: Response) => {
  const { id, title, nodes, edges, userId } = req.body;

  // バリデーション: 最低限必要なデータのチェック
  if (!userId) {
    return res.status(400).json({ error: 'ユーザーID（userId）は必須です。' });
  }

  try {
    // 2秒以内レスポンスを担保するため、upsert（存在チェック＋作成/更新）を1クエリで実行
    const savedDiagram = await prisma.flowDiagram.upsert({
      where: {
        // idが渡されてこない（新規作成時）は、絶対に衝突しないダミーUUIDを指定してcreate側に流す
        id: id || '00000000-0000-0000-0000-000000000000',
      },
      update: {
        title: title || undefined, // 送信があった場合のみ更新
        nodes: nodes,
        edges: edges,
        updatedAt: new Date(),
      },
      create: {
        id: id, // フロント側で生成したUUID、または未指定ならPrisma/DB側で自動生成
        title: title || '無題のフロー図',
        nodes: nodes || [],
        edges: edges || [],
        userId: userId,
      },
    });

    // ユーザーの操作をブロックしないよう、処理完了後速やかにステータス200を返す
    return res.status(200).json({
      success: true,
      message: '自動保存が完了しました。',
      diagramId: savedDiagram.id,
      updatedAt: savedDiagram.updatedAt,
    });
  } catch (error: any) {
    console.error('Auto-save Error:', error);
    return res.status(500).json({ error: 'サーバー内部エラーで保存に失敗しました。' });
  }
});

/**
 * 🔍 過去のフロー図を再編集するための取得 API (要件 3.3)
 */
app.get('/api/diagrams/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const diagram = await prisma.flowDiagram.findUnique({
      where: { id: String(id) },
    });

    if (!diagram) {
      return res.status(404).json({ error: '指定されたフロー図が見つかりません。' });
    }

    return res.status(200).json(diagram);
  } catch (error) {
    return res.status(500).json({ error: 'データの取得に失敗しました。' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 [Backend Server] Running on http://localhost:${PORT}`);
});