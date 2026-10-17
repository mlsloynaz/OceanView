import { describe, expect, it } from "vitest";
import {
  docKind,
  docNavLabel,
  documentPath,
  extractTitle,
  picsForSlug,
  rewriteAssetUrls,
  strategyDocShortSlug,
} from "./catalog";

describe("strategy documents catalog", () => {
  it("uses a short slug for numbered strategies", () => {
    expect(strategyDocShortSlug("estrategia-01-cambio-tendencia-hora-al-alza.md")).toBe("estrategia-01");
    expect(strategyDocShortSlug("elementos-analisis-bollinger-bands.md")).toBe(
      "elementos-analisis-bollinger-bands",
    );
  });

  it("classifies the notes in the strategies folder", () => {
    expect(docKind("estrategias-indice.md")).toBe("index");
    expect(docKind("elementos-analisis-misc.md")).toBe("element");
    expect(docKind("estrategia-03-efecto-iman-alza-y-baja.md")).toBe("strategy");
    expect(docKind("strategyall.md")).toBe("reference");
  });

  it("reads the first heading as the title", () => {
    expect(extractTitle("# Estrategia 01 — Cambio\n\nbody", "fallback")).toBe("Estrategia 01 — Cambio");
    expect(extractTitle("no heading", "fallback")).toBe("fallback");
  });

  it("labels the nav the way the folder is browsed", () => {
    expect(
      docNavLabel({
        slug: "estrategia-04",
        filename: "estrategia-04-tendencia-lateral.md",
        title: "Estrategia 04",
        kind: "strategy",
      }),
    ).toBe("4");
    expect(documentPath("estrategia-01")).toBe("/documents/estrategia-01");
  });

  it("points local images at the strategy-docs raw path", () => {
    expect(rewriteAssetUrls("![chart](./pics/01-alza-1h-cambioT.png)")).toBe(
      "![chart](/strategy-docs/raw/pics/01-alza-1h-cambioT.png)",
    );
    expect(rewriteAssetUrls("![remote](https://example.com/a.png)")).toBe(
      "![remote](https://example.com/a.png)",
    );
  });

  it("attaches pictures that share the strategy number", () => {
    const pics = picsForSlug("estrategia-01", [
      "01-alza-1h-cambioT.png",
      "01-alza-15m-cambioT.png",
      "02-alza-D-rebote.png",
    ]);
    expect(pics.map((pic) => pic.filename)).toEqual([
      "01-alza-1h-cambioT.png",
      "01-alza-15m-cambioT.png",
    ]);
    expect(pics[0]?.timeframe).toBe("Hora");
    expect(pics[1]?.timeframe).toBe("15 min");
  });
});
