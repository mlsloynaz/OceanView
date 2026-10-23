export const THUMB_RATIO = 16 / 10;
export const THUMB_GAP_PX = 8;

/** Column count that makes each 16:10 thumbnail as large as possible inside the pane. */
export function fitThumbnailGrid(
  count: number,
  width: number,
  height: number,
  gap = THUMB_GAP_PX,
  ratio = THUMB_RATIO,
): { columns: number; rows: number } {
  if (count <= 0 || width <= 0 || height <= 0) return { columns: 1, rows: Math.max(count, 1) };
  let bestColumns = 1;
  let bestArea = -1;
  for (let columns = 1; columns <= count; columns++) {
    const rows = Math.ceil(count / columns);
    const cellWidth = (width - gap * (columns - 1)) / columns;
    const cellHeight = (height - gap * (rows - 1)) / rows;
    if (cellWidth <= 0 || cellHeight <= 0) continue;
    const thumbWidth = Math.min(cellWidth, cellHeight * ratio);
    const area = thumbWidth * (thumbWidth / ratio);
    if (area > bestArea) {
      bestArea = area;
      bestColumns = columns;
    }
  }
  return { columns: bestColumns, rows: Math.ceil(count / bestColumns) };
}
