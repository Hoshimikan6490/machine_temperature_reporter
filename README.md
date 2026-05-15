# Machine Temperature Reporter

Linux のマシンの温度を監視し、しきい値を超えたら Webhook に通知します。

## 動作環境

- **Linux 専用** - Windows での実行はサポートされません。実行された場合は即座にエラーで終了します。
- Node.js 18 以上

## セットアップ

1. `npm install`
2. `.env.example` を `.env` にコピーして、`WEBHOOK_URL` と必要な設定を入れます。

## 実行コマンド

- `npm start`
	- 常駐監視を開始します。
	- 温度を定期的に読み、しきい値を超えると Webhook を送ります。
- `npm test`
	- 1 回だけ温度を読んで判定します。
	- 動作確認や手動チェックに向いています。

## 環境変数

- `WEBHOOK_URL`: 通知先の Webhook URL
- `TEMP_THRESHOLD_C`: 通知を送る温度しきい値
- `POLL_INTERVAL_MS`: 温度監視の間隔
- `ALERT_COOLDOWN_MS`: 同じ高温状態での再通知を抑える時間
- `DRY_RUN`: `true` にすると Webhook 送信を行わずログだけ出します
- `DISCORD_MENTION_USER_IDS`: Discord でメンションしたいユーザー ID をカンマ区切りで指定します
- `TEST_TEMPERATURE_C`: テスト用に温度取得を上書きします

## 補足

温度取得は Linux の `/sys/class/thermal` と `/sys/class/hwmon` から直接読み込みます。

- 必要に応じて `lm-sensors` をインストールして、センサー検出を改善できます。