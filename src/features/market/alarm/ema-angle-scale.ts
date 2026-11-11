/**
 * Visual angle. TradingView Auto (reset) scale: the visible high and low fill
 * the pane, with 20% empty on top and 10% on the bottom. One candle is 45°
 * when its rise is as tall, in pixels, as the candle is wide.
 */

export const RESET_MARGIN_TOP = 0.2;
export const RESET_MARGIN_BOTTOM = 0.1;

export function resetPriceWindow(dataMin: number, dataMax: number): { yMin: number; yMax: number } {
  const span = Math.max(dataMax - dataMin, 0.05);
  const inner = 1 - RESET_MARGIN_TOP - RESET_MARGIN_BOTTOM;
  const total = span / inner;
  return {
    yMin: dataMin - RESET_MARGIN_BOTTOM * total,
    yMax: dataMax + RESET_MARGIN_TOP * total,
  };
}

/** Dollars in one bar that draw at 45° on a reset pane. `aspect` is width / height. */
export function resetDollarsPerBar(
  dataMin: number,
  dataMax: number,
  aspect: number,
  barCount: number,
): number | null {
  if (!(aspect > 0) || !(barCount > 0)) return null;
  const { yMin, yMax } = resetPriceWindow(dataMin, dataMax);
  return ((yMax - yMin) * aspect) / barCount;
}

/** Degrees of a dollars-per-bar slope on the reset scale. */
export function angleOnResetScale(
  dollarsPerBar: number,
  dataMin: number,
  dataMax: number,
  aspect: number,
  barCount: number,
): number | null {
  const unit = resetDollarsPerBar(dataMin, dataMax, aspect, barCount);
  if (unit == null || !(unit > 0) || !Number.isFinite(dollarsPerBar)) return null;
  return (Math.atan(dollarsPerBar / unit) * 180) / Math.PI;
}
