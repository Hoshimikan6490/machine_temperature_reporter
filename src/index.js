import { config } from './config.js';
import { readTemperatureCelsius } from './temperature.js';
import { sendWebhookAlert } from './webhook.js';

// Linux 専用システム：Windows での実行を禁止
if (false && process.platform !== 'linux') {
	console.error(
		`Error: This application is Linux-only. Current platform is ${process.platform}.`,
	);
	process.exitCode = 1;
	process.exit(1);
}

let alertActive = false;
let lastAlertAt = 0;

/**
 * 現在の温度を読み込み、しきい値と比較してアラートを送るか判定します。
 * @return {Promise<void>}
 * @throws {Error} 温度読み込みまたは Webhook 送信に失敗した場合
 */
async function evaluateTemperature() {
	const measurement = await readTemperatureCelsius();

	if (!measurement) {
		throw new Error(
			'No temperature sensor data was found. Check that lm-sensors or other temperature sensor providers are installed and enabled.',
		);
	}

	const { temperatureC, source } = measurement;
	const now = Date.now();

	// ログ出力：フォーマット「マシン名：温度（limit:基準温度）」
	// DEBUG_MODEがONの場合は、ここでログを出して処理終了
	if (config.debug.mode) {
		console.log(
			`[${new Date().toISOString()}] ${config.hostName}: ${temperatureC.toFixed(1)}°C (limit: ${config.temperature.limit.toFixed(1)}°C)`,
		);
		return;
	}

	if (temperatureC >= config.temperature.limit) {
		const cooldownExpired =
			now - lastAlertAt >= config.temperature.alertCooldownMs;

		if (!alertActive || cooldownExpired) {
			await sendWebhookAlert({
				webhookUrl: config.discord.webhookUrl,
				hostName: config.hostName,
				temperatureC,
				thresholdC: config.temperature.limit,
				source,
				discordMentionUserIds: config.discord.mentionUserIds,
			});

			alertActive = true;
			lastAlertAt = now;
			console.log(
				`Alert sent because the temperature reached ${temperatureC.toFixed(1)}°C.`,
			);
		}

		return;
	}

	if (alertActive) {
		console.log('Temperature returned below the threshold. Alert state reset.');
	}

	alertActive = false;
}

/**
 * 温度を一度だけ評価して終了します。
 * @return {Promise<void>}
 */
async function runOnce() {
	await evaluateTemperature();
}

/**
 * 定期的に温度を監視し続けます。
 * @return {Promise<void>} 無限ループのため返り値なし
 */
async function runLoop() {
	while (true) {
		try {
			await evaluateTemperature();
		} catch (error) {
			console.error(error instanceof Error ? error.message : error);
		}

		await new Promise((resolve) =>
			setTimeout(resolve, config.temperature.checkIntervalMs),
		);
	}
}

const isOnceMode = process.argv.includes('--once');

// 単体実行モードか、ループモードかを判定して実行
try {
	if (isOnceMode) {
		console.log('Running in once mode. Evaluating temperature a single time.');
		await runOnce();
	} else {
		console.log(
			`Monitoring started. Threshold: ${config.temperature.limit.toFixed(1)}°C. Poll interval: ${config.temperature.checkIntervalMs} ms.`,
		);
		await runLoop();
	}
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
}
