import json
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")

import matplotlib.pyplot as plt
from matplotlib.lines import Line2D
import numpy as np
import pandas as pd
import seaborn as sns


def fail(message: str):
    print(json.dumps({"ok": False, "error": message}, ensure_ascii=False))
    sys.exit(1)


def clip_int(value: int, min_value: int, max_value: int) -> int:
    return max(min_value, min(max_value, int(value)))


def normalize_region(region: dict, width: int, height: int):
    x1 = clip_int(region.get("x1", 0), 0, width - 1)
    y1 = clip_int(region.get("y1", 0), 0, height - 1)
    x2 = clip_int(region.get("x2", width - 1), 0, width - 1)
    y2 = clip_int(region.get("y2", height - 1), 0, height - 1)

    if x1 > x2:
        x1, x2 = x2, x1
    if y1 > y2:
        y1, y2 = y2, y1

    return x1, y1, x2, y2


def sample_region_coords(x1: int, y1: int, x2: int, y2: int, max_samples: int):
    width = x2 - x1 + 1
    height = y2 - y1 + 1
    total = width * height

    if total <= max_samples:
        return [(x, y) for y in range(y1, y2 + 1) for x in range(x1, x2 + 1)]

    grid_side = int(np.ceil(np.sqrt(max_samples)))
    xs = np.unique(np.linspace(x1, x2, num=min(grid_side, width), dtype=int))
    ys = np.unique(np.linspace(y1, y2, num=min(grid_side, height), dtype=int))

    coords = [(int(x), int(y)) for y in ys for x in xs]
    return coords[:max_samples]


def build_x_axis(channels: int, options: dict):
    wavelength_start = options.get("wavelengthStartNm")
    wavelength_end = options.get("wavelengthEndNm")

    if wavelength_start is not None and wavelength_end is not None and wavelength_end > wavelength_start:
        return np.linspace(float(wavelength_start), float(wavelength_end), channels), "Длина волны, нм"

    return np.arange(channels), "Канал"


def add_spectrum_records(records, x_axis, spectrum, selection_label, selection_type, series_id):
    for x_value, intensity in zip(x_axis, spectrum):
        records.append(
            {
                "x": float(x_value),
                "intensity": float(intensity),
                "selection": selection_label,
                "selection_type": selection_type,
                "series": series_id,
            }
        )


def build_selection_dataframe(arr: np.ndarray, options: dict):
    if arr.ndim != 3:
        fail("Ожидается трехмерный спектральный куб H×W×C")

    height, width, channels = arr.shape
    points = options.get("points", []) or []
    regions = options.get("regions", []) or []
    max_region_lines = int(options.get("maxRegionLines", 64))

    x_axis, x_label = build_x_axis(channels, options)

    records = []
    selection_order = []

    for index, point in enumerate(points, start=1):
        x = clip_int(point.get("x", 0), 0, width - 1)
        y = clip_int(point.get("y", 0), 0, height - 1)
        selection_label = f"Точка {index} ({x}, {y})"
        spectrum = arr[y, x, :]
        add_spectrum_records(
            records=records,
            x_axis=x_axis,
            spectrum=spectrum,
            selection_label=selection_label,
            selection_type="point",
            series_id=f"point-{index}",
        )
        selection_order.append(selection_label)

    for index, region in enumerate(regions, start=1):
        x1, y1, x2, y2 = normalize_region(region, width, height)
        selection_label = f"Область {index} ({x1},{y1})–({x2},{y2})"
        coords = sample_region_coords(x1, y1, x2, y2, max_region_lines)

        for sample_index, (x, y) in enumerate(coords, start=1):
            spectrum = arr[y, x, :]
            add_spectrum_records(
                records=records,
                x_axis=x_axis,
                spectrum=spectrum,
                selection_label=selection_label,
                selection_type="region",
                series_id=f"region-{index}-sample-{sample_index}",
            )

        selection_order.append(selection_label)

    if not records:
        return None, x_label, selection_order

    df = pd.DataFrame.from_records(records)
    return df, x_label, selection_order


def build_global_average_dataframe(arr: np.ndarray, options: dict):
    if arr.ndim != 3:
        fail("Ожидается трехмерный спектральный куб H×W×C")

    _, _, channels = arr.shape
    x_axis, x_label = build_x_axis(channels, options)

    mean_spectrum = arr.mean(axis=(0, 1))

    df = pd.DataFrame(
        {
            "x": x_axis.astype(float),
            "intensity": mean_spectrum.astype(float),
        }
    )

    return df, x_label


