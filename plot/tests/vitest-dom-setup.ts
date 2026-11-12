import { DOMParser } from '@xmldom/xmldom';

if (!(globalThis as { DOMParser?: unknown }).DOMParser) {
  (globalThis as unknown as { DOMParser: typeof DOMParser }).DOMParser = DOMParser;
}
