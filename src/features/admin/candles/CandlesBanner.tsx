import type { CandlesBanner as CandlesBannerType } from "./types";
import { bannerClass } from "./display";

type Props = {
  banner: CandlesBannerType | null;
  loading?: boolean;
};

export function CandlesBanner({ banner, loading }: Props) {
  if (loading) {
    return <p className="mb-2 text-ocean-sand">Loading candle intake…</p>;
  }

  if (!banner) return null;

  return (
    <div className={bannerClass(banner.kind)}>
      <p className="font-semibold">{banner.title}</p>
      <p className="mt-0.5">{banner.body}</p>
    </div>
  );
}
