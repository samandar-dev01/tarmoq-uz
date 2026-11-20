import { tk } from "@/i18n/dictionary";
import type { Door } from "./authRole";

// Keyed by the door the account belongs at. Said only after the person has proved who they are (a right password, or a
// Google sign-in), so it tells a stranger nothing about an account. A wrong password always gets the plain "wrong email
// or password", at every door.
// (`tk` only marks these sentences for the translation check; the page or `handle()` puts them into the reader's language.)
export const WRONG_DOOR: Record<Door, string> = {
  provider: tk("Bu ijodkor hisobi. Ijodkorlar eshigidan kiring."),
  client: tk("Bu mijoz hisobi. Mijozlar eshigidan kiring."),
  admin: tk("Bu hisob uchun boshqa kirish sahifasi bor."),
};
