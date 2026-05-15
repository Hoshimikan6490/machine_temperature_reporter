import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * ファイルから数値を読み込みます。
 * @param {string} filePath - 読み込むファイルのパス
 * @return {Promise<number|null>} パースされた数値、または無効な場合は null
 */
async function readNumberFile(filePath) {
	try {
		const rawValue = await readFile(filePath, 'utf8');
		const parsedValue = Number(rawValue.trim());

		if (!Number.isFinite(parsedValue)) {
			return null;
		}

		return parsedValue;
	} catch (error) {
		return null;
	}
}

/**
 * ファイルからテキストを読み込みます。
 * @param {string} filePath - 読み込むファイルのパス
 * @return {Promise<string|null>} ファイルの内容、空または読み込み失敗時は null
 */
async function readTextFile(filePath) {
	try {
		const rawValue = await readFile(filePath, 'utf8');
		const trimmedValue = rawValue.trim();

		return trimmedValue.length > 0 ? trimmedValue : null;
	} catch (error) {
		return null;
	}
}

/**
 * Linux の /sys/class/thermal から温度を取得します。
 * @return {Promise<{source: string, temperatureC: number}|null>} 最高温度と出所、またはセンサーがない場合は null
 */
async function readThermalZoneTemperature() {
	const candidates = [];

	try {
		const thermalZones = await readdir('/sys/class/thermal', {
			withFileTypes: true,
		});

		for (const entry of thermalZones) {
			if (!entry.isDirectory() || !entry.name.startsWith('thermal_zone')) {
				continue;
			}

			const zoneDirectory = path.join('/sys/class/thermal', entry.name);
			const tempFile = path.join(zoneDirectory, 'temp');
			const rawValue = await readNumberFile(tempFile);

			if (rawValue !== null) {
				const temperatureC = rawValue / 1000;
				if (temperatureC > -50 && temperatureC < 200) {
					candidates.push({
						source: `thermal:${entry.name}`,
						temperatureC: Math.round(temperatureC * 10) / 10,
					});
				}
			}
		}
	} catch (error) {
		// /sys/class/thermal が見つからない場合は続行
	}

	return candidates.length > 0
		? candidates.sort((a, b) => b.temperatureC - a.temperatureC)[0]
		: null;
}

/**
 * Linux の /sys/class/hwmon から温度を取得します。
 * @return {Promise<{source: string, temperatureC: number}|null>} 最高温度と出所、またはセンサーがない場合は null
 */
async function readHwmonTemperature() {
	const candidates = [];

	try {
		const hwmonDirectories = await readdir('/sys/class/hwmon', {
			withFileTypes: true,
		});

		for (const entry of hwmonDirectories) {
			if (!entry.isDirectory() || !entry.name.startsWith('hwmon')) {
				continue;
			}

			const hwmonDirectory = path.join('/sys/class/hwmon', entry.name);

			let sensorEntries;
			try {
				sensorEntries = await readdir(hwmonDirectory, { withFileTypes: true });
			} catch (error) {
				continue;
			}

			for (const sensorEntry of sensorEntries) {
				if (
					!sensorEntry.isFile() ||
					!/^temp\d+_input$/.test(sensorEntry.name)
				) {
					continue;
				}

				const sensorId = sensorEntry.name.replace('_input', '');
				const tempPath = path.join(hwmonDirectory, sensorEntry.name);
				const rawValue = await readNumberFile(tempPath);

				if (rawValue !== null) {
					const temperatureC = rawValue / 1000;
					if (temperatureC > -50 && temperatureC < 200) {
						const labelPath = path.join(hwmonDirectory, `${sensorId}_label`);
						const label = await readTextFile(labelPath);
						const source =
							label !== null
								? `hwmon:${entry.name}:${label}`
								: `hwmon:${entry.name}:${sensorId}`;

						candidates.push({
							source,
							temperatureC: Math.round(temperatureC * 10) / 10,
						});
					}
				}
			}
		}
	} catch (error) {
		// /sys/class/hwmon が見つからない場合は続行
	}

	return candidates.length > 0
		? candidates.sort((a, b) => b.temperatureC - a.temperatureC)[0]
		: null;
}

/**
 * Linux システムから CPU 温度を取得します。
 * @return {Promise<{source: string, temperatureC: number}|null>} 温度計測値と出所
 * @throws {Error} センサーが見つからない場合
 */
export async function readTemperatureCelsius() {
	if (
		process.env.TEST_TEMPERATURE_C !== undefined &&
		process.env.TEST_TEMPERATURE_C !== ''
	) {
		return {
			source: 'TEST_TEMPERATURE_C',
			temperatureC: Number(process.env.TEST_TEMPERATURE_C),
		};
	}

	// /sys/class/thermal と /sys/class/hwmon の両方から取得し、最高温度を返す
	const [thermalResult, hwmonResult] = await Promise.all([
		readThermalZoneTemperature(),
		readHwmonTemperature(),
	]);

	if (thermalResult && hwmonResult) {
		return thermalResult.temperatureC > hwmonResult.temperatureC
			? thermalResult
			: hwmonResult;
	}

	return thermalResult ?? hwmonResult;

	return readCpuTemperature();
}
