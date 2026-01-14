import sys
from abc import ABC, abstractmethod
from pathlib import Path

from ibis import BaseBackend
from rich.console import Console
from rich.progress import BarColumn, Progress, SpinnerColumn, TaskProgressColumn, TextColumn

from nao_core.config import AccessorType, NaoConfig

console = Console()


# =============================================================================
# Data Accessors
# =============================================================================


class DataAccessor(ABC):
    """Base class for data accessors that generate markdown files for tables."""

    @property
    @abstractmethod
    def filename(self) -> str:
        """The filename this accessor writes to (e.g., 'columns.md')."""
        ...

    @abstractmethod
    def generate(self, conn: BaseBackend, dataset: str, table: str) -> str:
        """Generate the markdown content for a table.

        Args:
            conn: The Ibis database connection
            dataset: The dataset/schema name
            table: The table name

        Returns:
            Markdown string content
        """
        ...

    def get_table(self, conn: BaseBackend, dataset: str, table: str):
        """Helper to get an Ibis table reference."""
        full_table_name = f"{dataset}.{table}"
        return conn.table(full_table_name)


class ColumnsAccessor(DataAccessor):
    """Generates columns.md with column names, types, and nullable info."""

    @property
    def filename(self) -> str:
        return "columns.md"

    def generate(self, conn: BaseBackend, dataset: str, table: str) -> str:
        try:
            t = self.get_table(conn, dataset, table)
            schema = t.schema()

            lines = [
                f"# {table}",
                "",
                f"**Dataset:** `{dataset}`",
                "",
                "## Columns",
                "",
                "| Column | Type | Nullable | Description |",
                "|--------|------|----------|-------------|",
            ]

            for name, dtype in schema.items():
                nullable = "Yes" if dtype.nullable else "No"
                description = ""
                lines.append(f"| `{name}` | `{dtype}` | {nullable} | {description} |")

            return "\n".join(lines)
        except Exception as e:
            return f"# {table}\n\nError fetching schema: {e}"


class PreviewAccessor(DataAccessor):
    """Generates preview.md with the first N rows of data."""

    def __init__(self, num_rows: int = 10):
        self.num_rows = num_rows

    @property
    def filename(self) -> str:
        return "preview.md"

    def generate(self, conn: BaseBackend, dataset: str, table: str) -> str:
        try:
            t = self.get_table(conn, dataset, table)
            schema = t.schema()

            preview_df = t.limit(self.num_rows).execute()

            lines = [
                f"# {table} - Preview",
                "",
                f"**Dataset:** `{dataset}`",
                f"**Showing:** First {len(preview_df)} rows",
                "",
                "## Data Preview",
                "",
            ]

            columns = list(schema.keys())
            header = "| " + " | ".join(f"`{col}`" for col in columns) + " |"
            separator = "| " + " | ".join("---" for _ in columns) + " |"
            lines.append(header)
            lines.append(separator)

            for _, row in preview_df.iterrows():
                row_values = []
                for col in columns:
                    val = row[col]
                    val_str = str(val) if val is not None else ""
                    if len(val_str) > 50:
                        val_str = val_str[:47] + "..."
                    val_str = val_str.replace("|", "\\|").replace("\n", " ")
                    row_values.append(val_str)
                lines.append("| " + " | ".join(row_values) + " |")

            return "\n".join(lines)
        except Exception as e:
            return f"# {table} - Preview\n\nError fetching preview: {e}"


class DescriptionAccessor(DataAccessor):
    """Generates description.md with table metadata (row count, column count, etc.)."""

    @property
    def filename(self) -> str:
        return "description.md"

    def generate(self, conn: BaseBackend, dataset: str, table: str) -> str:
        try:
            t = self.get_table(conn, dataset, table)
            schema = t.schema()

            row_count = t.count().execute()
            col_count = len(schema)

            lines = [
                f"# {table}",
                "",
                f"**Dataset:** `{dataset}`",
                "",
                "## Table Metadata",
                "",
                "| Property | Value |",
                "|----------|-------|",
                f"| **Row Count** | {row_count:,} |",
                f"| **Column Count** | {col_count} |",
                "",
                "## Description",
                "",
                "_No description available._",
                "",
            ]

            return "\n".join(lines)
        except Exception as e:
            return f"# {table}\n\nError fetching description: {e}"


class ProfilingAccessor(DataAccessor):
    """Generates profiling.md with column statistics and data profiling."""

    @property
    def filename(self) -> str:
        return "profiling.md"

    def generate(self, conn: BaseBackend, dataset: str, table: str) -> str:
        try:
            t = self.get_table(conn, dataset, table)
            schema = t.schema()

            lines = [
                f"# {table} - Profiling",
                "",
                f"**Dataset:** `{dataset}`",
                "",
                "## Column Statistics",
                "",
                "| Column | Type | Nulls | Unique | Min | Max |",
                "|--------|------|-------|--------|-----|-----|",
            ]

            for name, dtype in schema.items():
                col = t[name]
                dtype_str = str(dtype)

                try:
                    null_count = t.filter(col.isnull()).count().execute()
                    unique_count = col.nunique().execute()

                    min_val = ""
                    max_val = ""
                    if dtype.is_numeric() or dtype.is_temporal():
                        try:
                            min_val = str(col.min().execute())
                            max_val = str(col.max().execute())
                            if len(min_val) > 20:
                                min_val = min_val[:17] + "..."
                            if len(max_val) > 20:
                                max_val = max_val[:17] + "..."
                        except Exception:
                            pass

                    lines.append(
                        f"| `{name}` | `{dtype_str}` | {null_count:,} | {unique_count:,} | {min_val} | {max_val} |"
                    )
                except Exception as col_error:
                    lines.append(f"| `{name}` | `{dtype_str}` | Error: {col_error} | | | |")

            return "\n".join(lines)
        except Exception as e:
            return f"# {table} - Profiling\n\nError fetching profiling: {e}"


