/**
 * アラートメッセージを組み立てます。
 * @param {Object} params - パラメータ
 * @param {string} params.hostName - ホスト名
 * @param {number} params.temperatureC - 現在の温度（℃）
 * @param {number} params.thresholdC - しきい値温度（℃）
 * @param {string} params.source - 温度計測の出所
 * @return {string} 組み立てられたアラートメッセージ
 */
function buildAlertMessage({ hostName, temperatureC, thresholdC, source }) {
	return `Machine temperature alert on ${hostName}: ${temperatureC.toFixed(1)}°C reached the ${thresholdC.toFixed(1)}°C threshold via ${source}.`;
}

/**
 * Discord のメンション文字列を組み立てます。
 * @param {string[]} userIds - メンションするユーザー ID の配列
 * @return {string} <@userid> 形式のメンション文字列、空配列なら空文字列
 */
function buildDiscordMentions(userIds) {
	if (!Array.isArray(userIds) || userIds.length === 0) {
		return '';
	}

	return userIds.map((userId) => `<@${userId}>`).join(' ');
}

/**
 * Webhook 経由でアラート通知を送ります。
 * @param {Object} params - パラメータ
 * @param {string} params.webhookUrl - 通知先の Webhook URL
 * @param {string} params.hostName - ホスト名
 * @param {number} params.temperatureC - 現在の温度（℃）
 * @param {number} params.thresholdC - しきい値温度（℃）
 * @param {string} params.source - 温度計測の出所
 * @param {boolean} params.dryRun - true の場合、送信せずログだけ出す
 * @param {string[]} [params.discordMentionUserIds=[]] - Discord メンション対象のユーザー ID
 * @return {Promise<void>}
 * @throws {Error} Webhook 送信に失敗した場合
 */
export async function sendWebhookAlert({
	webhookUrl,
	hostName,
	temperatureC,
	thresholdC,
	source,
	dryRun,
	discordMentionUserIds = [],
}) {
	const mentionText = buildDiscordMentions(discordMentionUserIds);
	const message = buildAlertMessage({
		hostName,
		temperatureC,
		thresholdC,
		source,
	});
	const content = mentionText ? `${mentionText} ${message}` : message;
	const payload = {
		text: content,
		content,
		hostName,
		temperatureC,
		thresholdC,
		source,
		status: 'alert',
		timestamp: new Date().toISOString(),
		allowed_mentions: {
			users: discordMentionUserIds,
		},
	};

	if (dryRun) {
		console.log(`[dry-run] ${content}`);
		return;
	}

	if (!webhookUrl) {
		throw new Error('WEBHOOK_URL is required.');
	}

	const response = await fetch(webhookUrl, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
		},
		body: JSON.stringify(payload),
		signal: AbortSignal.timeout(10_000),
	});

	if (!response.ok) {
		const responseText = await response.text();
		throw new Error(
			`Webhook request failed with ${response.status} ${response.statusText}: ${responseText}`,
		);
	}
}
