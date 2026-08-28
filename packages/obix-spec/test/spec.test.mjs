import test from "node:test";
import assert from "node:assert/strict";
import {
  SPEC_VERSION,
  LEVEL,
  createScopeToken,
  SCOPE_ATTR,
  validateObixAST,
  validateArtifactShape,
  UnsupportedFeatureError,
  DIAGNOSTIC_CODES,
} from "../dist/index.js";

test("spec version + level are frozen", () => {
  assert.equal(SPEC_VERSION, "0.2.1");
  assert.equal(LEVEL, 0);
  assert.equal(SCOPE_ATTR, "data-obix-scope");
});

test("createScopeToken is deterministic + path-sensitive", () => {
  assert.equal(createScopeToken("Timer"), createScopeToken("Timer"));
  assert.notEqual(createScopeToken("Timer"), createScopeToken("Timer", "/a.obix"));
  assert.match(createScopeToken("Timer"), /^obix-[0-9a-f]{8}$/);
});

test("validateObixAST rejects a non-PascalCase name and missing sections", () => {
  const r = validateObixAST({ componentName: "timer", sections: {} });
  assert.equal(r.valid, false);
  assert.ok(r.violations.some((v) => v.rule === "ast.componentName"));
  assert.ok(r.violations.some((v) => v.path === "sections.template"));
});

test("validateObixAST accepts a minimal well-formed AST", () => {
  const r = validateObixAST({
    componentName: "Ok",
    sections: { template: { raw: "", span: {} }, script: { raw: "", span: {} } },
    template: { kind: "element", tag: "div", attrs: [], children: [] },
    script: { actionNames: ["Go"] },
  });
  assert.equal(r.valid, true);
});

test("validateArtifactShape flags a non-function action", () => {
  const r = validateArtifactShape({ name: "X", initialState: {}, props: {}, actions: { Bad: 1 } });
  assert.equal(r.valid, false);
});

test("UnsupportedFeatureError carries level info", () => {
  const e = new UnsupportedFeatureError("loops", 1, 0);
  assert.equal(e.feature, "loops");
  assert.equal(e.requiredLevel, 1);
  assert.equal(e.currentLevel, 0);
  assert.equal(DIAGNOSTIC_CODES.C011_VERSION_MISMATCH, "OBIX-C011");
});
