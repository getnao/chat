"""Server management and HTTP clients for test command."""

import os
import secrets
import subprocess
import sys
import time
from pathlib import Path

import requests
from rich.console import Console

from nao_core.config import NaoConfig

console = Console()

# Server ports (must match chat.py)
SERVER_PORT = 5005
FASTAPI_PORT = 8005
SECRET_FILE_NAME = ".nao-secret"


# =============================================================================
# Server Utilities
# =============================================================================


def get_nao_core_dir() -> Path:
    """Get the nao_core directory (cli/nao_core/)."""
    # Path: cli/nao_core/commands/test/servers.py
    # parent = test/, parent.parent = commands/, parent.parent.parent = nao_core/
    return Path(__file__).parent.parent.parent


def get_project_root() -> Path:
    """Get the project root (monorepo root)."""
    # nao_core -> cli -> project root
    return get_nao_core_dir().parent.parent


def get_server_config() -> tuple[Path | None, Path | None, bool]:
    """Get server configuration: (binary_path, backend_dir, use_dev_mode).

    Returns the binary path if available, otherwise returns the backend directory
    for running with bun in development mode.
    """
    nao_core_dir = get_nao_core_dir()
    bin_dir = nao_core_dir / "bin"
    binary_path = bin_dir / "nao-chat-server"

    # Check for compiled binary first
    if binary_path.exists():
        return binary_path, bin_dir, False

    # Check if server is already running (manually started)
    if is_server_running(SERVER_PORT):
        console.print("[dim]Using already running chat server on port 5005[/dim]")
        return None, None, False

    # Fall back to development mode (run with bun)
    project_root = get_project_root()
    backend_dir = project_root / "apps" / "backend"

    if (backend_dir / "src" / "index.ts").exists():
        console.print("[dim]Server binary not found, will try development mode (bun)[/dim]")
        return None, backend_dir, True

    console.print(f"[bold red]✗[/bold red] Server binary not found at {binary_path}")
    console.print("[dim]Either build the server or run the backend manually[/dim]")
    sys.exit(1)


def get_fastapi_main_path() -> Path:
    """Get the path to the FastAPI main.py file."""
    nao_core_dir = get_nao_core_dir()
    bin_dir = nao_core_dir / "bin"
    fastapi_path = bin_dir / "fastapi" / "main.py"

    # Check bundled FastAPI first
    if fastapi_path.exists():
        return fastapi_path

    # Fall back to development location
    project_root = get_project_root()
    dev_fastapi_path = project_root / "apps" / "backend" / "fastapi" / "main.py"

    if dev_fastapi_path.exists():
        return dev_fastapi_path

    console.print("[bold red]✗[/bold red] FastAPI main.py not found")
    sys.exit(1)


def ensure_auth_secret(bin_dir: Path) -> str | None:
    """Ensure auth secret exists, generating one if needed."""
    if os.environ.get("BETTER_AUTH_SECRET"):
        return None

    secret_path = bin_dir / SECRET_FILE_NAME

    if secret_path.exists():
        try:
            secret = secret_path.read_text().strip()
            if secret:
                return secret
        except Exception:
            pass

    new_secret = secrets.token_urlsafe(32)
    try:
        secret_path.write_text(new_secret)
        secret_path.chmod(0o600)
        return new_secret
    except Exception:
        return new_secret


def wait_for_server(port: int, timeout: int = 30) -> bool:
    """Wait for the server to be ready."""
    import socket

    for _ in range(timeout * 10):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
                sock.settimeout(0.1)
                result = sock.connect_ex(("localhost", port))
                if result == 0:
                    return True
        except OSError:
            pass
        time.sleep(0.1)
    return False


def is_server_running(port: int) -> bool:
    """Check if server is already running on the port."""
    import socket

    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.settimeout(0.1)
            result = sock.connect_ex(("localhost", port))
            return result == 0
    except OSError:
        return False


# =============================================================================
# Server Manager
# =============================================================================


