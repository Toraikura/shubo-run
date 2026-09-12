# GitHubを管理先にした引き継ぎ

## ユーザー方針

2026-09-07：「これからは全てgithub上で管理しよう。もう一個のパックマンみたいな方も上げておいて」。このゲーム群のソース・変更履歴・修正内容は専用GitHubリポジトリで管理。ローカルだけに修正を残さない。別環境での修正前にremoteの最新版とローカル差分を確認し、競合を勝手に上書きしない。機密情報や他案件のファイルを公開しない。

## 2作品

| ゲーム | 遊ぶ | ソース |
|---|---|---|
| SHUBO RUN（迷路・採取アーケード） | https://toraikura.github.io/shubo-run/ | https://github.com/Toraikura/shubo-run |
| SAKE CLASH（カード陣取り） | https://toraikura.github.io/sake-clash/ | https://github.com/Toraikura/sake-clash |

各リポジトリのmain更新はCI成功後に自動公開。レビューする変更はブランチ/PRで扱う。初期版v1.0.0を保持。v2.0ではユーザーが改善・検証・公開まで一任。

## 現在の作品

3ステージの糖採取アーケード。低め/中間/高めの架空環境、2プレイスタイル、移動、パルス、ダッシュ、ポーズ、再挑戦、localStorage記録。仕様はREADME参照。v2.0はスワイプ、フィーバー、支援選択、日替わり迷路、任意の合成音、iPhone向け画面固定を追加。詳細はREADMEとRELEASE_V2.md。

## 今後

iPhoneの縦持ち・親指タッチを主役に評価。現状の面白さを保持し、改修前に狙いと受け入れ条件を明確にする。SAKE CLASH向けの菌/カード/火入れなどの未実装案を、この作品へ無断で流用しない。

## 実装入口

src/main.tsx：画面と操作。src/model.ts：ゲームルール。src/science.ts：科学説明。src/storage.ts：端末内記録。

## 検証

初回ローカル版は単体16件・ブラウザ18件成功。公開環境の最新結果は https://github.com/Toraikura/shubo-run/actions 。iPhone実機Safari・第三者試遊は未検証。ローカル版と公開版の保存記録はオリジンが異なるので共有されない。
