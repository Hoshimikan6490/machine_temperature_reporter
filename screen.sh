#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SESSION_NAME="machine_temperature_reporter"

usage() {
	echo "Usage: $(basename "$0") {start|stop|restart|status}"
}

check_requirements() {
	if ! command -v screen >/dev/null 2>&1; then
		echo "Error: 'screen' is required but not installed." >&2
		exit 1
	fi
}

session_exists() {
	# screen -ls output lines look like:  1234.session_name\t(Detached)
	# match "<pid>.<SESSION_NAME>"
	screen -ls 2>/dev/null | grep -qE "[0-9]+\.${SESSION_NAME}(\s|\t|$)"
}

start_session() {
	if session_exists; then
		echo "Screen session '${SESSION_NAME}' is already running."
		return 0
	fi

	screen -dmS "$SESSION_NAME" bash -lc "cd '$SCRIPT_DIR' && npm start"
	echo "Started screen session '${SESSION_NAME}'."
}

stop_session() {
	if ! session_exists; then
		echo "Screen session '${SESSION_NAME}' is not running."
		return 0
	fi

	screen -S "$SESSION_NAME" -X quit
	echo "Stopped screen session '${SESSION_NAME}'."
}

restart_session() {
	stop_session
	start_session
}

status_session() {
	if session_exists; then
		echo "Screen session '${SESSION_NAME}' is running."
		screen -ls 2>/dev/null | grep "\.${SESSION_NAME}" || true
	else
		echo "Screen session '${SESSION_NAME}' is not running."
	fi
}

check_requirements

if [[ $# -ne 1 ]]; then
	usage
	exit 1
fi

case "$1" in
	start)
		start_session
		;;
	stop)
		stop_session
		;;
	restart)
		restart_session
		;;
	status)
		status_session
		;;
	*)
		usage
		exit 1
		;;
esac