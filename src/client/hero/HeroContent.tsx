import { LogoMark } from './LogoMark.tsx'

/** One suggestion chip: a label and the draft it stages. */
const CHIPS = [
  { label: 'hero.chip.intro', prompt: 'hero.prompt.intro' },
  { label: 'hero.chip.fix', prompt: 'hero.prompt.fix' },
  { label: 'hero.chip.summary', prompt: 'hero.prompt.summary' },
] as const

/**
 * Occupant of `conversation.hero.content`: the blank-session stack of the
 * reference screen — 110px brand tile, 26px headline, one row of suggestion
 * chips. Chips stage a draft through the resident input actions, so clicking
 * one behaves like typing into the composer.
 */
export function HeroContent({ t, inputActions }: {
  t: (key: string) => string
  inputActions?: { setDraft(text: string): void } | undefined
}) {
  return (
    <div className="skin-hero">
      <div className="skin-hero__tile">
        <LogoMark />
      </div>
      <div className="skin-hero__title">{t('hero.title')}</div>
      <div className="skin-hero__chips">
        {CHIPS.map(chip => (
          <button
            key={chip.label}
            type="button"
            className="skin-hero__chip"
            onClick={() => { inputActions?.setDraft(t(chip.prompt)) }}
          >
            {t(chip.label)}
          </button>
        ))}
      </div>
    </div>
  )
}
