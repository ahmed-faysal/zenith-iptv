import { describe, it, expect } from "vitest";
import { toStaticHref } from "@/hooks/useAppNav";

describe("toStaticHref — webOS file:// route mapping", () => {
  it("maps home to index.html", () => {
    expect(toStaticHref("/")).toBe("./index.html");
    expect(toStaticHref("")).toBe("./index.html");
  });

  it("maps a route with a query to a relative .html with the query preserved", () => {
    expect(toStaticHref("/watch?id=CNN%40HD")).toBe("./watch.html?id=CNN%40HD");
    expect(toStaticHref("/category?slug=news")).toBe("./category.html?slug=news");
  });

  it("maps a route without a query", () => {
    expect(toStaticHref("/search")).toBe("./search.html");
  });

  it("keeps encoded characters (literal %) intact for ids", () => {
    // Channel ids can contain a literal % once encoded; the mapping must not
    // mangle the query string.
    expect(toStaticHref("/watch?id=a%2520b")).toBe("./watch.html?id=a%2520b");
  });
});
