# アーキテクチャ

| 層 | フォルダ | 役割 |
| --- | --- | --- |
| Core | `src/core` | 50ミリ秒刻みの進行、NPCの状態と経路、在庫、会計 |
| データ | `src/data` | 店舗グリッド、家具、座席、レシピ |
| Presentation | `src/game` | Phaserシーン、オリジナルの店舗・家具・人物テクスチャ、視点操作 |
| UI | `src/ui` | HTMLのキッチン・レジ・人物情報・デバッグ。操作をCoreへ渡す |
| Platform | `src/platform` | `AppLifecycle` インターフェースとWebのタブ表示状態通知 |

CoreはPhaserとブラウザAPIから独立しています。`Cafe` が状態を進め、Phaserが状態を読み取って描画します。NPCの座標はタイルと次のタイルまでの進み具合で管理し、描画時に斜め見下ろしの座標に変換します。カメラのポインター操作はキャンバス領域に閉じています。

ブラウザでタブが非表示になったときは進行を止めます。通常の更新間隔からゲーム時間を積み上げますが、1フレームの更新量には500ミリ秒の上限があります。乱数シードは客の外見選択に使用します。

`SaveStorage`、`AudioManager`、`FileExport`、`DeviceCapabilities`、`Haptics` は利用する機能の導入時に定義します。IndexedDBではセーブ形式のバージョンと移行処理を用意し、PWAからiOSへの移行はファイル経由とします。

## 依存関係

2026年11月12日に公式資料とnpmレジストリの安定版を照合しました。実行したNode.jsは24.22.1です。

| 技術 | 選択・互換性 | 公式資料 |
| --- | --- | --- |
| TypeScript 7.0.2 | 型検査。Viteへはコンパイル済みJSを事前出力せず、Viteが変換 | [セットアップ](https://www.typescriptlang.org/download/) |
| Phaser 4.2.1 | npmのESモジュールをワイルドカードでインポート | [リリース一覧](https://phaser.io/download/phaser4)・[インポートの案内](https://phaser.io/news/2026/06/how-to-update-phaser-4-to-the-latest-version-without-breaking-your-project) |
| Vite 8.3.8 | Node 20.19+ または 22.12+。本プロジェクトではVitestの条件も満たすNode 24 LTSを案内 | [Getting Started](https://vite.dev/guide/) |
| Vitest 5.1.0 | npmの依存条件にVite 8とNode 24を含む | [Getting Started](https://vitest.dev/guide/) |
| Playwright 1.65.0 | npmの依存条件はNode 20以上。WindowsでChromiumを実行 | [Installation](https://playwright.dev/docs/intro) |
| vite-plugin-pwa 2.0.0 | 導入候補。npmの依存条件にVite 8を含む | [公式リポジトリ](https://github.com/vite-pwa/vite-plugin-pwa) |
| Capacitor 8.6.0 | 導入候補。iOSのビルド・署名にはmacOSとXcodeを用意する | [環境要件](https://capacitorjs.com/docs/getting-started/environment-setup) |
