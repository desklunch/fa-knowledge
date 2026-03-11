"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createPage, deletePage, movePage, savePage } from "@/lib/knowledge-base";
import { getImpersonatedUserId } from "@/lib/impersonation";

function buildHomeUrl(params: Record<string, string | null | undefined>) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  const query = searchParams.toString();

  return query ? `/?${query}` : "/";
}

function getNullableNumber(formData: FormData, key: string) {
  const rawValue = String(formData.get(key) ?? "").trim();

  if (!rawValue) {
    return null;
  }

  const parsedValue = Number(rawValue);

  return Number.isNaN(parsedValue) ? null : parsedValue;
}

async function requireActingUserId() {
  const actingUserId = await getImpersonatedUserId();

  if (!actingUserId) {
    throw new Error("No active user selected.");
  }

  return actingUserId;
}

export async function savePageAction(formData: FormData) {
  const pageId = String(formData.get("pageId") ?? "");

  try {
    const actingUserId = await requireActingUserId();
    const result = await savePage({
      actingUserId,
      pageId,
      title: String(formData.get("title") ?? ""),
      contentMarkdown: String(formData.get("contentMarkdown") ?? ""),
      editorDocJson: parseEditorDocJson(formData.get("editorDocJson")),
    });

    revalidatePath("/");
    redirect(
      buildHomeUrl({
        page: result.page.id,
        status: "success",
        message: "Page saved.",
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save page.";

    redirect(
      buildHomeUrl({
        page: pageId,
        status: "error",
        message,
      }),
    );
  }
}

function parseEditorDocJson(rawValue: FormDataEntryValue | null) {
  if (typeof rawValue !== "string" || !rawValue.trim()) {
    return null;
  }

  try {
    return JSON.parse(rawValue);
  } catch {
    return null;
  }
}

export async function createPageAction(formData: FormData) {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const parentPageId = String(formData.get("parentPageId") ?? "").trim() || null;

  try {
    const actingUserId = await requireActingUserId();
    const result = await createPage({
      actingUserId,
      workspaceId,
      parentPageId,
      title: String(formData.get("title") ?? ""),
      contentMarkdown: String(formData.get("contentMarkdown") ?? ""),
      explicitReadLevel: getNullableNumber(formData, "explicitReadLevel"),
      explicitWriteLevel: getNullableNumber(formData, "explicitWriteLevel"),
    });

    revalidatePath("/");
    redirect(
      buildHomeUrl({
        page: result.page.id,
        status: "success",
        message: "Page created.",
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create page.";

    redirect(
      buildHomeUrl({
        page: parentPageId,
        status: "error",
        message,
      }),
    );
  }
}

export async function movePageAction(formData: FormData) {
  const pageId = String(formData.get("pageId") ?? "");
  const destinationParentPageId =
    String(formData.get("destinationParentPageId") ?? "").trim() || null;
  const destinationIndexValue = String(formData.get("destinationIndex") ?? "").trim();
  const destinationIndex = destinationIndexValue ? Number(destinationIndexValue) : null;

  try {
    const actingUserId = await requireActingUserId();
    const result = await movePage({
      actingUserId,
      pageId,
      destinationParentPageId,
      destinationIndex:
        destinationIndex !== null && !Number.isNaN(destinationIndex)
          ? destinationIndex
          : null,
    });

    revalidatePath("/");
    redirect(
      buildHomeUrl({
        page: result.page.id,
        status: "success",
        message: "Page moved.",
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to move page.";

    redirect(
      buildHomeUrl({
        page: pageId,
        status: "error",
        message,
      }),
    );
  }
}

export async function deletePageAction(formData: FormData) {
  const pageId = String(formData.get("pageId") ?? "");

  try {
    const actingUserId = await requireActingUserId();
    const result = await deletePage({
      actingUserId,
      pageId,
    });

    revalidatePath("/");
    redirect(
      buildHomeUrl({
        page: result.redirectPageId,
        status: "success",
        message: "Page deleted.",
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete page.";

    redirect(
      buildHomeUrl({
        page: pageId,
        status: "error",
        message,
      }),
    );
  }
}
