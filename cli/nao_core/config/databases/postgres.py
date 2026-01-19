from typing import Literal

import ibis
from ibis import BaseBackend
from pydantic import Field

from .base import DatabaseConfig


class PostgresConfig(DatabaseConfig):
    """PostgreSQL-specific configuration."""

    type: Literal["postgres"] = "postgres"
    host: str = Field(description="PostgreSQL host")
    port: int = Field(default=5432, description="PostgreSQL port")
    database: str = Field(description="Database name")
    user: str = Field(description="Username")
    password: str = Field(description="Password")
    schema_name: str | None = Field(default=None, description="Default schema (optional, uses 'public' if not set)")

    def connect(self) -> BaseBackend:
        """Create an Ibis PostgreSQL connection."""

        kwargs: dict = {"host": self.host, 
                        "port": self.port, 
                        "database": self.database, 
                        "user": self.user, 
                        "password": self.password}
        
        if self.schema_name:
            kwargs["schema"] = self.schema_name

        return ibis.postgres.connect(
            **kwargs,
        )
