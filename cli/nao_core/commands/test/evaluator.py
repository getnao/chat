"""Test evaluation: running tests and displaying results."""

import json
import re
import time
from pathlib import Path

from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from nao_core.config import NaoConfig

from .servers import AgentClient, execute_sql
from .testcases import TestCase, TestResult

console = Console()


# =============================================================================
# Test Loading
# =============================================================================


def load_test_cases(tests_folder: Path) -> list[TestCase]:
    """Load all test cases from the tests folder."""
    test_cases = []

    if not tests_folder.exists():
        return test_cases

    for yaml_file in tests_folder.glob("*.yml"):
        try:
            test_cases.append(TestCase.from_yaml(yaml_file))
        except Exception as e:
            console.print(f"[yellow]Warning: Could not load {yaml_file}: {e}[/yellow]")

    for yaml_file in tests_folder.glob("*.yaml"):
        try:
            test_cases.append(TestCase.from_yaml(yaml_file))
        except Exception as e:
            console.print(f"[yellow]Warning: Could not load {yaml_file}: {e}[/yellow]")

    return test_cases


# =============================================================================
# Result Comparison
# =============================================================================


def extract_json_from_response(response: str) -> dict | None:
    """Extract JSON from agent response."""
    # First, try to extract content from markdown code blocks and parse as JSON
    # This handles multi-line JSON with nested braces in string values
    code_block_patterns = [
        r"```json\s*([\s\S]*?)\s*```",
        r"```\s*([\s\S]*?)\s*```",
    ]

    for pattern in code_block_patterns:
        match = re.search(pattern, response)
        if match:
            content = match.group(1).strip()
            try:
                return json.loads(content)
            except json.JSONDecodeError:
                # Try cleaning up single quotes
                try:
                    cleaned = content.replace("'", '"').replace("None", "null")
                    return json.loads(cleaned)
                except json.JSONDecodeError:
                    continue

    # Fallback: try to find JSON object patterns
    patterns = [
        # Handle both single and double quotes, and null value
        r"(\{['\"]query['\"]:\s*(?:null|None|['\"].*?['\"]).*?\})",
        r'(\{"query":\s*(?:null|"[^"]*")\})',
        r"(\{'query':\s*(?:null|None|'[^']*')\})",
    ]

    for pattern in patterns:
        match = re.search(pattern, response, re.DOTALL)
        if match:
            try:
                # Replace single quotes with double quotes for valid JSON
                json_str = match.group(1).replace("'", '"')
                # Handle Python None -> JSON null
                json_str = json_str.replace("None", "null")
                return json.loads(json_str)
            except json.JSONDecodeError:
                continue

    try:
        return json.loads(response)
    except json.JSONDecodeError:
        pass

    return None


def normalize_data(data: list[dict]) -> list[dict]:
    """Normalize data for comparison."""
    normalized = []
    for row in data:
        norm_row = {}
        for k, v in sorted(row.items()):
            if isinstance(v, float):
                norm_row[k] = round(v, 2)
            else:
                norm_row[k] = v
        normalized.append(norm_row)
    return normalized


def compare_results(expected: list[dict], actual: list[dict]) -> bool:
    """Compare two result sets for equality."""
    if len(expected) != len(actual):
        return False

    norm_expected = normalize_data(expected)
    norm_actual = normalize_data(actual)

    try:
        norm_expected.sort(key=lambda x: tuple(str(v) for v in x.values()))
        norm_actual.sort(key=lambda x: tuple(str(v) for v in x.values()))
    except Exception:
        pass

    return norm_expected == norm_actual


# =============================================================================
# Test Runner
# =============================================================================


