'use client';

/* Persistent "draft, not official" notice, with a switch for the band.
 *
 * This site is a design draft built by Evolutionary Eyes. It does not belong to,
 * and is not approved by, the business it depicts, so it must never be mistaken
 * for - or used as - that business's live site. The notice is rendered from the
 * root layout, so it appears on every page, not only the landing page.
 *
 * Deliberately self-contained: it reads no theme tokens, so a palette change
 * cannot make it blend in, and it carries its own styles so it needs no edits to
 * the site's stylesheets. Copy this file verbatim between sites.
 *
 * A hazard-tape band crosses the middle of the viewport diagonally and stays
 * there while the page scrolls. A thin bottom bar was too easy to miss and could
 * be cropped out of a screenshot; a band through the centre of every view
 * cannot. The band is centred on the viewport and far longer than its diagonal,
 * so its ends never show at any size, and the overlay clips it, so it adds no
 * scroll width and takes no space in the layout (no spacer is needed).
 *
 * Two fixed angles: -28deg in portrait, so one whole message fits across a
 * 320px phone, and a flatter -20deg in landscape, so on 16:9 screens the band
 * does not run corner to corner over the header's call to action.
 *
 * The yellow fill is 70% opaque and the black hazard stripes 88% opaque, so the
 * page shows through faintly. The text, borders and DRAFT chip stay fully
 * opaque, so the message keeps strong contrast over light and dark pages.
 * The stripes' gaps are transparent so they show the same fill as the band.
 *
 * A slim tab on the left edge, at mid-height, hides and shows the band, so a
 * reviewer can see the page underneath it. Bottom positions were tried first
 * and collided: with the fixed bottom action bars (and their Call buttons) that
 * many sites pin to phone screens, and with hero links on sites without one.
 * The left page gutter is clear of both, and of the header and the hero's
 * pause control, so the tab keeps one position at every size. It is 14px wide
 * because many sites (71 of 118 measured) have phone gutters as narrow as
 * 16px, and a wider tab would cover the start of their text.
 *
 * Whether the band shows lives in memory only, never in storage or a cookie: it
 * survives moving between pages (the layout stays mounted), but every page load
 * starts with the band showing again, so the warning cannot stay switched off
 * by accident. The server markup, rendered before any click, is that visible
 * state, so hydration matches.
 *
 * The overlay is otherwise non-interactive: `pointer-events: none` lets every
 * click and tap fall through to the page, so it never blocks the site's own
 * header or navigation even where the band covers them. The tab is the only
 * thing that takes pointer events or focus. On touch screens its hit area is
 * 24px wide, and its focus ring pairs black with yellow so it shows on any
 * page.
 *
 * Assistive tech hears the notice once, from the visually hidden sentence, which
 * stays in place while the band is hidden; the repeated band copies are
 * decorative and aria-hidden. The tab's label says what a press will do.
 * Nothing animates. */

import { useState } from 'react';

