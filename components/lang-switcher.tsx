"use client"

import clsx from "clsx"
import { useI18n } from "@/lib/i18n"

interface LangSwitcherProps {
  className?: string
}

export function LangSwitcher({ className }: LangSwitcherProps) {
  const { locale, setLocale } = useI18n()
  const toggleLocale = () => {
    setLocale((locale === "en" ? "zh" : "en") as "en" | "zh")
  }

  const nextLocale = locale === "en" ? "zh" : "en"

  return (
    <button
      type="button"
      onClick={toggleLocale}
      aria-label={locale === "en" ? "Switch to Chinese" : "切换到英文"}
      title={locale === "en" ? "Switch to Chinese" : "切换到英文"}
      className={clsx(
        "inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/60 bg-white/80 text-gray-700 shadow-sm transition-all duration-200 hover:shadow-md hover:text-black",
        "backdrop-blur-sm",
        className,
      )}
    >
      <span aria-hidden="true" className="text-[15px] leading-none">
        🌍
      </span>
      <span className="sr-only">{nextLocale === "en" ? "Switch to English" : "切换到中文"}</span>
    </button>
  )
}
