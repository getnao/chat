"""Read Metabase assets into a portable migration manifest.

The command deliberately only reads from Metabase. A manifest is useful both
to a human reviewer and to an agent using nao's ``create_story`` / ``update_story``
MCP tools; keeping source extraction separate prevents a partially mapped
dashboard from silently changing either system.
"""

from __future__ import annotations

import json
import os
from collections.abc import Mapping
from pathlib import Path
from typing import Annotated, Any
from urllib.parse import urlparse

import httpx
from cyclopts import App, Parameter

from nao_core.tracking import track_command
from nao_core.ui import UI

metabase = App(name="metabase", help="Read Metabase assets for migration to nao stories.")


class MetabaseApiError(RuntimeError):
    """A safe, actionable error returned by the Metabase API."""


class MetabaseClient:
    """Small read-only client for the stable Metabase REST resources we need."""

    def __init__(self, base_url: str, api_key: str, client: httpx.Client | None = None) -> None:
        parsed = urlparse(base_url)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("Metabase URL must be an absolute http(s) URL.")
        if not api_key:
            raise ValueError("A Metabase API key is required. Set METABASE_API_KEY or pass --api-key.")

        if parsed.username or parsed.password:
            raise ValueError("Metabase URL must not contain credentials; use an API key instead.")

        self.base_url = base_url.rstrip("/")
        self._client = client or httpx.Client(timeout=30)
        self._client.headers["X-API-Key"] = api_key
        self._owns_client = client is None

    def close(self) -> None:
        if self._owns_client:
            self._client.close()

    def collections(self) -> Any:
        return self._get("/api/collection")

    def dashboards(self) -> Any:
        return self._get("/api/dashboard")

    def card(self, card_id: int) -> dict[str, Any]:
        return self._as_object(self._get(f"/api/card/{card_id}"), f"card {card_id}")

    def dashboard(self, dashboard_id: int) -> dict[str, Any]:
        return self._as_object(self._get(f"/api/dashboard/{dashboard_id}"), f"dashboard {dashboard_id}")

    def _get(self, path: str) -> Any:
        try:
            response = self._client.get(f"{self.base_url}{path}")
            response.raise_for_status()
        except httpx.HTTPStatusError as error:
            raise MetabaseApiError(f"Metabase returned HTTP {error.response.status_code} for {path}.") from error
        except httpx.HTTPError as error:
            raise MetabaseApiError(f"Could not reach Metabase at {self.base_url}: {error}") from error

        try:
            return response.json()
        except ValueError as error:
            raise MetabaseApiError(f"Metabase returned invalid JSON for {path}.") from error

    @staticmethod
    def _as_object(value: Any, label: str) -> dict[str, Any]:
        if not isinstance(value, dict):
            raise MetabaseApiError(f"Metabase returned an unexpected response for {label}.")
        return value


def extract_dashboard_manifest(client: MetabaseClient, dashboard_id: int) -> dict[str, Any]:
    """Fetch a dashboard and card definitions without interpreting MBQL.

    ``dataset_query`` and visualization settings are retained verbatim. MBQL
    stays opaque so the migration agent can re-derive target SQL against nao
    context while retaining the source definition for review.
    """

    dashboard = client.dashboard(dashboard_id)
    warnings: list[str] = []
    cards: list[dict[str, Any]] = []

    dashcards = dashboard.get("dashcards", [])
    if not isinstance(dashcards, list):
        warnings.append("Dashboard dashcards were not a list and could not be extracted.")
        dashcards = []

    for dashcard in dashcards:
        if not isinstance(dashcard, Mapping):
            warnings.append("Skipped a malformed dashboard card entry.")
            continue

        card_id = dashcard.get("card_id")
        placement = _dashcard_placement(dashcard)
        mappings = _json_value(dashcard.get("parameter_mappings"))
        if isinstance(card_id, int):
            card = client.card(card_id)
            dataset_query = _json_value(card.get("dataset_query"))
            cards.append(
                {
                    "kind": "question",
                    "id": card_id,
                    "name": card.get("name"),
                    "description": card.get("description"),
                    "collection_id": card.get("collection_id"),
                    "type": card.get("type"),
                    "dataset_query": dataset_query,
                    "query_kind": _query_kind(dataset_query),
                    "visualization_settings": _json_value(card.get("visualization_settings")),
                    "display": card.get("display"),
                    "dashboard_tab_id": dashcard.get("dashboard_tab_id"),
                    "parameter_mappings": mappings,
                    "placement": placement,
                }
            )
            continue

        text = _text_card_content(dashcard)
        if text is not None:
            cards.append(
                {
                    "kind": "text",
                    "text": text,
                    "dashboard_tab_id": dashcard.get("dashboard_tab_id"),
                    "placement": placement,
                }
            )
        else:
            warnings.append(
                f"Dashboard card {dashcard.get('id', '<unknown>')} has no saved question or recognised text content."
            )

    return {
        "format": "nao.metabase-dashboard-manifest.v1",
        "source": {"dashboard_id": dashboard_id, "tool": "nao metabase dashboard"},
        "dashboard": {
            "id": dashboard.get("id", dashboard_id),
            "name": dashboard.get("name"),
            "description": dashboard.get("description"),
            "collection_id": dashboard.get("collection_id"),
            "tabs": _json_value(dashboard.get("tabs", [])),
            "parameters": _json_value(dashboard.get("parameters", [])),
        },
        "cards": cards,
        "warnings": warnings,
    }


