import { describe, expect, it } from "vitest";
import { createRenderer, createSSRApp, h, nextTick, type Component } from "vue";
import { renderToString } from "@vue/server-renderer";
import CivilisationProfile from "../src/components/CivilisationProfile.vue";
import LearningCurve, {
  type PublishedLearningCurve,
  type LearningSeries,
  type MetricSeries,
  type ObservationEvent,
} from "../src/components/LearningCurve.vue";

const render = (component: Component, props: Record<string, unknown>) => renderToString(createSSRApp({ render: () => h(component, props) }));

interface HostNode {
  type: string;
  props: Record<string, unknown>;
  children: HostNode[];
  parent: HostNode | null;
  text?: string;
}

const hostNode = (type: string, text?: string): HostNode => ({ type, props: {}, children: [], parent: null, text });
const renderer = createRenderer<HostNode, HostNode>({
  patchProp(element, key, _previous, next) {
    if (next === null || next === undefined) delete element.props[key];
    else element.props[key] = next;
  },
  insert(child, parent, anchor) {
    child.parent = parent;
    const at = anchor ? parent.children.indexOf(anchor) : -1;
    if (at >= 0) parent.children.splice(at, 0, child);
    else parent.children.push(child);
  },
  remove(child) {
    const at = child.parent?.children.indexOf(child) ?? -1;
    if (at >= 0) child.parent!.children.splice(at, 1);
  },
  createElement: (type) => hostNode(type),
  createText: (text) => hostNode("#text", text),
  createComment: (text) => hostNode("#comment", text),
  setText(node, text) { node.text = text; },
  setElementText(node, text) { node.text = text; },
  parentNode: (node) => node.parent,
  nextSibling(node) {
    if (!node.parent) return null;
    return node.parent.children[node.parent.children.indexOf(node) + 1] ?? null;
  },
  setScopeId(element, id) { element.props[id] = ""; },
  insertStaticContent(content, parent, anchor) {
    const node = hostNode("#static", content);
    node.parent = parent;
    const at = anchor ? parent.children.indexOf(anchor) : -1;
    if (at >= 0) parent.children.splice(at, 0, node);
    else parent.children.push(node);
    return [node, node];
  },
});

async function mount(component: Component, props: Record<string, unknown>) {
  const root = hostNode("#root");
  const app = renderer.createApp({ render: () => h(component, props) });
  app.mount(root);
  await nextTick();
  return root;
}

function nodes(root: HostNode): HostNode[] {
  return [root, ...root.children.flatMap(nodes)];
}

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
    expect(html).not.toContain("<svg");
  });

  it("keeps null windows as evidence but draws no chart", async () => {
    const html = await render(LearningCurve, props({
      ...emptySeries(),
      consequenceRecognition: [point({ value: null, numerator: 0, denominator: 0 })],
    }));

    expect(html).toContain("données insuffisantes");
    expect(html).toContain("non mesurable");
    expect(html).toContain("Aucune ligne n&#39;est tracée sans observation mesurée.");
    expect(html).not.toContain("<svg");
    expect(html).not.toContain("class=\"axis\"");
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

  it("seeks through real marker, keyboard, source, and parent handlers", async () => {
    const source: ObservationEvent = { id: "event-80", tick: 80, kind: "STARVED", detail: "Récoltes insuffisantes" };
    const curve: PublishedLearningCurve = {
      modelId: "model-a",
      runIds: ["run-a"],
      seeds: [1],
      pairedRunKey: "pair-a",
      options: {},
      sampleCount: 4,
      serviceRate: 1,
      fallbackRate: 0,
      unknownServiceCount: 0,
      eventSources: [source],
      series: { ...emptySeries(), consequenceRecognition: [point()] },
      unrankedReasons: [],
      classification: "NO_EVIDENCE",
    };
    const sought: number[] = [];
    const root = await mount(CivilisationProfile, {
      identity: { displayName: "A", origin: "Origine", values: [] },
      doctrine: { creed: "Tenir", posture: "GUARD", claim: "plain", farming: 1, forestry: 0, mining: 0, trade: 0, military: 0 },
      history: { turnings: [] },
      curve,
      onSeek: (tick: number) => sought.push(tick),
    });
    const interactive = nodes(root).filter((node) => node.props["data-tick"] === 80);
    const marker = interactive.find((node) => node.type === "g")!;
    const sourceButton = interactive.find((node) => node.type === "button")!;
    const prevented: string[] = [];

    expect(marker.props.role).toBe("button");
    expect(marker.props.tabindex).toBe("0");
    (marker.props.onClick as () => void)();
    (marker.props.onKeydown as (event: Partial<KeyboardEvent>) => void)({ key: "Enter", preventDefault: () => prevented.push("Enter") });
    (marker.props.onKeydown as (event: Partial<KeyboardEvent>) => void)({ key: " ", preventDefault: () => prevented.push("Space") });
    (marker.props.onKeydown as (event: Partial<KeyboardEvent>) => void)({ key: "Escape", preventDefault: () => prevented.push("Escape") });
    (sourceButton.props.onClick as () => void)();

    expect(prevented).toEqual(["Enter", "Space"]);
    expect(sought).toEqual([80, 80, 80, 80]);
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
