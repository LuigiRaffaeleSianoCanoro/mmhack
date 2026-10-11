import { notFound } from "next/navigation";
import { Chat } from "@/components/chat/chat";
import { ASSISTANTS, getAssistant } from "@/lib/assistants";

export function generateStaticParams() {
  return ASSISTANTS.map((a) => ({ slug: a.slug }));
}

export default async function AssistantPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = getAssistant(slug);
  if (!a) notFound();
  return <Chat slug={a.slug} />;
}
