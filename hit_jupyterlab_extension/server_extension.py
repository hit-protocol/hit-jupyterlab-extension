"""
hit_jupyterlab_extension/server_extension.py

Auto-starts the HIT Relay WebSocket server as a daemon thread when
JupyterLab/Notebook starts. The relay runs on ws://localhost:8080 and routes
messages between the browser frontend and AI agents.

NOTE: The MCP server (hit_jupyterlab_extension.mcp_server) is a stdio tool
that must be launched by the AI agent process (e.g. Gemini CLI, Claude
Desktop), NOT by Jupyter. Do not start it here.
"""
import asyncio
import socket
import threading
import logging

logger = logging.getLogger("hit_jupyterlab_extension")

RELAY_PORT = 8080
_relay_thread: threading.Thread | None = None


def _port_in_use(port: int) -> bool:
    """Return True if something is already listening on *port*."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex(("127.0.0.1", port)) == 0


def _run_relay():
    """Entry-point for the relay daemon thread."""
    # Import here so the module is only loaded when the thread actually starts.
    from hit_jupyterlab_extension.relay import main as relay_main
    try:
        asyncio.run(relay_main())
    except Exception as exc:
        logger.error(f"[HIT] Relay server stopped unexpectedly: {exc}")


def _load_jupyter_server_extension(server_app):
    global _relay_thread

    if _port_in_use(RELAY_PORT):
        server_app.log.info(
            f"[HIT] Relay already running on port {RELAY_PORT} — skipping start."
        )
        return

    if _relay_thread and _relay_thread.is_alive():
        server_app.log.info("[HIT] Relay thread already alive — skipping start.")
        return

    server_app.log.info(f"[HIT] Starting HIT Relay on ws://localhost:{RELAY_PORT} …")
    _relay_thread = threading.Thread(target=_run_relay, daemon=True, name="hit-relay")
    _relay_thread.start()
    server_app.log.info("[HIT] Relay daemon thread started.")
