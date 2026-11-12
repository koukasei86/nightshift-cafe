# NPC・料理・設備の設計案

設計段階。既存Cafe/FixedClock/A*を保持し、順に置換する。原作の内部方式は不明なので本設計は独自の暫定実装。

## データ契約

```ts
type ServiceTask = {
  taskId: string; guestId: number; seatId: string; requestedAt: number;
  status: 'queued'|'reserved'|'toCounter'|'pickup'|'toSeat'|'serving'|'completed'|'cancelled';
  assignedStaffId: number|null; reservedBatchId: string|null;
  counterId: string|null; priority: number;
  actionStartedAt: number|null; actionDurationMs: number|null;
  cancelReason?: 'guestLeft'|'expired'|'rest'|'blocked'|'layoutChanged';
};
type FoodBatch = {
  batchId: string; counterId: string; recipeId: string;
  available: number; reserved: number; carried: number; expiresAt: number;
};
```

taskは客/席世代につき1件、従業員は同時に1件。予約・移送・提供・返却を同一シミュレーションtick内のコマンドとして適用する。taskIdによる冪等処理で重複完了を拒否。

台上available→予約reserved→手持ちcarried→servedという所有権を追跡。取消時、台上予約はavailableへ戻す。運搬分は返却タスクで到達可能な台へ戻す。期限切れはdiscardedへ計上し、在庫に復活させない。提供直前も客・席・期限を再確認。保存対象には数値IDを使い、Batchオブジェクト参照を残さない。

## 割当

FIFO: requestedAt→taskId順に客を選び、候補従業員/台の総経路最小を選ぶ。nearest: 実行可能な全組を総コスト順で選ぶ。同値は要求時刻/従業員ID/台ID順。待機が長い仕事にはpriority加算して飢餓を防ぐ。これは原作確認済み規則ではない。

従業員はidle、体力が必要量以上、休憩予約/暴走なし。すべての台についてstaff→counter作業点とcounter→seat作業点のA*を同じNavGridで計算。未到達候補を除く。予約確定時に在庫を再検証し、1食を予約する。作業点も予約し、同じ取出口へ全員を集中させない。

## 設備とレイアウト

FurnitureDefinition: kind、renderKey、footprint、workOffsets、interactionPolygon、placementRules。FurnitureInstance: id、definitionId、position、rotation(0/90/180/270)、occupiedTiles、workTiles、usage(available/reserved/occupied)、revision。対象kindはstove/fridge/counter/sink/table/chair/wall/floor/door/decoration。床は非閉塞、壁は境界、扉は通行条件、装飾は定義ごとに閉塞する。

まず固定配置へIDを付け、既存定数の読取adapterで互換を保つ。chairsとtablesからSeatを生成。編集操作は下流。移設時は座標/回転/重複/範囲/出入口から座席と作業点への到達性を仮gridで検証し、成功時だけlayoutRevisionを進める。使用中の家具は初期版では移動不可。旧revisionの経路を無効化し、タスク取消/再予約を一回だけ行う。

## 通行と復帰

start/end tileとedgeを時間区間で予約。待機時間を記録し、閾値後に優先IDで片方が候補退避点へ移動。退避点は現在の(7,0)直書きを廃止。永久に不可能ならblocked理由で仕事を返し、客を出口誘導。中途のroute/resetでfractionを捨てず、次の境界で再探索する。無限再試行は上限/バックオフで防止。

## 段階移行

1. IDs/台別Batch + 現在1台adapter。全既存テスト維持。
2. TaskQueue + FIFO。takeTask/releaseTaskを委譲。競合/取消/期限を検証。
3. 複数台/コンロ、選択ポリシー、作業点予約。
4. 描画はactionStartedAt/actionDurationMsから進捗を算出。拾う/置くは所有権イベントに同期。
5. 動的配置、保存schemaVersionを追加。

## 不変条件とデバッグ

完成食数 = available + reserved + carried + served + discarded（全Batch集計）。負数禁止、客に同時2task禁止、1食に同時2予約禁止。客退店/感染/休憩/期限切れをすべて取消経路に通す。

デバッグにはtaskId/status/guestId/seatId/staffId/batchId/counterId、目的地、経路、waitSince、layoutRevision、体力、取消理由を表示。履歴は上限付きリングバッファにし、長時間実行で無制限増加させない。
