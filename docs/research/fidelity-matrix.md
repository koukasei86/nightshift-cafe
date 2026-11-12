# 再現度・実装監査

## v0.5.0 実装追記（2026-11-12）

配膳タスク・料理予約・2台の在庫・時間モード・作業ポーズを実装。以下の分類表は改修前v0.4.0の監査。家具編集・複数コンロ・保存・襲撃は未実装。

## v0.4.0 監査・当初設計

2026-11-12。対象: v0.4.0 / ea6bf73。A=根拠のある概略一致、B=実装済みで改善必要、C=仮仕様、D=未実装、E=資料不足。分類は機能単位であり完成率ではない。P0=整合性、P1=操作感、P2=表現・拡張。

|項目|分類|ファイル・関数|現在の動作|原作との差・根拠|改善方法|優先|
|---|---|---|---|---|---|---|
|人物→コンロ→料理|A|src/ui/dashboard.ts inspect/kitchenContent|人物から担当IDを引き継ぐ|AppBankの操作順と概略一致。直接コンロも可能|基本経路を回帰保護|P1|
|人物選択の維持|B|dashboard.ts showPane|家具メニューでselected=null|既存映像台帳01:20の選択表示と差|selectedActorIdとpaneを分離|P1|
|完成品移動|B|cafe.ts collectCooking|クリックで在庫へ即時追加|配膳台に置く流れは記事と一致。運搬時間は未確認|搬送イベント・受取フェーズ追加|P1|
|複数従業員|B|cafe.ts takeTask/updateStaff|最大3人、配列順、客FIFO|原作の割当規則はE|タスクIDと割当ポリシーを分離|P0|
|配膳台|B|data/cafe.ts furniture/COUNTER_WORK、CafeScene.update|2台描画、1取出口、全店共通在庫|見た目と機能の不一致。原作の選択優先はE|counterId別在庫、往復コストで暫定選択|P0|
|料理予約|D|cafe.ts Batch/takeTask|batchIdなし、取出時に減算|客はguestIdで重複割当回避、料理は出発時未予約|割当時1食を原子的に予約|P0|
|取消・返却|B|cafe.ts releaseTask/serving|未期限切れの運搬分を戻す|退店にすぐ反応せず到着後に取消。期限切れ運搬品の提供も禁止していない|取消理由・期限・返却を一元化|P0|
|家具回避|B|grid.ts findPath、cafe.ts routeAround|4近傍A*、椅子を別途除外|原作アルゴリズムE。静的到達確認と実ルートの条件が違う|共通NavGridを使う|P0|
|衝突・譲り合い|B|cafe.ts walkAround|辺両端を占有、入口では(7,0)へ退避|固定配置専用。全配置でのデッドロック解消は保証なし|待機期限、優先順、再探索、退避候補|P0|
|中途経路取消|B|movement.ts route、cafe.ts releaseTask|fraction=0に戻す|移動途中に休憩・閉店などで座標が戻る可能性|次の安全境界で取消、描画と実座標維持|P0|
|満席|C|cafe.ts updateGuest|空席がなければ即退店|記事には満席で待たせる記述。待機時間は不明|行列は計測後。現時点で一致扱いしない|P1|
|歩行速度|C|data/cafe.ts、movement.ts walk|客1.95、シェフ2.15タイル/秒|原作未計測。境界丸めで実効速度も異なる|設定抽出・実移動時間測定|P1|
|料理・経済|C|data/cafe.ts recipes、cafe.ts updateGuest|独自4品、5〜21秒、XP24毎にレベル|台帳の2分/12食などと異なる|通常/試遊モード、出典別レシピ設定|P1|
|複数コンロ|D|cafe.ts order/STOVE_WORK|注文1件、全店でコンロ1つ|複数設備は非対応|ordersByStove、作業予約|P1|
|開閉・感染・休憩|A|cafe.ts toggleOpen/infect/toggleRest|閉店後も店内客利用、客を雇用、休息回復|操作の存在は記事・過去台帳と一致、数値はC|数値と操作を別々に検証|P1|
|疲労・暴走|C|cafe.ts takeTask/rest|閾値16等で暴走、犠牲者なしなら休憩|記事では体力0で襲う説明。版差未検証|閾値を出典付き設定、表示同期|P1|
|歩行・着席・配膳|B|people.ts paintPerson、CafeScene.drawActor|12歩行、4着席、4配膳、距離同期|4方向・一部反転。シミュレーションに着席中/受取中がない|開始/途中/終了イベント、接地点検証|P1|
|料理の外見|B|people.ts paintPerson、CafeScene.plate|運搬中は共通緑の器、卓上はレシピ色|別料理で持物と卓上が変わる|recipe.visualIdを全段階へ|P1|
|待機・調理・片付け・休憩・暴走|B|CafeScene.update/drawPot/people.ts|大半は立ち姿と記号、鍋に湯気|専用身体演技なし|FSM状態に専用クリップ接続|P2|
|攻撃・被ダメージ|D|people.ts/CafeScene|専用演技・戦闘なし|店内暴走と襲撃戦闘は別物|後段で戦闘FSMと追加|P2|
|家具モデル|B|data/cafe.ts furniture/seats、props.ts paintProp|座標と種類のみ、配列番号が描画キー|ID・回転・占有・作業・使用状態なし|FurnitureInstance/Definition導入|P0|
|壁・床・扉・装飾|B|room.ts paintRoom/paintRearWall/paintDoor|背景への焼込と固定ドア|移設不可、扉高さ71/壁132、投影42:21|境界オブジェクトと床レイヤー分離|P2|
|表示範囲・陰影|B|CafeScene.applyCamera、props.ts、room.ts|625×325基準、家具高さ30〜81|提供参考より机が多く、個々の線・表情が単純|同サイズ比較、輪郭・寸法を個別調整|P2|
|重なり順|B|CafeScene.create/drawActor|足元Y、卓上皿別レイヤー|単一ソート点なので多マス家具に限界|足元と前後パーツを分離|P1|
|タッチ・カメラ|B|pointer.ts bindPointer、styles.css|5pxでドラッグ、倍率1.25/0.8、safe-area使用|ピンチ・慣性なし。全対象44px保証なし|選択/ドラッグ判定と実機安全領域検証|P1|
|時間分離|B|clock.ts FixedClock、CafeScene.update|50ms固定更新、最大500ms追従、非表示停止|極低fpsで壁時計に追いつかない。原作背景進行E|シミュレーション時刻契約を明文化|P1|
|家具購入・編集・拡張・襲撃|D|data/cafe.ts/dashboard.ts|なし|記事/Wikiに存在、詳細数値E|基盤完了後に段階追加|P2|
|保存・PWA|D|main.ts/platform/lifecycle.ts|リロードで初期化、単体HTMLのみオフライン|オフライン配布とPWAは別|スキーマ移行付き保存→SW|P2|
|単体検証|B|src/tests/cafe.test.ts|19件。満席20分、間隔2分|「残り1食」テスト実データは2食。全配置未保証|1食競合・取消・動的配置ケース追加|P0|
|画面検証|B|e2e/cafe.spec.ts|2件、844×390 Chromium|iPhone実機/Safari/ノッチは未検証|対象端末検証を別ゲートに|P1|

## 追加の静的リスク

- people.tsの配膳reach=1では皿中心x=50+17、半径15となり、PERSON.width=69を越える。原画canvas内で端が切れる可能性がある。各方向・最大伸長時の透明余白とanchorを拡張して確認する。
- `updateGuest`は通常gridで席の到達を調べた後、椅子を除外した`routeAround`の失敗を確認していない。配置変更前に判定を統一する。
- `walkAround`の衝突回避はタイル境界だけ。閉店/休憩/感染による途中キャンセルは別途検証が必要。
- `serving`で運搬バッチ期限を再確認していないため、台上から除外された期限切れの食事が運搬参照から提供され得る。予約/期限の回帰を先に作る。
