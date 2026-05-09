import { loginChair } from "@/app/actions/chairAuth";
import styles from "@/app/chair/chair.module.css";
import { type ChairLoginPageProps } from "@/app/chair/login/type";
import formStyles from "@/app/forms.module.css";
import { LockKeyhole } from "lucide-react";

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ChairLoginPage({
  searchParams,
}: ChairLoginPageProps) {
  const params = (await searchParams) ?? {};
  const hasError = getParam(params.error) === "1";
  const nextPath = getParam(params.next) ?? "/chair";

  return (
    <section className={styles.loginPage}>
      <form action={loginChair} className={styles.loginPanel}>
        <input name="next" type="hidden" value={nextPath} />
        <p className="eyebrow">Chair Access</p>
        <h1>Private dashboard</h1>
        <p className={styles.pageIntro}>
          Sign in to reach registrations, responses, photo moderation,
          remembrance, and pairings.
        </p>
        <label className={formStyles.field}>
          <span>Password</span>
          <input
            autoComplete="current-password"
            name="password"
            required
            type="password"
          />
        </label>
        {hasError ? (
          <div className={styles.error}>The password did not match.</div>
        ) : null}
        <button className={formStyles.submitButton} type="submit">
          <LockKeyhole aria-hidden="true" size={18} />
          Sign in
        </button>
      </form>
    </section>
  );
}
