// Test helper: walks the element tree the sign-in screen draws and lets a test press its buttons and submit its
// forms with typed values, without a browser (like testMode/promptTree.ts). Only for components with no hooks.
import { isValidElement } from "react";
import type { ReactElement, ReactNode } from "react";

export type TreeButton = { text: string; type: string; disabled: boolean; press: () => void };
export type TreeForm = {
  /** The names of the form's fields. */
  fields: string[];
  /** Submits the form as if `values` had been typed into its fields. */
  submit: (values: Record<string, string>) => void;
};
export type Tree = { buttons: TreeButton[]; forms: TreeForm[] };

type Props = {
  children?: ReactNode;
  onClick?: () => void;
  onSubmit?: (event: unknown) => void;
  type?: string;
  disabled?: boolean;
  name?: string;
};

const textOf = (node: ReactNode): string =>
  Array.isArray(node)
    ? node.map(textOf).join("")
    : typeof node === "string" || typeof node === "number"
      ? String(node)
      : "";

function walk(node: ReactNode, tree: Tree, fields: string[] | null): void {
  if (Array.isArray(node)) {
    for (const child of node) walk(child, tree, fields);
    return;
  }
  if (!isValidElement(node)) return;
  const element = node as ReactElement<Props>;
  const props = element.props;
  if (typeof element.type === "function") {
    walk((element.type as (p: Props) => ReactNode)(props), tree, fields);
    return;
  }
  if (element.type === "button") {
    tree.buttons.push({
      text: textOf(props.children),
      type: props.type ?? "submit",
      disabled: props.disabled === true,
      press: props.onClick ?? (() => {}),
    });
    return;
  }
  if (element.type === "input" && fields !== null && props.name !== undefined) fields.push(props.name);
  if (element.type === "form") {
    const names: string[] = [];
    const onSubmit = props.onSubmit;
    walk(props.children, tree, names);
    tree.forms.push({
      fields: names,
      submit: (values) => {
        const elements = { namedItem: (name: string) => (name in values ? { value: values[name] } : null) };
        onSubmit?.({ preventDefault: () => {}, currentTarget: { elements } });
      },
    });
    return;
  }
  walk(props.children, tree, fields);
}

export function treeOf(node: ReactNode): Tree {
  const tree: Tree = { buttons: [], forms: [] };
  walk(node, tree, null);
  return tree;
}

/** The one button with this text; throws when there is none or more than one. */
export function button(tree: Tree, text: string): TreeButton {
  const found = tree.buttons.filter((b) => b.text === text);
  if (found.length !== 1) throw new Error(`expected one "${text}" button, found ${found.length}`);
  return found[0]!;
}
