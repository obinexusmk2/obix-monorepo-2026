/**
 * Conformance contract DSL (`Timer.obix.test`). Level 0 parses the clauses into
 * a structured object. Behavioural and contract runners live as separate
 * internal modules of THIS single package — not a 21st npm package.
 */
export interface ContractActionDecl {
  name: string;
  arity: number;
  readsProps: string[];
}
export interface ContractDerivedDecl {
  name: string;
  type: string;
}
export interface ContractEffectDecl {
  name: string;
  every: number;
  dispatches: string;
}
export interface ContractInvariant {
  name: string;
  body: string;
}
export interface ContractElement {
  name: string;
  body: string;
}

export interface ContractModel {
  dop: {
    actions: ContractActionDecl[];
    derived: ContractDerivedDecl[];
    effects: ContractEffectDecl[];
  };
  invariants: ContractInvariant[];
  elements: ContractElement[];
  announce?: string;
}

export function parseContractDSL(source: string): ContractModel {
  const model: ContractModel = {
    dop: { actions: [], derived: [], effects: [] },
    invariants: [],
    elements: [],
  };

  const dopBlock = source.match(/dop\s*\{([\s\S]*?)\n\}/);
  if (dopBlock) {
    for (const lineRaw of dopBlock[1]!.split("\n")) {
      const line = lineRaw.trim();
      let m: RegExpMatchArray | null;
      if ((m = line.match(/^action\s+([A-Za-z_$][\w$]*)\s+arity\s+(\d+)\s+reads\s+props\s+\[([^\]]*)\]$/))) {
        model.dop.actions.push({
          name: m[1]!,
          arity: Number(m[2]),
          readsProps: m[3]!.split(",").map((s) => s.trim()).filter(Boolean),
        });
      } else if ((m = line.match(/^derived\s+([A-Za-z_$][\w$]*)\s*:\s*(\w+)$/))) {
        model.dop.derived.push({ name: m[1]!, type: m[2]! });
      } else if ((m = line.match(/^effect\s+([A-Za-z_$][\w$]*)\s+every\s+(\d+)\s+dispatches\s+([A-Za-z_$][\w$]*)$/))) {
        model.dop.effects.push({ name: m[1]!, every: Number(m[2]), dispatches: m[3]! });
      }
    }
  }

  const invRe = /invariant\s+([A-Za-z_$][\w$]*)\s*\{([\s\S]*?)\n\}/g;
  let im: RegExpExecArray | null;
  while ((im = invRe.exec(source)) !== null) {
    model.invariants.push({ name: im[1]!, body: im[2]!.trim() });
  }

  const elRe = /element\s+([A-Za-z_$][\w$]*)\s*\{([\s\S]*?)\n\}/g;
  let em: RegExpExecArray | null;
  while ((em = elRe.exec(source)) !== null) {
    model.elements.push({ name: em[1]!, body: em[2]!.trim() });
  }

  const ann = source.match(/announce\s*\{([\s\S]*?)\n\}/);
  if (ann) model.announce = ann[1]!.trim();

  return model;
}
