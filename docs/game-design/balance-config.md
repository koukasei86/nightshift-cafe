# バランス設定と時間モード設計

未実装の設計。まず現行値をそのまま抽出して回帰差をゼロにする。その後normal/playtestを分離する。両モードとも固定50ms更新を使用し、試遊短縮を描画速度に掛けない。

|キー|現行値|単位/注記|
|---|---|---|
|guestWalkSpeed|1.95|タイル/秒、境界丸めあり|
|staffWalkSpeed|2.15|シェフ。各type速度も設定化|
|guestFirstSpawnDelay|1000|ms|
|guestSpawnBase / ratingSlope|7300 / 570|ms。interval=base-rating*slope|
|guestPatienceTime|31000|ms|
|mealDuration / paymentDuration|3400 / 800|ms|
|seatingAnimationDuration|320|ms、現在描画だけ|
|servingAnimationDuration|800|ms、内部と描画の重複を除く|
|cleaningDuration / outburstDuration|700 / 1600|ms|
|restRecoveryRate|4.5|体力/秒|
|cookingTimeMultiplier|1|現行recipeは試遊時間|
|burnDelay|22000|ms、完成後|
|tipDeadline|14000|ms、着席から提供|
|stockKeepTime|50000〜90000|ms、recipe別|
|levelXp / staffLimit|24 / 3|いずれも仮値|
|ratingWaitPenalty / outburstPenalty|-0.18 / -0.85|仮値|
|ratingPaid / ratingTipped|0.08 / 0.18|仮値|

配置: src/data/balance.ts、recipes.ts、furniture.tsへ責務分割。Cafeにreadonly config注入、Sceneも同じaction時間を参照。UI秒数表示もresolvedRecipeから取得。

normal: 出典確認できた料理だけ出典付き値を採用。2分/5分の表示例を全レシピに一律適用しない。料理対応未確定の項目は暫定と明記する。playtest: 現行5〜21秒を維持、画面に試遊時間を明示。保存にmode/configVersionを入れ、モード変更中の注文は開始時durationを維持する。

設定検証: duration有限・非負、speed>0、食数は非負整数、XP閾値>0、評価上下限を検証。通常モードに短縮用overrideが混入した場合は起動検証で拒否。

時間の意味: シミュレーション時間と壁時計を混同しない。現行FixedClockは1フレーム500msを上限とし非表示中停止する。通常動作の30/60/120fps一致、長時間停止復帰、10fps以下、実機を別検証。将来のオフライン経過は保存時刻から上限付きで別計算し、一度に無制限tickを回さない。