def apply_theme():
    sns.set_theme(
        context="notebook",
        style="darkgrid",
        palette="crest",
        font_scale=1.0,
        rc={
            "figure.facecolor": "#0b1020",
            "axes.facecolor": "#111827",
            "axes.edgecolor": "#334155",
            "grid.color": "#334155",
            "grid.alpha": 0.45,
            "axes.labelcolor": "#e5e7eb",
            "xtick.color": "#cbd5e1",
            "ytick.color": "#cbd5e1",
            "text.color": "#f8fafc",
        },
    )


def plot_global_average(df: pd.DataFrame, output_path: Path, x_label: str):
    apply_theme()

    fig, ax = plt.subplots(figsize=(11.8, 5.6), dpi=180)

    sns.lineplot(
        data=df,
        x="x",
        y="intensity",
        color="#67e8f9",
        linewidth=3.6,
        ax=ax,
    )

    ax.set_title("Средний спектр по всему кубу", fontsize=14, fontweight="bold", pad=14)
    ax.set_xlabel(x_label)
    ax.set_ylabel("Интенсивность")
    ax.margins(x=0.01)

    sns.despine(ax=ax, top=True, right=True)
    fig.tight_layout()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(output_path, bbox_inches="tight")
    plt.close(fig)


def plot_selection(df: pd.DataFrame, output_path: Path, options: dict, x_label: str, selection_order: list[str]):
    show_average = bool(options.get("showAverage", True))

    apply_theme()

    fig, ax = plt.subplots(figsize=(11.8, 6.2), dpi=180)

    palette = sns.color_palette("crest", n_colors=max(3, len(selection_order)))
    color_by_selection = {
        selection: palette[index % len(palette)]
        for index, selection in enumerate(selection_order)
    }

    legend_handles = []

    for selection in selection_order:
        group_df = df[df["selection"] == selection]
        if group_df.empty:
            continue

        selection_type = str(group_df["selection_type"].iloc[0])
        color = color_by_selection[selection]

        sns.lineplot(
            data=group_df,
            x="x",
            y="intensity",
            units="series",
            estimator=None,
            hue="selection",
            palette={selection: color},
            linewidth=2.2 if selection_type == "point" else 1.0,
            alpha=0.95 if selection_type == "point" else 0.20,
            legend=False,
            ax=ax,
        )

        legend_handles.append(
            Line2D([0], [0], color=color, lw=2.8, label=selection)
        )

    if show_average:
        mean_df = (
            df.groupby("x", as_index=False)["intensity"]
            .mean()
            .sort_values("x")
        )

        sns.lineplot(
            data=mean_df,
            x="x",
            y="intensity",
            color="#f8fafc",
            linewidth=4.0,
            linestyle="-",
            legend=False,
            ax=ax,
        )

        legend_handles.append(
            Line2D([0], [0], color="#f8fafc", lw=4.0, label="Среднее по выборке")
        )

    if (df["selection_type"] == "point").any() and (df["selection_type"] == "region").any():
        title = "Спектры точек и областей"
    elif (df["selection_type"] == "point").any():
        title = "Спектры выбранных точек"
    else:
        title = "Спектры выбранных областей"

    ax.set_title(title, fontsize=14, fontweight="bold", pad=14)
    ax.set_xlabel(x_label)
    ax.set_ylabel("Интенсивность")
    ax.margins(x=0.01)

    if legend_handles:
        ax.legend(
            handles=legend_handles,
            loc="upper left",
            bbox_to_anchor=(1.02, 1.0),
            frameon=False,
            title="Выборки",
            borderaxespad=0,
        )

    sns.despine(ax=ax, top=True, right=True)
    fig.tight_layout()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(output_path, bbox_inches="tight")
    plt.close(fig)


def main():
    if len(sys.argv) < 3:
        fail("Usage: chart_worker.py <input.npy> <output.png> [options_json]")

    input_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])

    options = {}
    if len(sys.argv) >= 4:
        try:
            options = json.loads(sys.argv[3])
        except json.JSONDecodeError:
            fail("Некорректный JSON в options")

    if not input_path.exists():
        fail(f"Файл не найден: {input_path}")

    arr = np.load(input_path)
    chart_type = options.get("type", "selection")

    if chart_type == "global-average":
        df, x_label = build_global_average_dataframe(arr, options)
        plot_global_average(df, output_path, x_label)
    else:
        df, x_label, selection_order = build_selection_dataframe(arr, options)

        if df is None or df.empty:
            fail("Нет выбранных точек или областей для построения графика")

        plot_selection(df, output_path, options, x_label, selection_order)

    print(
        json.dumps(
            {
                "ok": True,
                "outputPath": str(output_path),
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()