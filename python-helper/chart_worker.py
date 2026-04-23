import json
import sys
from pathlib import Path

import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns

def main():
    if len(sys.argv) < 3:
        print(json.dumps({"ok": False, "error": "Usage: chart_worker.py <input.npy> <output.png>"}))
        sys.exit(1)

    input_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])

    options = {}
    if len(sys.argv) >= 4:
        try:
            options = json.loads(sys.argv[3])
        except json.JSONDecodeError:
            pass

    chart_type = options.get('type', 'global-average')
    arr = np.load(input_path)

    if arr.ndim != 3:
        print(json.dumps({"ok": False, "error": "Ожидается трехмерный спектральный куб"}))
        sys.exit(1)

    x = np.arange(arr.shape[2])

    sns.set_theme(style="whitegrid")
    fig, ax = plt.subplots(figsize=(10, 4), dpi=150)

    if chart_type == 'pixel':
        point = options.get('point', {})
        x_coord = int(point.get('x', 0))
        y_coord = int(point.get('y', 0))
        spectrum = arr[y_coord, x_coord, :]
        sns.lineplot(x=x, y=spectrum, ax=ax)
        ax.set_title(f"Спектр пикселя ({x_coord}, {y_coord})")

    elif chart_type == 'region-average':
        region = options.get('region', {})
        x1 = int(region.get('x1', 0))
        y1 = int(region.get('y1', 0))
        x2 = int(region.get('x2', arr.shape[1] - 1))
        y2 = int(region.get('y2', arr.shape[0] - 1))
        x1, x2 = sorted((max(0, x1), min(arr.shape[1] - 1, x2)))
        y1, y2 = sorted((max(0, y1), min(arr.shape[0] - 1, y2)))
        region_arr = arr[y1 : y2 + 1, x1 : x2 + 1, :]
        spectrum = region_arr.mean(axis=(0, 1))
        sns.lineplot(x=x, y=spectrum, ax=ax)
        ax.set_title(f"Средний спектр области ({x1}, {y1})-({x2}, {y2})")

    elif chart_type == 'overlay':
        points = options.get('points', [])
        spectra = []
        labels = []
        for idx, point in enumerate(points):
            x_coord = int(point.get('x', 0))
            y_coord = int(point.get('y', 0))
            spectrum = arr[y_coord, x_coord, :]
            spectra.append(spectrum)
            labels.append(f"Пиксель {idx + 1} ({x_coord}, {y_coord})")
            sns.lineplot(x=x, y=spectrum, ax=ax, label=labels[-1])
        if spectra:
            mean_spectrum = np.mean(np.stack(spectra, axis=0), axis=0)
            sns.lineplot(x=x, y=mean_spectrum, ax=ax, label='Усредненный', linewidth=2.5, color='black')
        ax.set_title('Наложение спектров')
        ax.legend()

    elif chart_type == 'multi-selection':
        points = options.get('points', [])
        regions = options.get('regions', [])
        show_average = options.get('showAverage', True)
        
        all_spectra = []
        all_labels = []
        
        # Plot individual points
        colors = plt.cm.tab10.colors
        for idx, point in enumerate(points):
            x_coord = int(point.get('x', 0))
            y_coord = int(point.get('y', 0))
            spectrum = arr[y_coord, x_coord, :]
            all_spectra.append(spectrum)
            color = colors[idx % len(colors)]
            label = f"Точка {idx + 1} ({x_coord}, {y_coord})"
            all_labels.append(label)
            sns.lineplot(x=x, y=spectrum, ax=ax, label=label, color=color, alpha=0.7)
        
        # Plot region averages
        for idx, region in enumerate(regions):
            x1 = int(region.get('x1', 0))
            y1 = int(region.get('y1', 0))
            x2 = int(region.get('x2', arr.shape[1] - 1))
            y2 = int(region.get('y2', arr.shape[0] - 1))
            x1, x2 = sorted((max(0, x1), min(arr.shape[1] - 1, x2)))
            y1, y2 = sorted((max(0, y1), min(arr.shape[0] - 1, y2)))
            region_arr = arr[y1:y2 + 1, x1:x2 + 1, :]
            spectrum = region_arr.mean(axis=(0, 1))
            all_spectra.append(spectrum)
            color = colors[(len(points) + idx) % len(colors)]
            label = f"Область {idx + 1} ({x1},{y1})-({x2},{y2})"
            all_labels.append(label)
            sns.lineplot(x=x, y=spectrum, ax=ax, label=label, color=color, alpha=0.7)
        
        # Plot average line if enabled
        if show_average and all_spectra:
            mean_spectrum = np.mean(np.stack(all_spectra, axis=0), axis=0)
            sns.lineplot(x=x, y=mean_spectrum, ax=ax, label='Усредненный', linewidth=3, color='black')
        
        ax.set_title('Спектры выбранных точек и областей')
        ax.legend()

    else:
        spectrum = arr.mean(axis=(0, 1))
        sns.lineplot(x=x, y=spectrum, ax=ax)
        ax.set_title('Средний спектр по кубу')

    ax.set_xlabel('Канал')
    ax.set_ylabel('Интенсивность')
    fig.tight_layout()

    output_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(output_path)
    plt.close(fig)

    print(json.dumps({
        "ok": True,
        "outputPath": str(output_path)
    }))

if __name__ == "__main__":
    main()