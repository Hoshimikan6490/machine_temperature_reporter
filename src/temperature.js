import { execFile } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

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
 * `sensors` コマンドから温度を取得します。
 * @return {Promise<{source: string, temperatureC: number}|null>} 最高温度と出所、または取得失敗時は null
 */
async function readSensorsCommandTemperature() {
	try {
		const { stdout } = await execFileAsync('sensors', ['-j'], {
			maxBuffer: 1024 * 1024,
		});

		const parsedOutput = JSON.parse(stdout);
		const candidates = [];

		function visit(node, pathSegments = []) {
			if (!node || typeof node !== 'object') {
				return;
			}

			for (const [key, value] of Object.entries(node)) {
				const nextPathSegments = [...pathSegments, key];

				if (key.endsWith('_input') && Number.isFinite(value)) {
					const temperatureC = Number(value);
					if (temperatureC > -50 && temperatureC < 200) {
						candidates.push({
							source: `sensors:${nextPathSegments.slice(0, -1).join(':')}`,
							temperatureC: Math.round(temperatureC * 10) / 10,
						});
					}
					continue;
				}

				visit(value, nextPathSegments);
			}
		}

		visit(parsedOutput);

		return candidates.length > 0
			? candidates.sort((a, b) => b.temperatureC - a.temperatureC)[0]
			: null;
	} catch (error) {
		return null;
	}
}

/**
 * Linux システムから CPU 温度を取得します。
 * @return {Promise<{source: string, temperatureC: number}|null>} 温度計測値と出所
 * @throws {Error} センサーが見つからない場合
 */
export async function readTemperatureCelsius() {
	if (
		process.env.TEST_TEMP_LIMIT !== undefined &&
		process.env.TEST_TEMP_LIMIT !== ''
	) {
		return {
			source: 'TEST_TEMP_LIMIT',
			temperatureC: Number(process.env.TEST_TEMP_LIMIT),
		};
	}

	// /sys/class/thermal, /sys/class/hwmon, sensors コマンドの順に取得し、最高温度を返す
	const [thermalResult, hwmonResult, sensorsResult] = await Promise.all([
		readThermalZoneTemperature(),
		readHwmonTemperature(),
		readSensorsCommandTemperature(),
	]);

	const candidates = [thermalResult, hwmonResult, sensorsResult].filter(
		Boolean,
	);

	if (candidates.length === 0) {
		return null;
	}

	return candidates.sort((a, b) => b.temperatureC - a.temperatureC)[0];
}
