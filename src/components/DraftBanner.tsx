/* Persistent "draft, not official" notice.
 *
 * This site is a design draft built by Evolutionary Eyes. It does not belong to,
 * and is not approved by, the business it depicts, so it must never be mistaken
 * for - or used as - that business's live site. The notice is rendered from the
 * root layout, so it appears on every page, not only the landing page.
 *
 * Deliberately self-contained: it reads no theme tokens, so a palette change
 * cannot make it blend in, and it carries its own styles so it needs no edits to
 * the site's stylesheets.
 *
 * It is pinned to the bottom of the viewport rather than the top because most
 * of these sites pin their own header over the hero; a top strip would be
 * covered at scroll 0 or would cover the navigation. `pointer-events: none`
 * lets taps fall through to any phone call-to-action bar beneath it. The
 * in-flow spacer keeps the last line of the page footer from sitting behind it. */

const BANNER_CSS = `
.ee-draft-spacer{height:calc(2rem + env(safe-area-inset-bottom,0px));}
.ee-draft-banner{position:fixed;left:0;right:0;bottom:0;z-index:2147483647;box-sizing:border-box;height:calc(2rem + env(safe-area-inset-bottom,0px));padding:0 .75rem env(safe-area-inset-bottom,0px);display:flex;align-items:center;justify-content:center;gap:.6rem;background:#ffd60a;color:#111;border-top:2px solid #111;font:600 12px/1 system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;letter-spacing:.02em;text-align:center;white-space:nowrap;overflow:hidden;pointer-events:none;user-select:none;}
.ee-draft-banner__chip{flex:none;padding:.3rem .5rem;background:#111;color:#ffd60a;font-weight:800;letter-spacing:.12em;}
.ee-draft-banner__text{min-width:0;overflow:hidden;text-overflow:ellipsis;}
.ee-draft-banner__long{display:none;}
@media (min-width:48rem){.ee-draft-banner{font-size:13px;}.ee-draft-banner__short{display:none;}.ee-draft-banner__long{display:inline;}}
`;

export function DraftBanner() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: BANNER_CSS }} />
      <div className="ee-draft-spacer" aria-hidden="true" />
      <aside
        className="ee-draft-banner"
        role="note"
        aria-label="Draft notice"
        data-draft-banner=""
      >
        <span className="ee-draft-banner__chip">DRAFT</span>
        <span className="ee-draft-banner__text">
          <span className="ee-draft-banner__short">
            Not the official website
          </span>
          <span className="ee-draft-banner__long">
            Design draft only &mdash; this is not the official website of the
            business shown and is not approved for live or commercial use.
          </span>
        </span>
      </aside>
    </>
  );
}
