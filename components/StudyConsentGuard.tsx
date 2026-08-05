import { useGetStudyStatusQuery } from "@/store/services/studyAPI";
import type { RootState } from "@/store/store";
import { usePathname, useRouter } from "expo-router";
import { useEffect } from "react";
import { useSelector } from "react-redux";

// Routes reachable before a study decision (enrolled or declined) has been
// made: pre-auth screens, the in-flight OAuth bridge (handles its own
// redirect once sign-in actually completes - see auth/google/callback.tsx),
// the root boot screen (same), and the consent screen itself. Everything
// else in the app is off-limits until the user has explicitly joined or
// declined - this is a persistent, app-wide safety net on top of the
// per-entry-point redirects in index.tsx/login.tsx/auth/google/callback.tsx,
// so back-navigation, a stale deep link, or a bug in any one of those can't
// leave a user stranded on a screen they were never supposed to reach.
const ALLOWED_BEFORE_DECISION = new Set([
  "/",
  "/login",
  "/register",
  "/auth/google/callback",
  "/study-consent",
]);

export default function StudyConsentGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const isAuthenticated = useSelector(
    (state: RootState) => state.auth.isAuthenticated,
  );
  const { data: studyStatus, isFetching } = useGetStudyStatusQuery(
    undefined,
    { skip: !isAuthenticated },
  );

  useEffect(() => {
    if (!isAuthenticated || isFetching || !studyStatus) return;
    if (studyStatus.enrolled || studyStatus.declined) return;
    if (ALLOWED_BEFORE_DECISION.has(pathname)) return;

    router.replace("/study-consent");
  }, [isAuthenticated, isFetching, studyStatus, pathname, router]);

  return null;
}
