import { AuthGate } from "@/components/fixit/auth";
import { FixitSessions } from "@/components/fixit/sessions";

export default function Page() {
  return (
    <AuthGate>
      <FixitSessions />
    </AuthGate>
  );
}
