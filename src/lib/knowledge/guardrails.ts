import type { BusinessProfile } from "../schema";

export interface Guardrail {
  title: string;
  body: string;
}

/** Guardrails that apply to every analysis, adjusted for the user's jurisdiction. */
export function baseGuardrails(profile: BusinessProfile): Guardrail[] {
  const out: Guardrail[] = [
    {
      title: "Partnerships are not paid-referral arrangements",
      body: "This analysis recommends building relationships based on mutual value. It does not assume that referral fees, commissions, exclusivity, or endorsements are permitted in your industry. Check professional, regulatory, and contractual rules before compensating anyone for referrals.",
    },
  ];

  if (profile.geography.country === "CA") {
    out.push({
      title: "Outreach in Canada: CASL applies",
      body: "Commercial electronic messages generally need express or implied consent, sender identification, and a working unsubscribe mechanism. Implied consent can exist when a business email address is conspicuously published, the message relates to the recipient's role, and they have not said they don't want such messages. Keep records of how consent was obtained. Personal information you collect is also subject to privacy law (e.g. PIPEDA).",
    });
  } else if (profile.geography.country === "US") {
    out.push({
      title: "Outreach in the US: CAN-SPAM and telemarketing rules",
      body: "Commercial email must not use misleading headers or subject lines, must identify the sender with a physical address, and must honour opt-outs promptly. Calls and text messages are governed by stricter rules (the federal TCPA and some state laws), so do not text or auto-dial prospects without the required consent.",
    });
  } else {
    out.push({
      title: "Check local anti-spam and privacy rules",
      body: "Before emailing or messaging prospective partners, confirm the consent, identification, and opt-out requirements that apply in your jurisdiction and theirs.",
    });
  }

  out.push({
    title: "No automated outreach",
    body: "This tool does not contact anyone on your behalf. Every introduction should be personal, relevant to the recipient, and easy to decline.",
  });
  return out;
}
