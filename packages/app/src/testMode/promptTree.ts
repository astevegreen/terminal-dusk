// Test helper: finds the buttons a prompt would draw and lets a test press them, without a browser.
// It only works for components that use no hooks, which is true of every prompt.
import { isValidElement } from "react";
import type { ReactElement, ReactNode } from "react";

export type Button = { text: string; click: () => void };
type Props = { children?: ReactNode; onClick?: () => void };

const textOf = (node: ReactNode): string =>
  Array.isArray(node)
    ? node.map(textOf).join("")
    : typeof node === "string" || typeof node === "number"
      ? String(node)
      : "";

export function buttonsOf(node: ReactNode): Button[] {
  if (Array.isArray(node)) return node.flatMap(buttonsOf);
  if (!isValidElement(node)) return [];
  const element = node as ReactElement<Props>;
  if (typeof element.type === "function")
    return buttonsOf((element.type as (props: Props) => ReactNode)(element.props));
  if (element.type === "button")
    return [{ text: textOf(element.props.children), click: element.props.onClick ?? (() => {}) }];
  return buttonsOf(element.props.children);
}
