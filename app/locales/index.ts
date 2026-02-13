import cn from "./cn";
import { merge } from "../utils/merge";
import { safeLocalStorage } from "@/app/utils";

import type { LocaleType } from "./cn";
export type { LocaleType, PartialLocaleType } from "./cn";

const localStorage = safeLocalStorage();

const ALL_LANGS = {
  cn,
};

export type Lang = keyof typeof ALL_LANGS;

export const AllLangs = Object.keys(ALL_LANGS) as Lang[];

export const ALL_LANG_OPTIONS: Record<Lang, string> = {
  cn: "简体中文",
};

const LANG_KEY = "lang";
const DEFAULT_LANG = "cn";

const fallbackLang = cn;
const targetLang = ALL_LANGS[getLang()] as LocaleType;

merge(fallbackLang, targetLang);

export default fallbackLang as LocaleType;

function getItem(key: string) {
  return localStorage.getItem(key);
}

function setItem(key: string, value: string) {
  localStorage.setItem(key, value);
}

function getLanguage() {
  return DEFAULT_LANG;
}

export function getLang(): Lang {
  const savedLang = getItem(LANG_KEY);

  if (AllLangs.includes((savedLang ?? "") as Lang)) {
    return savedLang as Lang;
  }

  return getLanguage();
}

export function changeLang(lang: Lang) {
  setItem(LANG_KEY, lang);
  location.reload();
}

export function getISOLang() {
  return "zh-Hans";
}

const DEFAULT_STT_LANG = "zh-CN";
export const STT_LANG_MAP: Record<Lang, string> = {
  cn: "zh-CN",
};

export function getSTTLang(): string {
  return DEFAULT_STT_LANG;
}