def run_single_test(
    test_case: TestCase, config: NaoConfig, project_folder: str, agent_client: AgentClient
) -> TestResult:
    """Run a single test case and return the result."""
    start_time = time.time()
    total_tokens = 0
    total_bytes_processed = 0  # Sum of bytes from all SQL executions
    has_answer: bool | None = None
    is_correct = False
    agent_sql = None
    expected_data = None
    actual_data = None
    error = None
    final_prompt = None
    agent_response = None

    try:
        # Step 1: Execute expected SQL first to get columns and expected data
        columns: list[str] = []
        if test_case.sql:
            expected_result = execute_sql(test_case.sql, project_folder)
            if "error" in expected_result:
                error = f"Expected SQL error: {expected_result['error']}"
            else:
                expected_data = expected_result.get("data", [])
                # Track bytes processed from expected SQL
                if expected_result.get("bytes_processed"):
                    total_bytes_processed += expected_result["bytes_processed"]
                # Infer columns from the result
                if expected_data:
                    columns = list(expected_data[0].keys())
        elif test_case.schema_output:
            columns = test_case.schema_output

        # Step 2: Send the prompt to the agent
        _, tokens1, messages = agent_client.send_prompt(test_case.prompt)
        total_tokens += tokens1

        # Step 3: Ask for the final query in JSON format (continuing the conversation)
        schema_hint = ", ".join(columns) if columns else "unknown"

        final_prompt = f"""Based on your previous analysis, provide the final SQL query that answers the original question.

Format your answer as a JSON on this format: {{'query': 'YOUR_SQL_QUERY_HERE'}}
Output schema of the query should have these columns: {schema_hint}

If you cannot answer, respond with: {{'query': null}}"""

        final_response, tokens2, _ = agent_client.send_prompt(final_prompt, history=messages)
        total_tokens += tokens2
        agent_response = final_response

        # Extract the query from the response
        json_data = extract_json_from_response(final_response)

        # Handle case where no answer is expected
        if test_case.expects_no_answer:
            if json_data:
                query_value = json_data.get("query")
                if query_value is None or query_value == "" or query_value == "null":
                    has_answer = None
                    is_correct = True
                else:
                    has_answer = True
                    agent_sql = query_value
                    is_correct = False
                    error = "Agent provided an answer when none was expected"
            else:
                has_answer = None
                is_correct = True
        else:
            # Normal case: expected SQL exists
            if json_data and "query" in json_data and json_data["query"]:
                has_answer = True
                agent_sql = json_data["query"]

                # Execute agent SQL and compare
                if expected_data is not None:
                    actual_result = execute_sql(agent_sql, project_folder)
                    if "error" in actual_result:
                        error = f"Agent SQL error: {actual_result['error']}"
                    else:
                        actual_data = actual_result.get("data", [])
                        # Track bytes processed from agent SQL
                        if actual_result.get("bytes_processed"):
                            total_bytes_processed += actual_result["bytes_processed"]
                        is_correct = compare_results(expected_data, actual_data)
            else:
                has_answer = False
                error = "Could not extract JSON query from agent response"

    except Exception as e:
        error = str(e)

    elapsed = time.time() - start_time

    return TestResult(
        name=test_case.name,
        time_seconds=elapsed,
        total_tokens=total_tokens,
        is_correct=is_correct,
        has_answer=has_answer,
        error=error,
        agent_sql=agent_sql,
        expected_data=expected_data,
        actual_data=actual_data,
        final_prompt=final_prompt,
        agent_response=agent_response,
        bytes_processed=total_bytes_processed if total_bytes_processed > 0 else None,
    )


# =============================================================================
# Display Functions
# =============================================================================


def display_data_preview(data: list[dict] | None, max_rows: int = 5) -> Table:
    """Create a table preview of query results."""
    if not data:
        table = Table(show_header=False, box=None)
        table.add_row("[dim]No data[/dim]")
        return table

    columns = list(data[0].keys()) if data else []

    table = Table(show_header=True, header_style="bold", box=None, padding=(0, 1))
    for col in columns:
        table.add_column(col, overflow="fold", max_width=30)

    for row in data[:max_rows]:
        table.add_row(*[str(row.get(col, ""))[:30] for col in columns])

    if len(data) > max_rows:
        table.add_row(*[f"[dim]... +{len(data) - max_rows} more[/dim]"] + [""] * (len(columns) - 1))

    return table


