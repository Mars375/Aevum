import { describe, expect, it } from "vitest";
import { renderReport } from "../../../scripts/build-reports.js";

describe("report rendering", () => {
  it("renders Windows and Unix tables identically", () => {
    const markdown = "# Report\n\n| Name | Value |\n| --- | --- |\n| Test | 42 |\n";
    expect(renderReport(markdown.replaceAll("\n", "\r\n"))).toBe(renderReport(markdown));
    expect(renderReport(markdown)).toContain("<td>42</td>");
  });
  it("consumes malformed block markers instead of looping", () => {
    expect(renderReport("| orphan\n\n>\tquote\n\nAfter")).toContain("<p>| orphan</p>");
    expect(renderReport("| orphan\n\nAfter")).toContain("<p>After</p>");
  });
});
