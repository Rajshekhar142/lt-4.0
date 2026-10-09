"use server";

import { revalidatePath } from "next/cache";
import * as fcDb from "./db";

export async function getFlashcardsAction() {
  return fcDb.getFlashcards();
}

export async function createFlashcardAction(topic: string, question: string, answer: string) {
  if (!topic || !question || !answer) throw new Error("Missing required fields");
  fcDb.createFlashcard(topic, question, answer);
  revalidatePath("/flashcards");
}

export async function updateFlashcardAction(id: number, topic: string, question: string, answer: string) {
  if (!id || !topic || !question || !answer) throw new Error("Missing required fields");
  fcDb.updateFlashcard(id, topic, question, answer);
  revalidatePath("/flashcards");
}

export async function deleteFlashcardAction(id: number) {
  if (!id) throw new Error("Invalid ID");
  fcDb.deleteFlashcard(id);
  revalidatePath("/flashcards");
}
