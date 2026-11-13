# v0.9 効果音
実装・検証済み: 14音の合成、Web Audioの操作後開始、音量/消音保存、ゲームイベント同期、非表示停止と不在音抑止。BGMなし。
以前のYouTube URLはdocs/research/video-index.md。音声の直接聴き比べはできていないことを説明済み。音源抽出ではなく新規合成。
単体51件、関連画面5シナリオ成功（work/e2e-v09-audio/.last-run.json）。試聴WAVはoutputs/nightshift-sfx-preview.wav。
公開Siteはpublicへ変更済み。更新はsave_site_versionとdeploy_site_versionを使い、公開設定を保持する。端末別保存は既存localStorageのまま。