def format_bytes(bytes_value: int | None) -> str:
    """Format bytes into human-readable string."""
    if bytes_value is None:
        return "N/A"
    if bytes_value < 1024:
        return f"{bytes_value} B"
    elif bytes_value < 1024**2:
        return f"{bytes_value / 1024:.1f} KB"
    elif bytes_value < 1024**3:
        return f"{bytes_value / 1024**2:.1f} MB"
    elif bytes_value < 1024**4:
        return f"{bytes_value / 1024**3:.2f} GB"
    else:
        return f"{bytes_value / 1024**4:.2f} TB"


def display_test_details(result: TestResult, test_case: TestCase) -> None:
    """Display detailed logs for a single test."""
    status_icon = "[green]✓[/green]" if result.is_correct else "[red]✗[/red]"
    status_text = "[green]PASS[/green]" if result.is_correct else "[red]FAIL[/red]"

    console.print()
    console.print(f"{'─' * 80}")
    console.print(f"{status_icon} [bold]{result.name}[/bold] - {status_text}")
    console.print()

    # Display KPIs table
    kpi_table = Table(show_header=False, box=None, padding=(0, 2))
    kpi_table.add_column("Metric", style="bold")
    kpi_table.add_column("Value", style="cyan")

    kpi_table.add_row("⏱  Execution Time", f"{result.time_seconds:.2f}s")
    kpi_table.add_row("🔤 Tokens Used", f"{result.total_tokens:,}")
    if result.bytes_processed:
        kpi_table.add_row("💾 Bytes Processed", format_bytes(result.bytes_processed))
    if result.has_answer is not None:
        answer_status = "[green]Yes[/green]" if result.has_answer else "[red]No[/red]"
        kpi_table.add_row("💬 Answer Provided", answer_status)
    correct_status = "[green]Yes[/green]" if result.is_correct else "[red]No[/red]"
    kpi_table.add_row("✓  Correct", correct_status)

    console.print(Panel(kpi_table, title="📊 Test KPIs", border_style="cyan", padding=(0, 1)))
    console.print()

    console.print("[bold cyan]📝 Prompt:[/bold cyan]")
    console.print(f"[dim]{test_case.prompt}[/dim]")
    console.print()

    if result.final_prompt:
        console.print("[bold cyan]📤 Final Prompt (query extraction):[/bold cyan]")
        console.print(Panel(result.final_prompt, border_style="dim", padding=(0, 1)))
        console.print()

    if result.agent_response:
        console.print("[bold cyan]📥 Agent Response:[/bold cyan]")
        # Truncate very long responses
        response_preview = result.agent_response[:2000]
        if len(result.agent_response) > 2000:
            response_preview += f"\n... [dim](truncated, {len(result.agent_response)} chars total)[/dim]"
        console.print(Panel(response_preview, border_style="yellow", padding=(0, 1)))
        console.print()

    console.print("[bold cyan]🤖 Agent SQL Query:[/bold cyan]")
    if result.agent_sql:
        console.print(Panel(result.agent_sql, border_style="blue", padding=(0, 1)))
    else:
        console.print("[dim]No query generated[/dim]")
    console.print()

    console.print("[bold cyan]✅ Expected SQL Query:[/bold cyan]")
    if test_case.expects_no_answer:
        if test_case.schema_output:
            columns = ", ".join(test_case.schema_output)
            console.print(f"[dim]No answer expected | Expected schema: {columns}[/dim]")
        else:
            console.print("[dim]No answer expected[/dim]")
    elif test_case.sql:
        console.print(Panel(test_case.sql.strip(), border_style="green", padding=(0, 1)))
    console.print()

    console.print("[bold cyan]🤖 Agent Query Results:[/bold cyan]")
    if result.actual_data is not None:
        console.print(display_data_preview(result.actual_data))
    else:
        console.print("[dim]No results (query failed or not executed)[/dim]")
    console.print()

    console.print("[bold cyan]✅ Expected Query Results:[/bold cyan]")
    if test_case.expects_no_answer:
        console.print("[dim]No results expected[/dim]")
    elif result.expected_data is not None:
        console.print(display_data_preview(result.expected_data))
    else:
        console.print("[dim]No results (query failed or not executed)[/dim]")

    if result.error:
        console.print()
        console.print(f"[bold red]⚠ Error:[/bold red] {result.error}")


