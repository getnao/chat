---
name: migrate-metabase-dashboard
description: Migrate a Metabase dashboard to a nao story, preserving query semantics, useful visualization settings, dashboard filter wiring, and an explicit migration report.
---

# migrate-metabase-dashboard

Use this skill when a user wants to recreate a Metabase dashboard as a nao story. This is a one-time migration, not a live sync. Optimize first for matching numbers, then for an intelligible story; do not promise pixel-identical layout.

## Required inputs

- A Metabase dashboard ID, and credentials supplied through `METABASE_URL` and `METABASE_API_KEY`, or a configured Metabase MCP server.
- A nao project connected to the same warehouse (or an explicitly confirmed equivalent source).

Never put a Metabase API key in a story, SQL, migration report, committed file, tool result, or chat response.

## 1. Read the source before creating anything

Prefer the read-only CLI exporter when it is available:

```sh
nao metabase dashboard <dashboard-id> --output metabase-dashboard.json
```

The manifest contains dashboard tabs and filters, each dashboard-card's placement and parameter mappings, full card definitions, native SQL or raw MBQL, and visualization settings. Use `nao metabase collections`, `nao metabase dashboards`, and `nao metabase card <card-id>` to discover or inspect individual assets.

When operating through an MCP client, discover the configured Metabase server first. Read its per-tool schemas and call its collection, dashboard, and card read operations. Do not guess operation names or request fields. Save the same fields listed above in your working notes.

Do not write a nao story until every dashboard card has been classified as native SQL, GUI/MBQL, text, or unsupported.

## 2. Translate deliberately

| Metabase | nao | Rule |
| --- | --- | --- |
| Collection | Stories folder | Preserve the folder name when the destination supports folders. |
| Dashboard | Story | Use the dashboard name and description. |
| Dashboard tab | `<tab title="...">` | Use tabs only if source tabs exist; keep all story content inside `<tab>` blocks. |
| Native SQL question | Query plus `<chart>` or `<table>` | Transfer SQL only after confirming the target warehouse dialect and table names. |
| GUI/MBQL question | Re-derived SQL plus chart | Treat MBQL as an opaque source definition. Re-derive SQL against nao context; record that it was re-derived. |
| Model | Context table definition or reusable CTE | Prefer context for a reused model; never duplicate it blindly into every chart. |
| Metric | Context metric | Preserve its business definition once, rather than inlining it in every query. |
| Segment | Reusable SQL predicate | Apply it consistently and record the source segment. |
| Dashboard filter + mappings | Story filter + per-query template | Preserve every card mapping, not merely the filter label. |
| Text card | Story Markdown | Preserve text/heading content and note unsupported rich formatting. |

Map common visualization types to nao's closest native chart. If a type has no equivalent, use a table only if it preserves the analytic meaning; otherwise mark it unsupported. Drop click behavior, drill-through, subscriptions, permissions, alerts, and pixel layout from the story and report them explicitly.

## 3. Preserve filter semantics

Create one nao `<filter>` for each supported Metabase dashboard parameter. Give it a stable identifier matching `^[A-Za-z_][A-Za-z0-9_]*$`, and preserve the Metabase parameter-to-card mappings by applying it only to the corresponding queries.

For each mapped query, use nao's filter template syntax. For example:

```sql
SELECT month, sum(revenue) AS revenue
FROM orders
WHERE 1 = 1
{% filter order_date %}
  AND order_date BETWEEN {{ filters.order_date.sql }}
{% endfilter %}
GROUP BY 1
```

Then declare the story filter, for example:

```html
<filter id="order_date" label="Order date" type="date_range" />
```

Use `select`, `multi_select`, `search`, or `date_range` only when their SQL semantics match the Metabase widget. If an MB parameter cannot be represented safely, do not attach a misleading global filter; record it as unsupported.

## 4. Build through nao MCP

1. Read nao context rules and the relevant table/metric definitions.
2. Execute each translated SQL query with `execute_sql`; inspect the result columns and values.
3. Create chart blocks with `display_chart` (or table/map blocks when appropriate).
4. Build the complete story content, including Markdown, filters, charts, and tabs.
5. Call `create_story`. For later iterations, call `get_story` and then `update_story` with the complete replacement content.

Use the existing MCP story tools rather than constructing storage records directly. Do not call `display_chart` again after a story create/update merely to render charts already embedded in the story.

## 5. Verify and iterate

For every migrated card, compare the same filter state in Metabase and nao. Check row counts, totals, grouped values, null handling, time grain, timezone, and metric definitions. Fix SQL semantics before chart styling.

End with a concise migration report containing:

- source dashboard ID and created/updated nao story ID;
- cards migrated, re-derived from MBQL, converted to text/table, and unsupported;
- each source filter and its destination filter/query mappings;
- data comparisons performed and their result;
- deliberately omitted objects and any assumptions requiring review.

Never silently omit an asset. A partial migration is acceptable only when its report clearly identifies what did not transfer.
