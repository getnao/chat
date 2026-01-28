"""nao test command - Run unit tests for agent SQL generation."""

import sys
from pathlib import Path
from typing import Annotated

from cyclopts import Parameter
from rich.console import Console

from nao_core.config import NaoConfig

from .evaluator import display_results, display_summary, display_test_details, load_test_cases, run_single_test
from .servers import AgentClient, ServerManager

console = Console()


def test(
    *,
    select: Annotated[str | None, Parameter(name=["-s", "--select"])] = None,
):
    """Run unit tests for agent SQL generation.

    Looks for YAML test files in the 'tests' folder of the current nao project.
    Each test file should contain:
    - name: Test name
    - prompt: The question to ask the agent
    - sql: The expected SQL query (or empty if no answer expected)
    - schema_output: Expected output columns (when sql is empty)

    Parameters
    ----------
    select : str, optional
        Run only the test with this name (e.g., -s churn_last_month)
    """
    console.print("\n[bold cyan]🧪 Running nao tests...[/bold cyan]\n")

    # Load nao config
    config = NaoConfig.try_load()
    if config is None:
        console.print("[bold red]✗ No nao_config.yaml found in current directory.[/bold red]")
        console.print("[dim]Please navigate to a nao project directory.[/dim]")
        sys.exit(1)

    # Type narrowing: config is guaranteed to be NaoConfig after the check above
    assert config is not None

    project_folder = str(Path.cwd())
    tests_folder = Path.cwd() / "tests"

    if not tests_folder.exists():
        console.print(f"[bold yellow]⚠[/bold yellow] Tests folder not found: {tests_folder}")
        console.print("[dim]Create a 'tests' folder with YAML test files to run tests.[/dim]")
        sys.exit(1)

    # Load test cases
    test_cases = load_test_cases(tests_folder)

    if not test_cases:
        console.print("[bold yellow]⚠[/bold yellow] No test files found in tests folder.")
        console.print("[dim]Add .yml or .yaml test files to the tests folder.[/dim]")
        sys.exit(1)

    # Filter by selected test name if provided
    if select:
        test_cases = [tc for tc in test_cases if tc.name == select]
        if not test_cases:
            console.print(f"[bold red]✗[/bold red] No test found with name: {select}")
            console.print("[dim]Available tests:[/dim]")
            all_tests = load_test_cases(tests_folder)
            for tc in all_tests:
                console.print(f"  [dim]•[/dim] {tc.name}")
            sys.exit(1)

    console.print(f"[bold green]✓[/bold green] Found {len(test_cases)} test(s)")

    # Start the server
    server = ServerManager(config)
    try:
        server.start()

        # Create agent client
        agent_client = AgentClient()

        console.print()

        # Run tests and display results immediately after each test
        results: list[tuple] = []

        for i, test_case in enumerate(test_cases):
            console.print(f"[dim]Running test {i + 1}/{len(test_cases)}:[/dim] [bold]{test_case.name}[/bold]...")

            result = run_single_test(test_case, config, project_folder, agent_client)
            results.append((test_case, result))

            display_test_details(result, test_case)

        # Display summary table and stats at the end
        display_results([r for _, r in results])
        display_summary([r for _, r in results])

    finally:
        server.stop()


__all__ = ["test"]
