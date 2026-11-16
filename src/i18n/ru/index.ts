// The Russian dictionary: every area's fragment merged into one table. A builder edits only their own fragment.
// ru/errors.ts (text only the server says) is NOT merged here, to keep it out of the browser: see ../rendered.ts.
import { auth } from "./auth";
import { common } from "./common";
import { dashboard } from "./dashboard";
import { labels } from "./labels";
import { messages } from "./messages";
import { orders } from "./orders";
import { publicPages } from "./public";
import { shell } from "./shell";

/** The fragments the pages use, by name (the completeness test checks them one by one). */
export const UI_FRAGMENTS: Record<string, Record<string, string>> = { common, shell, auth, labels, public: publicPages, orders, dashboard, messages };

export const RU: Record<string, string> = Object.assign({}, ...Object.values(UI_FRAGMENTS));
