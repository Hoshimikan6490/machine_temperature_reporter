# Machine Temperature Reporter

Linux マシンの温度を定期的に監視し、しきい値を超えたときに Discord Webhook へ通知する Node.js アプリです。

## 主な機能

- CPU 温度を定期監視
- しきい値超過時に Discord Webhook へ通知
- Discord メンション対応
- DEBUG_MODE で通知せず温度だけをログ出力
- 温度取得元は `/sys/class/thermal`、`/sys/class/hwmon`、`sensors -j` を順に試行

## 要件

- Linux 環境
- Node.js 18 以上
- 可能なら `lm-sensors` をインストール済みであること

`/sys/class/thermal` や `/sys/class/hwmon` で取得できない場合でも、`sensors -j` が使えれば温度を読めることがあります。

## セットアップ

1. 依存関係をインストールします。

   ```bash
   npm install
   ```

2. `.env` を作成して、必要な環境変数を設定します。

## 実行

- 監視を開始する

  ```bash
  npm start
  ```

- 1 回だけ温度を確認する

  ```bash
  npm test
  ```

`npm test` は `node src/index.js --once` を実行します。

## DEBUG_MODE

`DEBUG_MODE=true` のときは Webhook 通知を送らず、現在の温度を定期的に console.log します。

出力形式は次のようになります。

```text
[2026-05-16T08:43:45.329Z] 自宅ubuntuサーバー: 70.0°C (limit: 70.0°C)
```

## 環境変数

### Discord 通知

- `DISCORD_WEBHOOK_URL`
  - 通知先の Discord Webhook URL
- `DISCORD_MENTION_USER_IDS`
  - メンションするユーザー ID をカンマ区切りで指定します
  - 例: `123456789012345678,234567890123456789`

### 温度監視

- `TEMP_LIMIT`
  - 通知判定に使う温度しきい値。既定値は `75`
- `TEMP_CHECK_INTERVAL_MS`
  - 温度を確認する間隔。既定値は `60000`
- `ALERT_COOLDOWN_MS`
  - 同じ高温状態での再通知を抑える時間。既定値は `300000`

### デバッグ

- `DEBUG_MODE`
  - `true` / `1` / `yes` / `on` で有効になります
  - 有効時は Webhook を送らず、温度をログ出力だけします
- `TEST_TEMP`
  - 温度取得を上書きするテスト用の値です
  - 設定すると、実際のセンサー値を無視してこの値を使います

### ホスト名

- `HOSTNAME`
  - Discord 通知やログに出るホスト名です
  - 未設定時は環境のホスト名を使います

## 挙動

- 起動時に温度取得を開始します
- 温度が `TEMP_LIMIT` 以上になると通知対象になります
- 一度通知したあと、`ALERT_COOLDOWN_MS` の間は再通知を抑えます
- 温度がしきい値未満に戻ると、通知状態をリセットします

`DEBUG_MODE=true` の場合は、しきい値判定の前に温度ログだけを出して終了します。

## 実運用の例

```env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/xxxxx/yyyyy
DISCORD_MENTION_USER_IDS=00000000000000
HOSTNAME=ubuntu_server
TEMP_LIMIT=70
TEMP_CHECK_INTERVAL_MS=30000
ALERT_COOLDOWN_MS=60000
DEBUG_MODE=false
TEST_TEMP=
```

## 備考

温度取得に失敗して `No temperature sensor data was found...` が出る場合は、次を確認してください。

- `lm-sensors` がインストールされているか
- `sensors -j` が実行できるか
- `/sys/class/thermal` や `/sys/class/hwmon` に温度ファイルがあるか
