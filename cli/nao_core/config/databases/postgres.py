from typing import Literal

import ibis
from ibis import BaseBackend
from pydantic import Field
from rich.prompt import Prompt

from nao_core.config.exceptions import InitError

from .base import DatabaseConfig, console


class PostgresConfig(DatabaseConfig):
    """PostgreSQL-specific configuration."""

    type: Literal["postgres"] = "postgres"
    host: str = Field(description="PostgreSQL host")
    port: int = Field(default=5432, description="PostgreSQL port")
    database: str = Field(description="Database name")
    user: str = Field(description="Username")
    password: str = Field(description="Password")
    schema_name: str | None = Field(default=None, description="Default schema (optional, uses 'public' if not set)")

    @classmethod
    def promptConfig(cls) -> "PostgresConfig":
        """Interactively prompt the user for PostgreSQL configuration."""
        console.print("\n[bold cyan]PostgreSQL Configuration[/bold cyan]\n")

        name = Prompt.ask("[bold]Connection name[/bold]", default="postgres-prod")

        host = Prompt.ask("[bold]Host[/bold]", default="localhost")

        port = Prompt.ask("[bold]Port[/bold]", default="5432")
        if not port.isdigit():
            raise InitError("Port must be a valid integer.")

        database = Prompt.ask("[bold]Database name[/bold]")
        if not database:
            raise InitError("Database name cannot be empty.")

        user = Prompt.ask("[bold]Username[/bold]")
        if not user:
            raise InitError("Username cannot be empty.")

        password = Prompt.ask("[bold]Password[/bold]", password=True)

        schema_name = Prompt.ask(
            "[bold]Default schema[/bold] [dim](optional, uses 'public' if empty)[/dim]",
            default="",
        )

        return PostgresConfig(
            name=name,
            host=host,
            port=int(port),
            database=database,
            user=user,
            password=password,
            schema_name=schema_name or None,
        )

    def connect(self) -> BaseBackend:
        """Create an Ibis PostgreSQL connection."""

        kwargs: dict = {
            "host": self.host,
            "port": self.port,
            "database": self.database,
            "user": self.user,
            "password": self.password,
        }

        if self.schema_name:
            kwargs["schema"] = self.schema_name

        return ibis.postgres.connect(
            **kwargs,
        )

    def get_database_name(self) -> str:
        """Get the database name for Postgres."""

        return self.database
