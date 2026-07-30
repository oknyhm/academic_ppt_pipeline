"""Generate reproducible SVG and PNG charts from validated CSV research assets."""

from __future__ import annotations

from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "data"
OUTPUT_DIR = PROJECT_ROOT / "assets" / "charts"

THEME = {
    "primary": "#003B70",
    "secondary": "#2F6FA3",
    "accent": "#56A0D3",
    "background": "#F7F9FC",
    "surface": "#FFFFFF",
    "text_primary": "#182230",
    "text_secondary": "#52606D",
    "divider": "#D7E0E8",
}


def read_validated_csv(path: Path, required_columns: list[str], numeric_columns: list[str]) -> pd.DataFrame:
    if not path.is_file():
        raise ValueError(f"Missing chart input: {path}")
    dataframe = pd.read_csv(path)
    missing_columns = [column for column in required_columns if column not in dataframe.columns]
    if missing_columns:
        raise ValueError(f"{path.name} is missing required columns: {', '.join(missing_columns)}")
    if dataframe.empty:
        raise ValueError(f"{path.name} has no data rows")
    if dataframe[required_columns].isnull().any().any():
        missing = dataframe[required_columns].isnull().sum()
        fields = ", ".join(column for column, count in missing.items() if count > 0)
        raise ValueError(f"{path.name} contains missing values in: {fields}")
    for column in numeric_columns:
        converted = pd.to_numeric(dataframe[column], errors="coerce")
        if converted.isnull().any():
            raise ValueError(f"{path.name} contains non-numeric values in: {column}")
        dataframe[column] = converted
    return dataframe


def save_figure(figure: plt.Figure, stem: str) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    svg_path = OUTPUT_DIR / f"{stem}.svg"
    png_path = OUTPUT_DIR / f"{stem}.png"
    figure.savefig(svg_path, format="svg", bbox_inches="tight", facecolor=THEME["background"], metadata={"Date": None, "Creator": "Structured Academic PPT Pipeline"})
    figure.savefig(png_path, format="png", dpi=220, bbox_inches="tight", facecolor=THEME["background"])
    print(f"Generated {svg_path.relative_to(PROJECT_ROOT)} from {DATA_DIR / f'{stem}.csv'}")
    print(f"Generated {png_path.relative_to(PROJECT_ROOT)} from {DATA_DIR / f'{stem}.csv'}")
    plt.close(figure)


def generate_method_comparison() -> None:
    dataframe = read_validated_csv(
        DATA_DIR / "method-comparison.csv",
        ["method", "architecture", "top1_accuracy", "source"],
        ["top1_accuracy"],
    ).sort_values("top1_accuracy")
    labels = dataframe["method"] + "\n" + dataframe["architecture"]
    figure, axis = plt.subplots(figsize=(7.2, 4.2), layout="constrained")
    figure.patch.set_facecolor(THEME["background"])
    axis.set_facecolor(THEME["background"])
    bars = axis.barh(labels, dataframe["top1_accuracy"], color=[THEME["secondary"], THEME["accent"], THEME["accent"], THEME["primary"]])
    axis.set_xlabel("ImageNet linear-evaluation top-1 accuracy (%)", color=THEME["text_primary"])
    axis.set_xlim(70, 82)
    axis.grid(axis="x", color=THEME["divider"], linewidth=0.8)
    axis.set_axisbelow(True)
    for bar, value in zip(bars, dataframe["top1_accuracy"], strict=True):
        axis.text(value + 0.18, bar.get_y() + bar.get_height() / 2, f"{value:.1f}", va="center", color=THEME["text_primary"], fontsize=10)
    axis.spines[["top", "right", "left"]].set_visible(False)
    axis.spines["bottom"].set_color(THEME["divider"])
    axis.tick_params(colors=THEME["text_secondary"])
    save_figure(figure, "method-comparison")


def generate_ablation() -> None:
    dataframe = read_validated_csv(
        DATA_DIR / "ablation.csv",
        ["architecture", "label_fraction", "top1_accuracy", "source"],
        ["label_fraction", "top1_accuracy"],
    )
    figure, axis = plt.subplots(figsize=(7.2, 4.2), layout="constrained")
    figure.patch.set_facecolor(THEME["background"])
    axis.set_facecolor(THEME["background"])
    palette = [THEME["secondary"], THEME["accent"], THEME["primary"]]
    for color, (architecture, group) in zip(palette, dataframe.groupby("architecture", sort=False), strict=True):
        ordered = group.sort_values("label_fraction")
        axis.plot(ordered["label_fraction"], ordered["top1_accuracy"], marker="o", linewidth=2.2, markersize=6, label=architecture, color=color)
    axis.set_xscale("log")
    axis.set_xticks([1, 10, 100], ["1%", "10%", "100%"])
    axis.set_xlabel("Fine-tuning label fraction", color=THEME["text_primary"])
    axis.set_ylabel("Top-1 accuracy (%)", color=THEME["text_primary"])
    axis.set_ylim(45, 84)
    axis.grid(color=THEME["divider"], linewidth=0.8)
    axis.set_axisbelow(True)
    axis.legend(frameon=False, labelcolor=THEME["text_primary"], loc="lower right")
    axis.spines[["top", "right"]].set_visible(False)
    axis.spines[["bottom", "left"]].set_color(THEME["divider"])
    axis.tick_params(colors=THEME["text_secondary"])
    save_figure(figure, "ablation")


def main() -> None:
    plt.rcParams["svg.hashsalt"] = "structured-academic-ppt-pipeline"
    generate_method_comparison()
    generate_ablation()


if __name__ == "__main__":
    main()
