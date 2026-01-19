from typing import Literal

import ibis
from ibis import BaseBackend
from pydantic import Field

from .base import DatabaseConfig


class DatabricksConfig(DatabaseConfig):
    """Databricks-specific configuration."""

    type: Literal["databricks"] = "databricks"
    server_hostname: str = Field(description="Databricks server hostname (e.g., 'adb-xxxx.azuredatabricks.net')")
    http_path: str = Field(description="HTTP path to the SQL warehouse or cluster")
    access_token: str = Field(description="Databricks personal access token")
    catalog: str | None = Field(default=None, description="Unity Catalog name (optional)")
    schema: str | None = Field(default=None, description="Default schema (optional)")

    def connect(self) -> BaseBackend:
        """Create an Ibis Databricks connection."""
        kwargs: dict = {
            "server_hostname": self.server_hostname,
            "http_path": self.http_path,
            "access_token": self.access_token,
        }

        if self.catalog:
            kwargs["catalog"] = self.catalog

        if self.schema:
            kwargs["schema"] = self.schema

        return ibis.databricks.connect(**kwargs)
