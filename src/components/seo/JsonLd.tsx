import { jsonLdString } from "@/lib/seo";

/** Structured data for search engines. It is data, not a script that runs, so the site's script policy does not apply to it. */
export function JsonLd({ data }: { data: object | object[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(data) }} />;
}
