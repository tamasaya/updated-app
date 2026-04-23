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

    arr = np.load(input_path)

    # пример: средний спектр по пространству
    if arr.ndim == 3:
        # H x W x C
        spectrum = arr.mean(axis=(0, 1))
        x = np.arange(len(spectrum))
    elif arr.ndim == 1:
        spectrum = arr
        x = np.arange(len(spectrum))
    else:
        spectrum = arr.reshape(-1)
        x = np.arange(len(spectrum))

    sns.set_theme(style="whitegrid")
    fig, ax = plt.subplots(figsize=(10, 4), dpi=150)
    sns.lineplot(x=x, y=spectrum, ax=ax)
    ax.set_title("Средний спектр")
    ax.set_xlabel("Канал")
    ax.set_ylabel("Интенсивность")
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