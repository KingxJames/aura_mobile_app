import type { RootState } from "@/store/store";
import { usePathname, useRouter } from "expo-router";
import { useEffect } from "react";
import { useSelector } from "react-redux";

// Routes reachable while signed out: pre-auth screens and the in-flight
// OAuth bridge (handles its own redirect once sign-in actually completes -
// see auth/google/callback.tsx). Everything else requires a session - this
// is an app-wide safety net so a deep link (a shared URL, a bookmark, a
// stale tab) can't land a signed-out visitor directly on a screen that
// assumes one, the same way StudyConsentGuard backstops the study decision.
const ALLOWED_WHILE_SIGNED_OUT = new Set(["/", "/login", "/register", "/auth/google/callback"]);

export default function AuthGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const isAuthenticated = useSelector(
    (state: RootState) => state.auth.isAuthenticated,
  );

  useEffect(() => {
    if (isAuthenticated || ALLOWED_WHILE_SIGNED_OUT.has(pathname)) return;
    router.replace("/login");
  }, [isAuthenticated, pathname, router]);

  return null;
}
