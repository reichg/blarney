import { PendingSubmitButton } from "@/app/chair/notices/PendingSubmitButton";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

// Only the idle state is covered: useFormStatus reports pending solely while
// an enclosing <form action> submission is in flight, which a static render
// cannot stage without a full browser form-action harness.
describe("PendingSubmitButton", () => {
  it("renders an enabled submit button with its children while idle", () => {
    const html = renderToStaticMarkup(
      <form>
        <PendingSubmitButton className="actionButton" pendingLabel="Saving...">
          Save listing
        </PendingSubmitButton>
      </form>,
    );

    expect(html).toContain('type="submit"');
    expect(html).toContain('class="actionButton"');
    expect(html).toContain("Save listing");
    expect(html).not.toContain("disabled");
    expect(html).not.toContain("Saving...");
  });
});
