#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SESSION_NAME="machine_temperature_reporter"

usage() {
	echo "Usage: $(basename "$0") {start|stop|restart}"
}

session_exists() {
	screen -list | grep -q "[[:space:]]${SESSION_NAME}[[:space:]]"
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
	*)
		usage
		exit 1
		;;
esac