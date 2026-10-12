import defaultMdxComponents from "fumadocs-ui/mdx";
import Link from "next/link";
import type { ComponentProps } from "react";
import type { MDXComponents } from "mdx/types";

function MdxLink({ href, ...props }: ComponentProps<"a">) {
  if (href?.startsWith("/docs/")) {
    return <Link href={href} {...props} />;
  }

  return <a href={href} {...props} />;
}

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    a: MdxLink,
    ...components,
  };
}
