import { describe, expect, it } from "vitest";
import { createSSRApp, h, type Component } from "vue";
import { renderToString } from "@vue/server-renderer";
import DecisionSources, { emitSourceSeek } from "../src/components/DecisionSources.vue";
import LearningCurve, {
  emitObservation,
  type LearningSeries,
  type MetricSeries,
  type ObservationEvent,
} from "../src/components/LearningCurve.vue";

const render = (component: Component, props: Record<string, unknown>) => renderToString(createSSRApp({ render: () => h(component, props) }));

const emptySeries = (): LearningSeries => ({
  consequenceRecognition: [],
  errorCorrection: [],
  doctrineCoherence: [],
  narrativeFidelity: [],
});

const point = (overrides: Partial<MetricSeries> = {}): MetricSeries => ({
  metric: "consequence-recognition",
  window: { startTick: 40, endTick: 80 },
  numerator: 2,
  denominator: 4,
  value: 0.5,
  sampleCount: 4,
  serviceRate: 0.75,
  fallbackRate: 0.25,
  unknownServiceCount: 0,
  uncertainty: { method: "WILSON_95", lower: 0.15, upper: 0.85, seedCount: 1, runCount: 1 },
  eventSourceIds: ["event-80"],
  ...overrides,
});

const props = (series: LearningSeries, overrides: Record<string, unknown> = {}) => ({
  series,
  eventMarkers: [],
  classification: "NO_EVIDENCE",
  serviceRate: 1,
  sampleCount: 4,
  unrankedReasons: [],
  ...overrides,
});

describe("learning curve views", () => {
  it("states that an empty curve has insufficient data and draws no metric line", async () => {
    const html = await render(LearningCurve, props(emptySeries(), { classification: "INSUFFICIENT_DATA", sampleCount: 0 }));

    expect(html).toContain("données insuffisantes");
    expect(html).not.toContain("class=\"metric-line\"");
  });

  it("states that low own-model service is unranked", async () => {
    const html = await render(LearningCurve, props(emptySeries(), {
      classification: "UNRANKED",
      serviceRate: 0.5,
      unrankedReasons: ["SERVICE_RATE_BELOW_THRESHOLD"],
    }));

    expect(html).toContain("non classable");
    expect(html).toContain("service propre · 50 %");
    expect(html).toContain("SERVICE_RATE_BELOW_THRESHOLD");
  });

  it("seeks to the exact tick from event markers and source buttons", async () => {
    const source: ObservationEvent = { id: "event-80", tick: 80, kind: "STARVED", detail: "Récoltes insuffisantes" };
    const curveHtml = await render(LearningCurve, props({ ...emptySeries(), consequenceRecognition: [point()] }, { eventMarkers: [source] }));
    const sourcesHtml = await render(DecisionSources, { observations: [source] });
    const selected: Array<[string, number]> = [];
    const sought: Array<[string, number]> = [];

    emitObservation((event, tick) => selected.push([event, tick]), source.tick);
    emitSourceSeek((event, tick) => sought.push([event, tick]), source.tick);

    expect(curveHtml).toContain('data-tick="80"');
    expect(sourcesHtml).toContain('data-tick="80"');
    expect(selected).toEqual([["selectObservation", 80]]);
    expect(sought).toEqual([["seek", 80]]);
  });

  it("keeps the selected series readable without colour", async () => {
    const html = await render(LearningCurve, props({ ...emptySeries(), consequenceRecognition: [point()] }));

    expect(html).toContain("Conséquences reconnues");
    expect(html).toContain("ans 40–80");
    expect(html).toContain("2 / 4");
    expect(html).toContain("50 %");
    expect(html).toContain("IC 95 % 15 % à 85 %");
    expect(html).toContain("n = 4");
    expect(html).toContain("Trait plein · série mesurée. Losange + trait pointillé · fait moteur source.");
  });
});
