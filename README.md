# Nightshift Café

ゾンビのシェフが働く、オリジナルの2Dカフェ経営ゲームです。横画面で店舗を見渡し、コンロ・来客・従業員をタップして営業します。

## Windowsで起動する

配布物の `Nightshift-Cafe.html` はエクスプローラーでダブルクリックすると開きます。以下はソースを編集する場合の手順です。

1. [Node.js公式サイト](https://nodejs.org/)から Node.js 24 LTS をインストールします。インストールすると `npm`（ゲームに必要なライブラリを入れる道具）も使えます。
2. このファイルと `package.json` があるフォルダで PowerShell を開き、次を実行します。

```powershell
npm.cmd ci
npm.cmd run dev
```

3. ブラウザで [http://127.0.0.1:5173](http://127.0.0.1:5173) を開きます。別のURLがPowerShellに出た場合は、そちらを開きます。終了はPowerShellで `Ctrl+C` です。

初回のライブラリ取得にはインターネット接続が必要です。起動後のゲームは外部APIやCDNに接続しません。進行はブラウザのタブを表示している間だけ進み、ページを再読み込みすると初期状態に戻ります。

## 遊び方

1. 店内の**コンロをタップ**し、調理担当と料理を選びます。最初は「沼のポタージュ」が5秒で完成します。
2. **完成したコンロをもう一度タップ**すると料理がカウンターに移ります。放置すると焦げます。従業員はカウンターから料理を取り、配膳して、会計後に皿を片付けます。
3. **お客様をタップ**すると雇用時の体力・移動速度・チップが分かります。毒素を使って感染させると、同じ人物が従業員になります。
4. **従業員をタップ**して体力を確認します。疲れていたら休憩を指示し、回復したら仕事に戻します。低体力で放置すると客を襲い、店の評価が下がることがあります。
5. 左のボタンからも同じメニューを開けます。ドラッグで視点を移動し、右上のボタンで拡縮・リセット・経路表示ができます。
6. **右斜め奥の青緑の扉をタップ**すると開閉できます。閉めると新しい客は引き返します。店内の客は食事・会計を続け、退店時だけ扉が一時的に開きます。

## ビルドとテスト

```powershell
npm.cmd test
npx.cmd playwright install chromium
npm.cmd run test:e2e
npm.cmd run build
npm.cmd run preview
```

単体テストは客やシェフのルールを調べます。画面テストはChromiumを自動操作します。`build` は配布用ファイルを `dist` に作ります。`preview` でその配布用ビルドをブラウザから確認できます。

## 開発資料

- [設計](docs/architecture.md)・[ゲーム仕様](docs/game-design.md)・[NPC行動](docs/npc-behavior.md)
- [実況動画台帳](docs/research/video-index.md)・[原作の確認済み仕様](docs/research/original-mechanics.md)・[未確認項目](docs/research/unknowns.md)
- [進捗](docs/development/progress.md)・[次の作業](docs/development/next-steps.md)・[テスト計画](docs/testing/test-plan.md)

## 再現度改善の監査・設計（v3.0指示書）

2026年11月12日の監査です。現在のゲーム実装を変更する前の設計資料で、未実装案を含みます。

- [原作との差分](docs/research/original-comparison.md)
- [動画観測と時間比較](docs/research/video-observations.md)
- [A〜E分類・ファイル別監査](docs/research/fidelity-matrix.md)
- [NPCタスク・料理予約・設備モデル](docs/game-design/npc-task-system.md)
- [時間設定と通常/試遊モード](docs/game-design/balance-config.md)
- [優先3項目と段階的な改修計画](docs/development/improvement-roadmap.md)
- [回帰結果・未検証ケース](docs/testing/regression-results.md)
