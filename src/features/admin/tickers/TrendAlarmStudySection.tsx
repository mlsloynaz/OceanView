import type { AlarmFollow, TrendProfileResponse, TrendProfileRow } from "./types";

function fmtPct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toFixed(1)}%`;
}

function fmtEntries(row: AlarmFollow | null | undefined): string {
  if (row == null || row.count == null) return "—";
  return `${row.count} entries`;
}

function fmtSep(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value < 1 ? `${Math.round(value * 100)}¢` : `$${value.toFixed(2)}`;
}

function Cell({ row }: { row: AlarmFollow | null | undefined }) {
  return (
    <td className="px-3 py-2">
      <div className="tabular-nums">{fmtPct(row?.pct)}</div>
      <div className="text-[10px] text-ocean-sand">{fmtEntries(row)}</div>
    </td>
  );
}

function OptionHead({ name }: { name: string }) {
  return (
    <th className="px-3 py-2 font-medium">
      <div>{name}</div>
      <div className="mt-0.5 font-normal">% follow $1</div>
      <div className="font-normal">qty entries</div>
    </th>
  );
}

function TickerRow({ row }: { row: TrendProfileRow }) {
  const study = row.alarmStudy;
  const optionB = study?.optionB;
  const optionC = study?.optionC;
  return (
    <tr className="border-t border-ocean-mid/20 align-top">
      <td className="px-3 py-2 font-semibold">
        {row.symbol}
        <div className="text-[10px] font-normal text-ocean-sand">
          Option B ≥ {optionB?.ang ?? "—"}° and {fmtSep(optionB?.sep)}
        </div>
        <div className="text-[10px] font-normal text-ocean-sand">
          Option C ≥ {optionC?.ang ?? "—"}° and {fmtSep(optionC?.sep)}
        </div>
      </td>
      <Cell row={study?.optionA} />
      <Cell row={optionB} />
      <Cell row={optionC} />
      <Cell row={study?.optionD} />
    </tr>
  );
}

type Props = {
  data: TrendProfileResponse | null;
  loading: boolean;
};

export function TrendAlarmStudySection({ data, loading }: Props) {
  const ranked = data?.ranked ?? [];
  return (
    <div className="space-y-4">
      <div className="max-w-3xl">
        <h3 className="text-sm font-semibold text-ocean-foam">Trend-alarm study</h3>
        <p className="mt-1 text-xs leading-relaxed text-ocean-sand">
          Option A is the current 5-minute alarm. Option B is a 1-minute EMA cross whose angle is
          at least the saved angle and whose separation is at least the saved 1-minute separation
          for that ticker. Option C opens on a 5-minute EMA cross, or when price touches EMA 10 or
          EMA 21 while EMA 10 is already on the trade side of EMA 21. Its angle and separation come
          from that ticker's saved 5-minute profile. Option D keeps an Option B cross only when
          that minute sits inside a 5-minute bar that also meets Option C. The percentage is how
          often price then moved $1 with the entry within 30 minutes. The live alarm is unchanged.
        </p>
      </div>
      {data?.message ? <p className="text-xs text-ocean-sand/90">{data.message}</p> : null}
      <div className="overflow-x-auto rounded-md border border-ocean-mid/30">
        <table className="min-w-[640px] w-full text-left text-xs text-ocean-foam">
          <thead className="bg-ocean-mid/20 text-ocean-sand">
            <tr>
              <th className="px-3 py-2 font-medium">Ticker</th>
              <OptionHead name="Option A" />
              <OptionHead name="Option B" />
              <OptionHead name="Option C" />
              <OptionHead name="Option D" />
            </tr>
          </thead>
          <tbody>
            {ranked.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-ocean-sand">
                  {loading ? "Loading…" : "No alarm study yet. Calculate from Alpaca on the 5m trend change tab."}
                </td>
              </tr>
            ) : (
              ranked.map((row) => <TickerRow key={row.symbol} row={row} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