const BANNER_CSS = `
.ee-draft-overlay {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  overflow: hidden;
  pointer-events: none;
  user-select: none;
  -webkit-user-select: none;
  forced-color-adjust: none;
}

.ee-draft-band {
  /* Layout: centred on the viewport, rotated, longer than any diagonal. */
  position: absolute;
  top: 50%;
  left: 50%;
  width: 200vmax;
  transform: translate(-50%, -50%) rotate(-28deg);
  display: flex;
  justify-content: center;
  gap: 1.5em;
  box-sizing: border-box;
  padding: calc(.45em + 8px) 0;
  overflow: hidden;

  /* Look */
  background: rgba(255, 214, 10, .7);
  color: #111;
  border-block: 2px solid #111;
  box-shadow: 0 6px 18px rgba(0, 0, 0, .28);

  /* Type */
  font: 800 clamp(1rem, min(5vw, .8rem + 1.6vmin), 2.4rem)/1.1 system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  letter-spacing: .02em;
  text-transform: uppercase;
  white-space: nowrap;
}

@media (orientation: landscape) {
  .ee-draft-band {
    transform: translate(-50%, -50%) rotate(-20deg);
  }
}

/* Hazard stripes along both long edges of the band. */
.ee-draft-band::before,
.ee-draft-band::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  height: 8px;
  background: repeating-linear-gradient(-45deg, rgba(17, 17, 17, .88) 0 10px, transparent 10px 20px);
}

.ee-draft-band::before {
  top: 0;
}

.ee-draft-band::after {
  bottom: 0;
}

.ee-draft-band__item {
  flex: none;
  display: flex;
  align-items: center;
  gap: .5em;
}

.ee-draft-band__chip {
  padding: .15em .45em;
  background: #111;
  color: #ffd60a;
  letter-spacing: .14em;
}

.ee-draft-toggle {
  /* Layout: a 14px tab on the left edge at mid-height, inside the narrowest
     (16px) page gutter: a 13px text column plus the 1px right border. */
  position: fixed;
  left: env(safe-area-inset-left, 0px);
  top: 50%;
  transform: translateY(-50%);
  writing-mode: vertical-rl;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  padding: 10px 0;
  pointer-events: auto;
  cursor: pointer;

  /* Look: attached to the edge, so no left border and only right corners. */
  background: #111;
  color: #ffd60a;
  border: 1px solid #ffd60a;
  border-left: 0;
  border-radius: 0 6px 6px 0;
  box-shadow: 0 1px 4px rgba(0, 0, 0, .35);

  /* Type */
  font: 600 11px/13px system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  letter-spacing: .02em;
  white-space: nowrap;
}

/* Touch only: an invisible hit area 24px wide (the WCAG 2.5.8 minimum),
   growing to the right from the edge. Wider would reach over the first letters
   of left-aligned links on sites with a 16px gutter. A mouse needs no extra
   area. */
@media (pointer: coarse) {
  .ee-draft-toggle::before {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    width: 24px;
  }
}

.ee-draft-toggle:hover {
  background: #ffd60a;
  color: #111;
  border-color: #111;
}

/* Yellow ring hugging the tab, black ring outside it: one of the two always
   contrasts with the page behind. */
.ee-draft-toggle:focus-visible {
  outline: 2px solid #111;
  outline-offset: 2px;
  box-shadow: 0 0 0 2px #ffd60a;
}

/* A miniature of the band's hazard stripes, tying the tab to the band. */
.ee-draft-toggle__swatch {
  flex: none;
  width: 10px;
  height: 10px;
  box-sizing: border-box;
  border: 1px solid #ffd60a;
  border-radius: 2px;
  background: repeating-linear-gradient(-45deg, #ffd60a 0 2px, #111 2px 4px);
}

.ee-draft-sr {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}
`;

// Enough copies to span the visible part of the band on the widest screens;
// an odd count puts one whole copy at the centre of the viewport.
const BAND_COPIES = 13;

// Each label names what a press will do, so it changes with the state.
const TOGGLE_LABEL = {
  hide: 'Hide draft banner',
  show: 'Show draft banner',
} as const;

export function DraftBanner() {
  const [isBandVisible, setIsBandVisible] = useState(true);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: BANNER_CSS }} />
      <aside
        className="ee-draft-overlay"
        role="note"
        aria-label="Draft notice"
        data-draft-banner=""
      >
        <p className="ee-draft-sr">
          DRAFT: design draft only. This is not the official website of the
          business shown and is not approved for live or commercial use.
        </p>
        {isBandVisible ? <DraftBand /> : null}
        <button
          type="button"
          className="ee-draft-toggle"
          onClick={() => setIsBandVisible(!isBandVisible)}
        >
          <span className="ee-draft-toggle__swatch" aria-hidden="true" />
          {isBandVisible ? TOGGLE_LABEL.hide : TOGGLE_LABEL.show}
        </button>
      </aside>
    </>
  );
}

function DraftBand() {
  return (
    <div className="ee-draft-band" aria-hidden="true">
      {Array.from({ length: BAND_COPIES }, (_, index) => (
        <span className="ee-draft-band__item" key={index}>
          <span className="ee-draft-band__chip">DRAFT</span>
          Not the official website
        </span>
      ))}
    </div>
  );
}
