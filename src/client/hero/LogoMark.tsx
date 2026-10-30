import { MARK_DATA_URI } from './mark-data.ts'

/**
 * The reference brand mark, drawn at its captured size.
 *
 * A hand-drawn three-loop knot cannot be rebuilt from ellipses — rows through
 * the reference are not consistent with any one ellipse construction — so the
 * mark ships as the reference's own alpha-masked pixels (`scripts/make-mark.mjs`)
 * and keeps its exact optical weight at the reference viewport. 78x72.5 CSS px
 * is the measured ink box inside the 110px tile.
 */
export function LogoMark() {
  return (
    <img
      className="skin-logo"
      src={MARK_DATA_URI}
      width={78}
      height={72.5}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  )
}
