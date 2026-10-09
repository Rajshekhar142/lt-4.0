import { requireUser } from "@/lib/auth";
import { getFlashcardsAction } from "@/lib/flashcards/actions";
import FlashcardManager from "@/components/flashcards/FlashcardManager";

export default async function FlashcardsPage() {
  await requireUser();
  const flashcards = await getFlashcardsAction();

  return <FlashcardManager flashcards={flashcards} />;
}