# =============================================================================
# Accessor Registry
# =============================================================================

ACCESSOR_REGISTRY: dict[AccessorType, DataAccessor] = {
    AccessorType.COLUMNS: ColumnsAccessor(),
    AccessorType.PREVIEW: PreviewAccessor(num_rows=10),
    AccessorType.DESCRIPTION: DescriptionAccessor(),
    AccessorType.PROFILING: ProfilingAccessor(),
}


def get_accessors(accessor_types: list[AccessorType]) -> list[DataAccessor]:
    """Get accessor instances for the given types."""
    return [ACCESSOR_REGISTRY[t] for t in accessor_types if t in ACCESSOR_REGISTRY]


# =============================================================================
# Sync Functions
# =============================================================================


def sync_bigquery(
    db_config,
    base_path: Path,
    progress: Progress,
    accessors: list[DataAccessor],
) -> tuple[int, int]:
    """Sync BigQuery database schema to markdown files.

    Args:
        db_config: The database configuration
        base_path: Base output path
        progress: Rich progress instance
        accessors: List of data accessors to run

    Returns:
            Tuple of (datasets_synced, tables_synced)
    """
    conn = db_config.connect()
    db_path = base_path / "bigquery" / db_config.name

    datasets_synced = 0
    tables_synced = 0

    if db_config.dataset_id:
        datasets = [db_config.dataset_id]
    else:
        datasets = conn.list_databases()

    dataset_task = progress.add_task(
        f"[dim]{db_config.name}[/dim]",
        total=len(datasets),
    )

    for dataset in datasets:
        try:
            all_tables = conn.list_tables(database=dataset)
        except Exception:
            progress.update(dataset_task, advance=1)
            continue

        # Filter tables based on include/exclude patterns
        tables = [t for t in all_tables if db_config.matches_pattern(dataset, t)]

        # Skip dataset if no tables match
        if not tables:
            progress.update(dataset_task, advance=1)
            continue

        dataset_path = db_path / dataset
        dataset_path.mkdir(parents=True, exist_ok=True)
        datasets_synced += 1

        table_task = progress.add_task(
            f"  [cyan]{dataset}[/cyan]",
            total=len(tables),
        )

        for table in tables:
            table_path = dataset_path / table
            table_path.mkdir(parents=True, exist_ok=True)

            for accessor in accessors:
                content = accessor.generate(conn, dataset, table)
                output_file = table_path / accessor.filename
                output_file.write_text(content)

            tables_synced += 1
            progress.update(table_task, advance=1)

        progress.update(dataset_task, advance=1)

    return datasets_synced, tables_synced


def sync(output_dir: str = "databases"):
    """Sync database schemas to local markdown files.

    Creates a folder structure with table metadata:
      databases/bigquery/<connection>/<dataset>/<table>/columns.md
      databases/bigquery/<connection>/<dataset>/<table>/preview.md
      databases/bigquery/<connection>/<dataset>/<table>/description.md
      databases/bigquery/<connection>/<dataset>/<table>/profiling.md

    Args:
        output_dir: Output directory for the database schemas (default: "databases")
    """
    console.print("\n[bold cyan]🔄 nao sync[/bold cyan]\n")

    config = NaoConfig.try_load()
    if not config:
        console.print("[bold red]✗[/bold red] No nao_config.yaml found in current directory")
        console.print("[dim]Run 'nao init' to create a configuration file[/dim]")
        sys.exit(1)

    console.print(f"[dim]Project:[/dim] {config.project_name}")

    if not config.databases:
        console.print("[dim]No databases configured[/dim]")
        return

    base_path = Path(output_dir)
    total_datasets = 0
    total_tables = 0

    console.print()

    with Progress(
        SpinnerColumn(style="dim"),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(bar_width=30, style="dim", complete_style="cyan", finished_style="green"),
        TaskProgressColumn(),
        console=console,
        transient=False,
    ) as progress:
        for db in config.databases:
            # Get accessors from database config
            db_accessors = get_accessors(db.accessors)
            accessor_names = [a.filename.replace(".md", "") for a in db_accessors]

            try:
                if db.type == "bigquery":
                    console.print(f"[dim]{db.name} accessors:[/dim] {', '.join(accessor_names)}")
                    datasets, tables = sync_bigquery(db, base_path, progress, db_accessors)
                    total_datasets += datasets
                    total_tables += tables
                else:
                    console.print(f"[yellow]⚠ Unsupported database type: {db.type}[/yellow]")
            except Exception as e:
                console.print(f"[bold red]✗[/bold red] Failed to sync {db.name}: {e}")

    console.print()
    console.print(
        f"[green]✓[/green] Synced [bold]{total_tables}[/bold] tables across [bold]{total_datasets}[/bold] datasets"
    )
    console.print(f"[dim]  → {base_path.absolute()}[/dim]")
    console.print()
