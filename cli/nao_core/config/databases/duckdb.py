from pathlib import Path
from typing import Literal

import ibis
from ibis import BaseBackend
from pydantic import Field
from rich.prompt import Prompt

from .base import DatabaseConfig, console


class DuckDBConfig(DatabaseConfig):
    """DuckDB-specific configuration."""

    type: Literal["duckdb"] = "duckdb"
    path: str = Field(description="Path to the DuckDB database file", default=":memory:")

    @classmethod
    def promptConfig(cls) -> "DuckDBConfig":
        """Interactively prompt the user for DuckDB configuration."""
        console.print("\n[bold cyan]DuckDB Configuration[/bold cyan]\n")

        name = Prompt.ask("[bold]Connection name[/bold]", default="duckdb-memory")

        path = Prompt.ask("[bold]Path to the DuckDB database file[/bold]", default=":memory:")

        return DuckDBConfig(name=name, path=path)

    def connect(self) -> BaseBackend:
        """Create an Ibis DuckDB connection."""
        return ibis.duckdb.connect(
            database=self.path,
            read_only=False if self.path == ":memory:" else True,
        )

    def get_database_name(self) -> str:
        """Get the database name for DuckDB."""

        if self.path == ":memory:":
            return "memory"
        return Path(self.path).stem