def display_results(results: list[TestResult]) -> None:
    """Display the test results in a table."""
    # Check if any result has bytes_processed to decide whether to show the column
    has_bytes_data = any(r.bytes_processed for r in results)

    table = Table(title="Test Results", show_header=True, header_style="bold cyan")
    table.add_column("Test", style="white")
    table.add_column("Time (s)", justify="right")
    table.add_column("Tokens", justify="right")
    if has_bytes_data:
        table.add_column("Bytes", justify="right")
    table.add_column("Answer", justify="center")
    table.add_column("Correct", justify="center")
    table.add_column("Status", justify="center")

    for result in results:
        status = "[green]✓ PASS[/green]" if result.is_correct else "[red]✗ FAIL[/red]"
        if result.has_answer is None:
            answer = "[dim]N/A[/dim]"
        elif result.has_answer:
            answer = "[green]Yes[/green]"
        else:
            answer = "[red]No[/red]"
        correct = "[green]Yes[/green]" if result.is_correct else "[red]No[/red]"

        row = [
            result.name,
            f"{result.time_seconds:.2f}",
            str(result.total_tokens),
        ]
        if has_bytes_data:
            row.append(format_bytes(result.bytes_processed))
        row.extend([answer, correct, status])

        table.add_row(*row)

    console.print()
    console.print(table)


def display_summary(results: list[TestResult]) -> None:
    """Display summary statistics."""
    if not results:
        return

    total_tests = len(results)
    passed = sum(1 for r in results if r.is_correct)
    tests_expecting_answer = [r for r in results if r.has_answer is not None]
    answered = sum(1 for r in tests_expecting_answer if r.has_answer)
    no_answer_expected = sum(1 for r in results if r.has_answer is None)
    avg_time = sum(r.time_seconds for r in results) / total_tests
    avg_tokens = sum(r.total_tokens for r in results) / total_tests

    # Calculate bytes processed stats
    total_bytes = sum(r.bytes_processed or 0 for r in results)
    has_bytes_data = total_bytes > 0

    if tests_expecting_answer:
        answer_rate = f"{answered}/{len(tests_expecting_answer)} ({100 * answered / len(tests_expecting_answer):.1f}%)"
    else:
        answer_rate = "N/A"

    summary = f"""[bold cyan]Summary[/bold cyan]

[bold]Tests:[/bold] {passed}/{total_tests} passed ({100 * passed / total_tests:.1f}%)
[bold]Answer Rate:[/bold] {answer_rate}{f" [dim](+{no_answer_expected} N/A)[/dim]" if no_answer_expected else ""}
[bold]Average Time:[/bold] {avg_time:.2f} seconds
[bold]Average Tokens:[/bold] {int(avg_tokens):,}
[bold]Total Tokens:[/bold] {sum(r.total_tokens for r in results):,}"""

    if has_bytes_data:
        summary += f"""
[bold]Total Bytes Processed:[/bold] {format_bytes(total_bytes)}"""

    summary += "\n"
    console.print(Panel(summary, title="📊 Test Summary", border_style="cyan"))

    errors = [r for r in results if r.error]
    if errors:
        console.print("\n[bold red]Errors:[/bold red]")
        for r in errors:
            console.print(f"  [red]•[/red] {r.name}: {r.error}")