class ServerManager:
    """Manages the chat and FastAPI server lifecycle for testing."""

    def __init__(self, config: NaoConfig):
        self.config = config
        self.chat_process: subprocess.Popen | None = None
        self.fastapi_process: subprocess.Popen | None = None
        self.chat_was_running = False
        self.fastapi_was_running = False

    def start(self) -> bool:
        """Start the servers if not already running. Returns True if we started them."""
        # Set up environment
        env = os.environ.copy()
        env["NAO_TEST_MODE"] = "true"

        # Set LLM API key from config
        if self.config.llm:
            env_var_name = f"{self.config.llm.provider.upper()}_API_KEY"
            env[env_var_name] = self.config.llm.api_key

        env["NAO_DEFAULT_PROJECT_PATH"] = str(Path.cwd())
        env["FASTAPI_URL"] = f"http://localhost:{FASTAPI_PORT}"

        # Start FastAPI server
        if is_server_running(FASTAPI_PORT):
            console.print("[dim]FastAPI server already running on port 8005[/dim]")
            self.fastapi_was_running = True
        else:
            fastapi_path = get_fastapi_main_path()
            console.print("[dim]Starting FastAPI server...[/dim]")

            self.fastapi_process = subprocess.Popen(
                [sys.executable, str(fastapi_path)],
                env=env,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )

            if not wait_for_server(FASTAPI_PORT):
                console.print("[bold red]✗[/bold red] FastAPI server failed to start")
                self.stop()
                return False

            console.print("[bold green]✓[/bold green] FastAPI server ready")

        # Start chat server
        if is_server_running(SERVER_PORT):
            console.print("[dim]Chat server already running on port 5005[/dim]")
            self.chat_was_running = True
        else:
            binary_path, server_dir, use_dev_mode = get_server_config()

            # If server_dir is None and server isn't running, we can't start
            if binary_path is None and server_dir is None:
                console.print("[bold red]✗[/bold red] Cannot start chat server")
                console.print("[dim]Start the server manually: cd apps/backend && bun run dev[/dim]")
                return False

            if server_dir:
                auth_secret = ensure_auth_secret(server_dir)
                if auth_secret:
                    env["BETTER_AUTH_SECRET"] = auth_secret

            if use_dev_mode and server_dir:
                console.print("[dim]Starting chat server (dev mode with bun)...[/dim]")
                self.chat_process = subprocess.Popen(
                    ["bun", "run", "src/index.ts"],
                    cwd=str(server_dir),
                    env=env,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
            elif binary_path:
                console.print("[dim]Starting chat server...[/dim]")
                self.chat_process = subprocess.Popen(
                    [str(binary_path)],
                    cwd=str(server_dir) if server_dir else None,
                    env=env,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )

            if not wait_for_server(SERVER_PORT):
                console.print("[bold red]✗[/bold red] Chat server failed to start")
                self.stop()
                return False

            console.print("[bold green]✓[/bold green] Chat server ready")

        return True

    def stop(self):
        """Stop the servers if we started them."""
        for name, process, was_running in [
            ("Chat server", self.chat_process, self.chat_was_running),
            ("FastAPI server", self.fastapi_process, self.fastapi_was_running),
        ]:
            if process and not was_running:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()
        console.print("[dim]Servers stopped[/dim]")


# =============================================================================
# HTTP Clients
# =============================================================================


class AgentClient:
    """HTTP client for the test agent endpoint."""

    def __init__(self, base_url: str = f"http://localhost:{SERVER_PORT}"):
        self.base_url = base_url
        self.test_endpoint = f"{base_url}/api/test/run"

    def run(self, messages: list[dict]) -> dict:
        """Send messages to the agent and get the response."""
        response = requests.post(
            self.test_endpoint,
            json={"messages": messages},
            headers={"Content-Type": "application/json"},
            timeout=300,
        )

        if not response.ok:
            error_data = response.json() if response.text else {"error": response.reason}
            raise Exception(f"Agent request failed: {error_data.get('error', response.reason)}")

        return response.json()

    def send_prompt(self, prompt: str, history: list[dict] | None = None) -> tuple[str, int, list[dict]]:
        """Send a prompt and return the response text, token count, and full message history.

        Args:
            prompt: The prompt text to send
            history: Optional previous message history to continue from

        Returns:
            Tuple of (response_text, token_count, messages)
            where messages includes all messages (history + new prompt + response)
        """
        message = {
            "id": f"msg_{int(time.time() * 1000)}",
            "role": "user",
            "parts": [{"type": "text", "text": prompt}],
            "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        }

        # Combine history with new message
        messages = (history or []) + [message]
        result = self.run(messages)

        final_text = result.get("finalText", "")
        total_tokens = result.get("totalTokens", {}).get("total", 0)
        # Return the full message history including the response
        response_messages = result.get("messages", [])
        # Filter out 'tool' role messages as they are not supported by convertToModelMessages
        # Only keep 'user' and 'assistant' messages for the conversation history
        filtered_response = [m for m in response_messages if m.get("role") in ("user", "assistant")]
        # The full history is: original messages + filtered response messages
        full_history = messages + filtered_response

        return final_text, total_tokens, full_history


def execute_sql(sql_query: str, project_folder: str, database_id: str | None = None) -> dict:
    """Execute a SQL query via the FastAPI endpoint."""
    try:
        response = requests.post(
            f"http://localhost:{FASTAPI_PORT}/execute_sql",
            json={
                "sql": sql_query,
                "nao_project_folder": project_folder,
                "database_id": database_id,
            },
            headers={"Content-Type": "application/json"},
            timeout=60,
        )

        if not response.ok:
            error_data = response.json() if response.text else {"detail": response.reason}
            return {"error": error_data.get("detail", response.reason)}

        return response.json()
    except Exception as e:
        return {"error": str(e)}
