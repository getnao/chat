import httpx
import pytest

from nao_core.commands.metabase import MetabaseApiError, MetabaseClient, extract_dashboard_manifest


def make_client(routes: dict[str, object]) -> MetabaseClient:
    def handler(request: httpx.Request) -> httpx.Response:
        payload = routes.get(request.url.path)
        if payload is None:
            return httpx.Response(404, json={"message": "missing"}, request=request)
        assert request.headers["X-API-Key"] == "test-key"
        return httpx.Response(200, json=payload, request=request)

    return MetabaseClient("https://metabase.example", "test-key", httpx.Client(transport=httpx.MockTransport(handler)))


def test_dashboard_manifest_keeps_native_sql_filter_wiring_and_tabs():
    client = make_client(
        {
            "/api/dashboard/42": {
                "id": 42,
                "name": "Revenue",
                "collection_id": 9,
                "tabs": [{"id": 3, "name": "Overview"}],
                "parameters": [{"id": "date", "name": "Order date", "type": "date/all-options"}],
                "dashcards": [
                    {
                        "id": 100,
                        "card_id": 7,
                        "dashboard_tab_id": 3,
                        "row": 0,
                        "col": 0,
                        "size_x": 6,
                        "size_y": 4,
                        "parameter_mappings": [{"parameter_id": "date", "card_id": 7}],
                    }
                ],
            },
            "/api/card/7": {
                "id": 7,
                "name": "Monthly revenue",
                "type": "question",
                "display": "line",
                "dataset_query": {"type": "native", "native": {"query": "select 1"}},
                "visualization_settings": {"graph.dimensions": ["month"]},
            },
        }
    )

    manifest = extract_dashboard_manifest(client, 42)

    assert manifest["format"] == "nao.metabase-dashboard-manifest.v1"
    assert manifest["dashboard"]["tabs"] == [{"id": 3, "name": "Overview"}]
    assert manifest["dashboard"]["parameters"][0]["id"] == "date"
    assert manifest["cards"][0]["query_kind"] == "native_sql"
    assert manifest["cards"][0]["dataset_query"]["native"]["query"] == "select 1"
    assert manifest["cards"][0]["parameter_mappings"] == [{"parameter_id": "date", "card_id": 7}]


def test_dashboard_manifest_keeps_mbql_and_text_cards():
    client = make_client(
        {
            "/api/dashboard/42": {
                "id": 42,
                "name": "Retention",
                "dashcards": [
                    {"id": 1, "card_id": 9, "parameter_mappings": []},
                    {"id": 2, "visualization_settings": {"text": "## Read me"}, "row": 1},
                ],
            },
            "/api/card/9": {
                "id": 9,
                "name": "Active users",
                "dataset_query": {"type": "query", "query": {"aggregation": [["count"]]}},
            },
        }
    )

    manifest = extract_dashboard_manifest(client, 42)

    assert manifest["cards"][0]["query_kind"] == "mbql"
    assert manifest["cards"][0]["dataset_query"]["query"]["aggregation"] == [["count"]]
    assert manifest["cards"][1] == {
        "kind": "text",
        "text": "## Read me",
        "dashboard_tab_id": None,
        "placement": {"id": 2, "row": 1},
    }


def test_client_rejects_invalid_url_and_masks_http_error_path():
    with pytest.raises(ValueError, match="absolute http"):
        MetabaseClient("metabase.example", "key")

    client = make_client({})
    with pytest.raises(MetabaseApiError, match=r"HTTP 404 for /api/card/4"):
        client.card(4)
