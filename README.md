# LibriHub SAD LaTeX

File chính: `main.tex`

Ba hình hiện có được tham chiếu từ:

- `../figures/context_diagram.png`
- `../figures/level_0_diagram.png`
- `../figures/erd.png`

Phần EER đang để placeholder trong mục `Thiết kế dữ liệu > EER`. Khi có hình EER, thay khung `fbox` trong mục này bằng:

```tex
\includegraphics[width=0.95\textwidth]{../figures/<ten_file_eer>.png}
```

Lệnh biên dịch đề xuất:

```powershell
pdflatex -interaction=nonstopmode main.tex
pdflatex -interaction=nonstopmode main.tex
```
