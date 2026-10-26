import { useEffect } from "react";
import { SITE_DESCRIPTION } from "@/lib/site-metadata";

export function usePageMetadata(title: string, description = SITE_DESCRIPTION) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title;
    const restores = [
      ["property", "og:title", title],
      ["property", "og:description", description],
      ["name", "twitter:title", title],
      ["name", "twitter:description", description],
      ["name", "description", description],
    ].map(([attribute, key, content]) => {
      const existing = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
      const node = existing ?? document.createElement("meta");
      const previous = node.getAttribute("content");
      node.setAttribute(attribute!, key!);
      node.setAttribute("content", content!);
      if (!existing) document.head.appendChild(node);
      return () => {
        if (!existing) node.remove();
        else if (previous === null) node.removeAttribute("content");
        else node.setAttribute("content", previous);
      };
    });
    return () => {
      document.title = previousTitle;
      restores.forEach(restore => restore());
    };
  }, [title, description]);
}