def _dashcard_placement(dashcard: Mapping[str, Any]) -> dict[str, Any]:
    return {key: dashcard[key] for key in ("id", "row", "col", "size_x", "size_y") if key in dashcard}


def _query_kind(dataset_query: Any) -> str:
    if isinstance(dataset_query, Mapping):
        query_type = dataset_query.get("type")
        if query_type == "native":
            return "native_sql"
        if query_type == "query":
            return "mbql"
    return "unknown"


def _text_card_content(dashcard: Mapping[str, Any]) -> str | None:
    settings = dashcard.get("visualization_settings")
    if not isinstance(settings, Mapping):
        return None
    for key in ("text", "content", "markdown"):
        value = settings.get(key)
        if isinstance(value, str):
            return value
    virtual_card = settings.get("virtual_card")
    if isinstance(virtual_card, Mapping):
        for key in ("text", "content", "markdown"):
            value = virtual_card.get(key)
            if isinstance(value, str):
                return value
    return None


def _json_value(value: Any) -> Any:
    """Ensure values produced by a client implementation are JSON compatible."""
    return json.loads(json.dumps(value, default=str))


def _credentials(url: str | None, api_key: str | None) -> tuple[str, str]:
    resolved_url = url or os.getenv("METABASE_URL")
    resolved_key = api_key or os.getenv("METABASE_API_KEY")
    if not resolved_url:
        raise ValueError("A Metabase URL is required. Set METABASE_URL or pass --url.")
    if not resolved_key:
        raise ValueError("A Metabase API key is required. Set METABASE_API_KEY or pass --api-key.")
    return resolved_url, resolved_key


def _write_result(payload: Any, output: Path | None) -> None:
    rendered = json.dumps(payload, indent=2, sort_keys=True) + "\n"
    if output is None:
        UI.print(rendered)
        return
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(rendered, encoding="utf-8")
    UI.success(f"Wrote Metabase migration manifest to {output}")


def _run_read(url: str | None, api_key: str | None, operation: Any, output: Path | None = None) -> None:
    try:
        base_url, key = _credentials(url, api_key)
        client = MetabaseClient(base_url, key)
        try:
            _write_result(operation(client), output)
        finally:
            client.close()
    except (MetabaseApiError, ValueError) as error:
        UI.error(str(error))
        raise SystemExit(1) from error


UrlOption = Annotated[
    str | None,
    Parameter(name="--url", help="Metabase base URL (defaults to METABASE_URL)."),
]
ApiKeyOption = Annotated[
    str | None,
    Parameter(name="--api-key", help="Metabase API key (defaults to METABASE_API_KEY; never written to output)."),
]
OutputOption = Annotated[
    Path | None,
    Parameter(name=["-o", "--output"], help="Write JSON to a file instead of stdout."),
]


@metabase.command
@track_command("metabase.collections")
def collections(url: UrlOption = None, api_key: ApiKeyOption = None, output: OutputOption = None) -> None:
    """List collections visible to the supplied Metabase API key."""
    _run_read(url, api_key, lambda client: client.collections(), output)


@metabase.command
@track_command("metabase.dashboards")
def dashboards(url: UrlOption = None, api_key: ApiKeyOption = None, output: OutputOption = None) -> None:
    """List dashboards visible to the supplied Metabase API key."""
    _run_read(url, api_key, lambda client: client.dashboards(), output)


@metabase.command
@track_command("metabase.card")
def card(
    card_id: int,
    url: UrlOption = None,
    api_key: ApiKeyOption = None,
    output: OutputOption = None,
) -> None:
    """Read one Metabase question/card, including its native SQL or MBQL definition."""
    _run_read(url, api_key, lambda client: client.card(card_id), output)


@metabase.command
@track_command("metabase.dashboard")
def dashboard(
    dashboard_id: int,
    url: UrlOption = None,
    api_key: ApiKeyOption = None,
    output: OutputOption = None,
) -> None:
    """Export a dashboard plus per-card definitions and filter wiring as a migration manifest."""
    _run_read(url, api_key, lambda client: extract_dashboard_manifest(client, dashboard_id), output)
