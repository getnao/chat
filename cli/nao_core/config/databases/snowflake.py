from typing import Literal

import ibis
from ibis import BaseBackend
from pydantic import Field
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend

from .base import DatabaseConfig


class SnowflakeConfig(DatabaseConfig):
    """Snowflake-specific configuration."""

    type: Literal["snowflake"] = "snowflake"
    username: str = Field(description="Snowflake username")
    account_id: str = Field(description="Snowflake account identifier (e.g., 'xy12345.us-east-1')")
    password: str | None = Field(default=None, description="Snowflake password")
    database: str = Field(description="Snowflake database")
    schema: str | None = Field(default=None, description="Snowflake schema (optional)")
    warehouse: str | None = Field(default=None, description="Snowflake warehouse to use (optional)")
    private_key_path: str | None = Field(
        default=None,
        description="Path to private key file for key-pair authentication",
    )
    passphrase: str | None = Field(default=None, description="Passphrase for the private key if it is encrypted",)

    key_pair_auth: bool = Field(
        default=False, description="Use key-pair authentication instead of password",
    )
    sso: bool = Field(default=False, description="Use Single Sign-On (SSO) for authentication")

    def connect(self) -> BaseBackend:
        """Create an Ibis Snowflake connection."""
        kwargs: dict = {"user": self.username}
        kwargs["account"] = self.account_id

        if self.database and self.schema:
            kwargs["database"] = f"{self.database}/{self.schema}"
        elif self.database:
            kwargs["database"] = self.database

        if self.warehouse:
            kwargs["warehouse"] = self.warehouse

        if self.key_pair_auth:
            with open(self.private_key_path, "rb") as key_file:
                private_key = serialization.load_pem_private_key(
                    key_file.read(),
                    password=self.passphrase.encode() if self.passphrase else None,
                    backend=default_backend()
                )
                # Convert to DER format which Snowflake expects
                kwargs["private_key"] = private_key.private_bytes(
                    encoding=serialization.Encoding.DER,
                    format=serialization.PrivateFormat.PKCS8,
                    encryption_algorithm=serialization.NoEncryption()
                )
        elif self.sso:
            kwargs["authenticator"] = "externalbrowser"
        else:
            kwargs["password"] = self.password

        return ibis.snowflake.connect(**kwargs)
