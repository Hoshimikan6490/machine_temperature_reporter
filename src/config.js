import 'dotenv/config';

/**
 * 環境変数から数値を読み込み、型を確保します。
 * @param {string} name - 環境変数名
 * @param {number} fallback - 未設定の場合の既定値
 * @return {number} パースされた数値、または既定値
 * @throws {Error} 値が数値として無効な場合
 */
function parseNumber(name, fallback) {
	const rawValue = process.env[name];

	if (rawValue === undefined || rawValue === '') {
		return fallback;
	}

	const parsedValue = Number(rawValue);
	if (!Number.isFinite(parsedValue)) {
		throw new Error(`${name} must be a valid number.`);
	}

	return parsedValue;
}

/**
 * 環境変数から真偽値を読み込みます。
 * @param {string} name - 環境変数名
 * @param {boolean} fallback - 未設定の場合の既定値
 * @return {boolean} パースされた真偽値、または既定値
 */
function parseBoolean(name, fallback) {
	const rawValue = process.env[name];

	if (rawValue === undefined || rawValue === '') {
		return fallback;
	}

	return ['1', 'true', 'yes', 'on'].includes(rawValue.toLowerCase());
}

/**
 * 環境変数から任意の数値を読み込みます。
 * @param {string} name - 環境変数名
 * @return {number|null} パースされた数値、未設定なら null
 * @throws {Error} 値が数値として無効な場合
 */
function parseOptionalNumber(name) {
	const rawValue = process.env[name];

	if (rawValue === undefined || rawValue === '') {
		return null;
	}

	const parsedValue = Number(rawValue);
	if (!Number.isFinite(parsedValue)) {
		throw new Error(`${name} must be a valid number when provided.`);
	}

	return parsedValue;
}

/**
 * 環境変数からカンマ区切りのリストを読み込みます。
 * @param {string} name - 環境変数名
 * @return {string[]} トリムされたリスト要素の配列
 */
function parseCsvList(name) {
	const rawValue = process.env[name];

	if (rawValue === undefined || rawValue.trim() === '') {
		return [];
	}

	return rawValue
		.split(',')
		.map((value) => value.trim())
		.filter((value) => value.length > 0);
}

export const config = {
	webhookUrl: process.env.WEBHOOK_URL?.trim() ?? '',
	thresholdC: parseNumber('TEMP_THRESHOLD_C', 75),
	pollIntervalMs: parseNumber('POLL_INTERVAL_MS', 60_000),
	alertCooldownMs: parseNumber('ALERT_COOLDOWN_MS', 300_000),
	dryRun: parseBoolean('DRY_RUN', false),
	discordMentionUserIds: parseCsvList('DISCORD_MENTION_USER_IDS'),
	testTemperatureC: parseOptionalNumber('TEST_TEMPERATURE_C'),
	hostName:
		process.env.HOSTNAME?.trim() ||
		process.env.COMPUTERNAME?.trim() ||
		'unknown-host',
};

if (config.thresholdC <= 0) {
	throw new Error('TEMP_THRESHOLD_C must be greater than 0.');
}

if (config.pollIntervalMs < 1_000) {
	throw new Error('POLL_INTERVAL_MS must be at least 1000.');
}

if (config.alertCooldownMs < 0) {
	throw new Error('ALERT_COOLDOWN_MS must be 0 or greater.');
}
