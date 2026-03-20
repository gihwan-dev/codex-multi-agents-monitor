// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { isEditableKeyboardTarget } from "../src/pages/monitor/index.js";

describe("단축키 대상 판별", () => {
  it("입력 요소는 편집 가능한 대상으로 본다", () => {
    const input = document.createElement("input");
    const textarea = document.createElement("textarea");
    const select = document.createElement("select");
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");

    expect(isEditableKeyboardTarget(input)).toBe(true);
    expect(isEditableKeyboardTarget(textarea)).toBe(true);
    expect(isEditableKeyboardTarget(select)).toBe(true);
    expect(isEditableKeyboardTarget(editable)).toBe(true);
  });

  it("일반 버튼은 편집 가능한 대상으로 보지 않는다", () => {
    const button = document.createElement("button");

    expect(isEditableKeyboardTarget(button)).toBe(false);
    expect(isEditableKeyboardTarget(null)).toBe(false);
  });
});
