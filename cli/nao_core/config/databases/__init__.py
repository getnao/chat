from typing import Annotated, Union

from pydantic import Discriminator, Tag

from .base import AccessorType, DatabaseConfig, DatabaseType
from .bigquery import BigQueryConfig
from .snowflake import SnowflakeConfig

# =============================================================================
# Database Config Registry
# =============================================================================

AnyDatabaseConfig = Annotated[
    Union[
        Annotated[BigQueryConfig, Tag("bigquery")],
        Annotated[SnowflakeConfig, Tag("snowflake")],
    ],
    Discriminator("type"),
]


def parse_database_config(data: dict) -> DatabaseConfig:
    """Parse a database config dict into the appropriate type."""
    db_type = data.get("type")
    if db_type == "bigquery":
        return BigQueryConfig.model_validate(data)
    elif db_type == "snowflake":
        return SnowflakeConfig.model_validate(data)
    else:
        raise ValueError(f"Unknown database type: {db_type}")


__all__ = ["AccessorType", "DatabaseConfig", "DatabaseType", "BigQueryConfig", "SnowflakeConfig", "AnyDatabaseConfig"]
