"""Test case and result definitions."""

from dataclasses import dataclass
from pathlib import Path

import yaml


@dataclass
class TestCase:
    """A single test case loaded from YAML."""

    name: str
    prompt: str
    sql: str | None  # None or empty string means no valid answer expected
    schema_output: list[str] | None  # Expected output columns (used when sql is empty)
    file_path: Path

    @property
    def expects_no_answer(self) -> bool:
        """Check if this test expects no answer (sql is empty or None)."""
        return not self.sql or not self.sql.strip()

    @classmethod
    def from_yaml(cls, file_path: Path) -> "TestCase":
        """Load a test case from a YAML file."""
        with open(file_path) as f:
            data = yaml.safe_load(f)

        return cls(
            name=data["name"],
            prompt=data["prompt"],
            sql=data.get("sql") or None,
            schema_output=data.get("schema_output"),
            file_path=file_path,
        )


@dataclass
class TestResult:
    """Result of running a single test."""

    name: str
    time_seconds: float
    total_tokens: int
    is_correct: bool
    has_answer: bool | None  # None means N/A (no answer expected)
    error: str | None = None
    agent_sql: str | None = None
    expected_data: list[dict] | None = None
    actual_data: list[dict] | None = None
    final_prompt: str | None = None  # The prompt sent to extract the query
    agent_response: str | None = None  # The raw response from the agent
    bytes_processed: int | None = None  # Total bytes scanned by all SQL queries
