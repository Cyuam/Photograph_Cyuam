const RESPONSIVE_IMAGE_WIDTHS = [640, 1280]
const RESPONSIVE_ORIGINAL_PATH = /\/picture\/responsive\/[^/]+\/original\.[^/]+$/
const RESPONSIVE_VARIANT_PATH = /\/picture\/responsive\/[^/]+\/w\d+\.webp$/
const ORIGINAL_VARIANT_VALUE = "original"

function pickResponsiveWidth(width) {
  const requestedWidth = Number(width) || RESPONSIVE_IMAGE_WIDTHS[0]
  return (
    RESPONSIVE_IMAGE_WIDTHS.find((candidate) => candidate >= requestedWidth) ||
    RESPONSIVE_IMAGE_WIDTHS[RESPONSIVE_IMAGE_WIDTHS.length - 1]
  )
}

function replaceResponsivePath(pathname, width, options = {}) {
  if (!RESPONSIVE_ORIGINAL_PATH.test(pathname) && !RESPONSIVE_VARIANT_PATH.test(pathname)) {
    return pathname
  }

  const requestedWidth = Number(width) || RESPONSIVE_IMAGE_WIDTHS[0]
  const largestVariantWidth = RESPONSIVE_IMAGE_WIDTHS[RESPONSIVE_IMAGE_WIDTHS.length - 1]
  const pickedWidth = pickResponsiveWidth(width)
  if (options.allowOriginal && RESPONSIVE_ORIGINAL_PATH.test(pathname) && requestedWidth > largestVariantWidth) {
    return pathname
  }

  return pathname.replace(/\/(?:original\.[^/]+|w\d+\.webp)$/, `/w${pickedWidth}.webp`)
}

function rewriteUrl(url, width) {
  const currentPathname = url.pathname
  const requestedWidth = Number(width) || RESPONSIVE_IMAGE_WIDTHS[0]
  const maxWidth = Number(url.searchParams.get("maxWidth"))
  const effectiveWidth = Number.isFinite(maxWidth) && maxWidth > 0
    ? Math.min(requestedWidth, maxWidth)
    : requestedWidth
  const allowOriginal =
    url.searchParams.get("variant") === ORIGINAL_VARIANT_VALUE ||
    url.searchParams.get("original") === "1"

  url.searchParams.delete("maxWidth")
  url.searchParams.delete("variant")
  url.searchParams.delete("original")

  const nextPathname = replaceResponsivePath(url.pathname, effectiveWidth, { allowOriginal })
  url.pathname = nextPathname
  if (nextPathname === currentPathname) {
    url.searchParams.set("w", String(effectiveWidth))
  }
  return url
}

export default function portfolioImageLoader({ src, width }) {
  if (!src) return src
  if (src.startsWith("data:") || src.startsWith("blob:")) return src

  try {
    if (src.startsWith("http://") || src.startsWith("https://")) {
      const url = new URL(src)
      return rewriteUrl(url, width).toString()
    }
  } catch {
    return src
  }

  try {
    const url = new URL(src, "https://portfolio.local")
    const rewritten = rewriteUrl(url, width)
    return `${rewritten.pathname}${rewritten.search}${rewritten.hash}`
  } catch {
    const nextSrc = replaceResponsivePath(src, width)
    if (nextSrc !== src) return nextSrc
    const separator = src.includes("?") ? "&" : "?"
    return `${src}${separator}w=${width}`
  }
}

export { RESPONSIVE_IMAGE_WIDTHS, pickResponsiveWidth, portfolioImageLoader }
