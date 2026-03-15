import { randomUUID } from "node:crypto";

import { asc, desc, eq } from "drizzle-orm";
import OpenAI from "openai";
import { z } from "zod";

import { db } from "@/db/client";
import {
  agentActions,
  agentMessageAttachments,
  agentMessageCitations,
  agentMessages,
  agentPatchProposals,
  agentThreads,
  pageRevisions,
  pages,
  type AgentAction,
  type AgentMessage,
  type AgentMessageAttachment,
  type AgentMessageCitation,
  type AgentPatchProposal,
  type AgentThread,
  type Page,
  type PageRevision,
  type User,
  users,
  type Workspace,
  workspaces,
} from "@/db/schema";
import { getKnowledgeBaseSnapshotForTests } from "@/lib/knowledge-base";
import { canReadPage, canReadWorkspace, canWritePage } from "@/lib/permissions";
import { clearPageEditSessionsForUser, savePage } from "@/lib/knowledge-base";

export const SHVR_RESEARCH_AGENT_KEY = "shvr-research-agent";
export const SHVR_RESEARCH_AGENT_NAME = "SHVR Research Agent";
const ATTACHED_SUBTREE_MAX_DEPTH = 2;
const ATTACHED_SUBTREE_MAX_PAGES = 8;
const OPENAI_MODEL = process.env.OPENAI_MODEL?.trim() || "gpt-5";
const openaiClient = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null;

const openAiReplySchema = z.object({
  message: z.string().min(1),
  citationPageIds: z.array(z.string().uuid()).max(4).default([]),
  patchProposal: z
    .object({
      targetPageId: z.string().uuid(),
      proposedTitle: z.string().min(1),
      proposedContentMarkdown: z.string().min(1),
      rationale: z.string().min(1),
    })
    .nullable()
    .default(null),
});

export type EntityReference = {
  entityType: "page";
  entityId: string;
  href: string;
  label: string;
};

export type AgentActionView = {
  id: string;
  actionType: "apply_page_patch" | "discard_page_patch";
  label: string;
  status: "pending" | "completed" | "dismissed";
  targetEntityId: string | null;
  targetEntityType: "page" | null;
  outcomeMessage: string | null;
};

export type AgentPatchProposalView = {
  id: string;
  targetPageId: string;
  baseRevisionId: string;
  proposedTitle: string;
  proposedContentMarkdown: string;
  rationale: string;
  status: "pending" | "applied" | "discarded";
};

export type AgentMessageView = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
  attachments: EntityReference[];
  citations: Array<{
    href: string;
    pageId: string;
    pageTitle: string;
  }>;
  actions: AgentActionView[];
  patchProposal: AgentPatchProposalView | null;
};

export type AgentThreadView = {
  id: string;
  agentKey: string;
  title: string;
  messages: AgentMessageView[];
};

export type SendAgentMessageInput = {
  actingUserId: string;
  content: string;
  attachments?: EntityReference[];
};

export type SendAgentMessageResult = {
  thread: AgentThreadView;
  assistantMessage: AgentMessageView;
};

export type ExecuteAgentActionInput = {
  actingUserId: string;
  actionId: string;
};

type AgentSnapshot = {
  users: User[];
  workspaces: Workspace[];
  pages: Page[];
  revisions: PageRevision[];
  threads: AgentThread[];
  messages: AgentMessage[];
  attachments: AgentMessageAttachment[];
  citations: AgentMessageCitation[];
  actions: AgentAction[];
  patchProposals: AgentPatchProposal[];
};

type VisiblePage = Page & {
  currentContentMarkdown: string;
  currentRevision: PageRevision;
  workspace: Workspace;
};

type AgentReply = {
  content: string;
  citations: VisiblePage[];
  patchProposal:
    | {
        targetPage: VisiblePage;
        proposedTitle: string;
        proposedContentMarkdown: string;
        rationale: string;
      }
    | null;
};

const fallbackStore: Omit<AgentSnapshot, "users" | "workspaces" | "pages" | "revisions"> = {
  threads: [],
  messages: [],
  attachments: [],
  citations: [],
  actions: [],
  patchProposals: [],
};

export function resetAgentFallbackStore() {
  fallbackStore.threads = [];
  fallbackStore.messages = [];
  fallbackStore.attachments = [];
  fallbackStore.citations = [];
  fallbackStore.actions = [];
  fallbackStore.patchProposals = [];
}

export async function getAgentThread(input: {
  actingUserId: string;
}): Promise<AgentThreadView> {
  const snapshot = await getSnapshot();
  const currentUser = getCurrentUser(snapshot, input.actingUserId);

  if (!currentUser) {
    throw new Error("No active user selected.");
  }

  const thread = await ensureDefaultThread(currentUser.id);
  const threadSnapshot = await getSnapshot();

  return buildThreadView(threadSnapshot, thread.id);
}

export async function sendAgentMessage(
  input: SendAgentMessageInput,
): Promise<SendAgentMessageResult> {
  const snapshot = await getSnapshot();
  const currentUser = getCurrentUser(snapshot, input.actingUserId);

  if (!currentUser) {
    throw new Error("No active user selected.");
  }

  const thread = await ensureDefaultThread(currentUser.id);
  const resolvedAttachments = resolveAttachments(snapshot, currentUser, input.attachments ?? []);
  const userMessage = await createAgentMessage({
    threadId: thread.id,
    role: "user",
    content: input.content.trim(),
  });

  await replaceMessageAttachments(userMessage.id, resolvedAttachments);

  const latestSnapshot = await getSnapshot();
  const visiblePages = getVisiblePages(latestSnapshot, currentUser);
  const history = getThreadMessages(latestSnapshot, thread.id).slice(-12);
  const assistantReply = await generateAgentReply({
    currentUser,
    history,
    messageContent: input.content,
    attachments: resolvedAttachments,
    visiblePages,
  });

  const assistantMessage = await createAgentMessage({
    threadId: thread.id,
    role: "assistant",
    content: assistantReply.content,
  });

  await replaceMessageCitations(assistantMessage.id, assistantReply.citations);

  if (assistantReply.patchProposal) {
    const proposal = await createPatchProposal({
      assistantMessageId: assistantMessage.id,
      baseRevisionId: assistantReply.patchProposal.targetPage.currentRevision.id,
      proposedContentMarkdown: assistantReply.patchProposal.proposedContentMarkdown,
      proposedTitle: assistantReply.patchProposal.proposedTitle,
      rationale: assistantReply.patchProposal.rationale,
      targetPageId: assistantReply.patchProposal.targetPage.id,
    });

    await createAction({
      actionType: "apply_page_patch",
      label: "Apply patch",
      messageId: assistantMessage.id,
      payload: { proposalId: proposal.id },
      targetEntityId: proposal.targetPageId,
      targetEntityType: "page",
    });
    await createAction({
      actionType: "discard_page_patch",
      label: "Discard patch",
      messageId: assistantMessage.id,
      payload: { proposalId: proposal.id },
      targetEntityId: proposal.targetPageId,
      targetEntityType: "page",
    });
  }

  const finalSnapshot = await getSnapshot();
  const finalThread = buildThreadView(finalSnapshot, thread.id);
  const finalAssistantMessage =
    finalThread.messages.find((message) => message.id === assistantMessage.id) ??
    finalThread.messages.at(-1);

  if (!finalAssistantMessage) {
    throw new Error("Failed to load assistant response.");
  }

  return {
    thread: finalThread,
    assistantMessage: finalAssistantMessage,
  };
}

export async function executeAgentAction(input: ExecuteAgentActionInput) {
  const snapshot = await getSnapshot();
  const currentUser = getCurrentUser(snapshot, input.actingUserId);

  if (!currentUser) {
    throw new Error("No active user selected.");
  }

  const action = snapshot.actions.find((candidate) => candidate.id === input.actionId);

  if (!action) {
    throw new Error("Action not found.");
  }

  const proposalId = getProposalId(action.payload);

  if (!proposalId) {
    throw new Error("Unsupported action payload.");
  }

  const proposal = snapshot.patchProposals.find((candidate) => candidate.id === proposalId);

  if (!proposal) {
    throw new Error("Patch proposal not found.");
  }

  if (proposal.status !== "pending" || action.status !== "pending") {
    throw new Error("Action is no longer available.");
  }

  if (action.actionType === "discard_page_patch") {
    await updatePatchProposalStatus(proposal.id, "discarded");
    await updateActionStatus(action.id, "dismissed", currentUser.id, "Patch discarded.");

    const siblingActions = snapshot.actions.filter(
      (candidate) =>
        candidate.id !== action.id &&
        candidate.status === "pending" &&
        getProposalId(candidate.payload) === proposal.id,
    );

    for (const siblingAction of siblingActions) {
      await updateActionStatus(
        siblingAction.id,
        "dismissed",
        currentUser.id,
        "Patch discarded.",
      );
    }
  } else if (action.actionType === "apply_page_patch") {
    const page = snapshot.pages.find((candidate) => candidate.id === proposal.targetPageId);
    const workspace = page
      ? snapshot.workspaces.find((candidate) => candidate.id === page.workspaceId) ?? null
      : null;

    if (!page || !workspace) {
      throw new Error("Target page not found.");
    }

    if (!canWritePage(currentUser, workspace, page)) {
      throw new Error("You do not have permission to update this page.");
    }

    const result = await savePage({
      actingUserId: currentUser.id,
      pageId: page.id,
      title: proposal.proposedTitle,
      contentMarkdown: proposal.proposedContentMarkdown,
      currentRevisionId: proposal.baseRevisionId,
      editorDocJson: null,
    });

    await clearPageEditSessionsForUser({
      pageId: page.id,
      userId: currentUser.id,
    });

    await updatePatchProposalApplied(proposal.id, result.revision.id);
    await updateActionStatus(action.id, "completed", currentUser.id, "Patch applied.");

    const siblingActions = snapshot.actions.filter(
      (candidate) =>
        candidate.id !== action.id &&
        candidate.status === "pending" &&
        getProposalId(candidate.payload) === proposal.id,
    );

    for (const siblingAction of siblingActions) {
      await updateActionStatus(
        siblingAction.id,
        "dismissed",
        currentUser.id,
        "Patch applied.",
      );
    }
  } else {
    throw new Error("Unsupported action type.");
  }

  return getAgentThread({ actingUserId: currentUser.id });
}

function getCurrentUser(snapshot: AgentSnapshot, actingUserId: string) {
  return snapshot.users.find((user) => user.id === actingUserId) ?? null;
}

async function getSnapshot(): Promise<AgentSnapshot> {
  if (!db) {
    const knowledgeSnapshot = await getKnowledgeBaseSnapshotForTests();

    return {
      users: knowledgeSnapshot.users,
      workspaces: knowledgeSnapshot.workspaces,
      pages: knowledgeSnapshot.pages,
      revisions: knowledgeSnapshot.revisions,
      threads: fallbackStore.threads,
      messages: fallbackStore.messages,
      attachments: fallbackStore.attachments,
      citations: fallbackStore.citations,
      actions: fallbackStore.actions,
      patchProposals: fallbackStore.patchProposals,
    };
  }

  const [
    userRows,
    workspaceRows,
    pageRows,
    revisionRows,
    threadRows,
    messageRows,
    attachmentRows,
    citationRows,
    actionRows,
    patchProposalRows,
  ] = await Promise.all([
    db.select().from(users).orderBy(asc(users.name)),
    db.select().from(workspaces).orderBy(asc(workspaces.type), asc(workspaces.name)),
    db.select().from(pages).orderBy(asc(pages.path), asc(pages.sortOrder)),
    db.select().from(pageRevisions).orderBy(desc(pageRevisions.createdAt)),
    db.select().from(agentThreads).orderBy(asc(agentThreads.createdAt)),
    db.select().from(agentMessages).orderBy(asc(agentMessages.createdAt)),
    db.select().from(agentMessageAttachments).orderBy(
      asc(agentMessageAttachments.messageId),
      asc(agentMessageAttachments.sortOrder),
    ),
    db.select().from(agentMessageCitations).orderBy(
      asc(agentMessageCitations.messageId),
      asc(agentMessageCitations.sortOrder),
    ),
    db.select().from(agentActions).orderBy(asc(agentActions.createdAt)),
    db.select().from(agentPatchProposals).orderBy(asc(agentPatchProposals.createdAt)),
  ]);

  return {
    users: userRows,
    workspaces: workspaceRows,
    pages: pageRows,
    revisions: revisionRows,
    threads: threadRows,
    messages: messageRows,
    attachments: attachmentRows,
    citations: citationRows,
    actions: actionRows,
    patchProposals: patchProposalRows,
  };
}

async function ensureDefaultThread(userId: string) {
  const snapshot = await getSnapshot();
  const existingThread = snapshot.threads.find(
    (thread) =>
      thread.userId === userId &&
      thread.agentKey === SHVR_RESEARCH_AGENT_KEY &&
      thread.isDefault === 1,
  );

  if (existingThread) {
    return existingThread;
  }

  const now = new Date();
  const nextThread: AgentThread = {
    id: randomUUID(),
    userId,
    agentKey: SHVR_RESEARCH_AGENT_KEY,
    title: SHVR_RESEARCH_AGENT_NAME,
    isDefault: 1,
    createdAt: now,
    updatedAt: now,
  };

  if (!db) {
    fallbackStore.threads.push(nextThread);
    return nextThread;
  }

  try {
    await db.insert(agentThreads).values(nextThread);
    return nextThread;
  } catch (error) {
    const constraintError =
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "23505";

    if (!constraintError) {
      throw error;
    }

    const latestSnapshot = await getSnapshot();
    const concurrentThread = latestSnapshot.threads.find(
      (thread) =>
        thread.userId === userId &&
        thread.agentKey === SHVR_RESEARCH_AGENT_KEY &&
        thread.isDefault === 1,
    );

    if (!concurrentThread) {
      throw error;
    }

    return concurrentThread;
  }
}

function resolveAttachments(
  snapshot: AgentSnapshot,
  currentUser: User,
  attachments: EntityReference[],
) {
  const visiblePages = getVisiblePages(snapshot, currentUser);
  const visiblePageMap = new Map(visiblePages.map((page) => [page.id, page]));

  return attachments.map((attachment, index) => {
    if (attachment.entityType !== "page") {
      throw new Error("Unsupported attachment type.");
    }

    const page = visiblePageMap.get(attachment.entityId);

    if (!page) {
      throw new Error("Attachment is not readable by the active user.");
    }

    return {
      entityType: "page" as const,
      entityId: page.id,
      href: attachment.href || `/?page=${page.id}`,
      label: attachment.label || page.title,
      sortOrder: index,
    };
  });
}

function getVisiblePages(snapshot: AgentSnapshot, currentUser: User): VisiblePage[] {
  const latestRevisionByPageId = new Map<string, PageRevision>();

  for (const revision of snapshot.revisions) {
    if (!latestRevisionByPageId.has(revision.pageId)) {
      latestRevisionByPageId.set(revision.pageId, revision);
    }
  }

  return snapshot.pages
    .map((page) => {
      const workspace =
        snapshot.workspaces.find((candidate) => candidate.id === page.workspaceId) ?? null;
      const currentRevision =
        (page.currentRevisionId
          ? snapshot.revisions.find((candidate) => candidate.id === page.currentRevisionId)
          : null) ??
        latestRevisionByPageId.get(page.id) ??
        null;

      if (!workspace || !currentRevision) {
        return null;
      }

      if (!canReadWorkspace(currentUser, workspace) || !canReadPage(currentUser, workspace, page)) {
        return null;
      }

      return {
        ...page,
        currentContentMarkdown: currentRevision.contentMarkdown,
        currentRevision,
        workspace,
      };
    })
    .filter((page): page is VisiblePage => page !== null);
}

function getThreadMessages(snapshot: AgentSnapshot, threadId: string) {
  return snapshot.messages
    .filter((message) => message.threadId === threadId)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

function buildThreadView(snapshot: AgentSnapshot, threadId: string): AgentThreadView {
  const thread = snapshot.threads.find((candidate) => candidate.id === threadId);

  if (!thread) {
    throw new Error("Agent thread not found.");
  }

  const messages = getThreadMessages(snapshot, threadId).map((message) => {
    const messageAttachments = snapshot.attachments
      .filter((attachment) => attachment.messageId === message.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((attachment) => ({
        entityId: attachment.entityId,
        entityType: attachment.entityType,
        href: attachment.href ?? `/?page=${attachment.entityId}`,
        label: attachment.label,
      }));
    const messageCitations = snapshot.citations
      .filter((citation) => citation.messageId === message.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((citation) => ({
        href: citation.href,
        pageId: citation.pageId,
        pageTitle: citation.pageTitle,
      }));
    const messageActions = snapshot.actions
      .filter((action) => action.messageId === message.id)
      .map((action) => ({
        id: action.id,
        actionType: action.actionType,
        label: action.label,
        status: action.status,
        targetEntityId: action.targetEntityId ?? null,
        targetEntityType: action.targetEntityType ?? null,
        outcomeMessage: action.outcomeMessage ?? null,
      }));
    const patchProposal = snapshot.patchProposals.find(
      (proposal) => proposal.assistantMessageId === message.id,
    );

    return {
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
      attachments: messageAttachments,
      citations: messageCitations,
      actions: messageActions,
      patchProposal: patchProposal
        ? {
            id: patchProposal.id,
            targetPageId: patchProposal.targetPageId,
            baseRevisionId: patchProposal.baseRevisionId,
            proposedTitle: patchProposal.proposedTitle,
            proposedContentMarkdown: patchProposal.proposedContentMarkdown,
            rationale: patchProposal.rationale,
            status: patchProposal.status,
          }
        : null,
    };
  });

  return {
    id: thread.id,
    agentKey: thread.agentKey,
    title: thread.title,
    messages,
  };
}

async function createAgentMessage(input: {
  threadId: string;
  role: "user" | "assistant";
  content: string;
}) {
  const nextMessage: AgentMessage = {
    id: randomUUID(),
    threadId: input.threadId,
    role: input.role,
    content: input.content,
    createdAt: new Date(),
  };

  if (!db) {
    fallbackStore.messages.push(nextMessage);
    const thread = fallbackStore.threads.find((candidate) => candidate.id === input.threadId);

    if (thread) {
      thread.updatedAt = new Date();
    }

    return nextMessage;
  }

  await db.insert(agentMessages).values(nextMessage);
  await db
    .update(agentThreads)
    .set({ updatedAt: new Date() })
    .where(eq(agentThreads.id, input.threadId));

  return nextMessage;
}

async function replaceMessageAttachments(
  messageId: string,
  attachments: Array<EntityReference & { sortOrder: number }>,
) {
  if (!db) {
    fallbackStore.attachments = fallbackStore.attachments.filter(
      (attachment) => attachment.messageId !== messageId,
    );
    fallbackStore.attachments.push(
      ...attachments.map((attachment) => ({
        id: randomUUID(),
        entityId: attachment.entityId,
        entityType: attachment.entityType,
        href: attachment.href,
        label: attachment.label,
        messageId,
        sortOrder: attachment.sortOrder,
      })),
    );
    return;
  }

  const existing = await db
    .select({ id: agentMessageAttachments.id })
    .from(agentMessageAttachments)
    .where(eq(agentMessageAttachments.messageId, messageId));

  if (existing.length > 0) {
    await db.delete(agentMessageAttachments).where(eq(agentMessageAttachments.messageId, messageId));
  }

  if (attachments.length === 0) {
    return;
  }

  await db.insert(agentMessageAttachments).values(
    attachments.map((attachment) => ({
      id: randomUUID(),
      messageId,
      entityId: attachment.entityId,
      entityType: attachment.entityType,
      href: attachment.href,
      label: attachment.label,
      sortOrder: attachment.sortOrder,
    })),
  );
}

async function replaceMessageCitations(messageId: string, citations: VisiblePage[]) {
  if (!db) {
    fallbackStore.citations = fallbackStore.citations.filter(
      (citation) => citation.messageId !== messageId,
    );
    fallbackStore.citations.push(
      ...citations.map((citation, index) => ({
        id: randomUUID(),
        href: `/?page=${citation.id}`,
        messageId,
        pageId: citation.id,
        pageTitle: citation.title,
        sortOrder: index,
      })),
    );
    return;
  }

  const existing = await db
    .select({ id: agentMessageCitations.id })
    .from(agentMessageCitations)
    .where(eq(agentMessageCitations.messageId, messageId));

  if (existing.length > 0) {
    await db.delete(agentMessageCitations).where(eq(agentMessageCitations.messageId, messageId));
  }

  if (citations.length === 0) {
    return;
  }

  await db.insert(agentMessageCitations).values(
    citations.map((citation, index) => ({
      id: randomUUID(),
      href: `/?page=${citation.id}`,
      messageId,
      pageId: citation.id,
      pageTitle: citation.title,
      sortOrder: index,
    })),
  );
}

async function createPatchProposal(input: {
  assistantMessageId: string;
  targetPageId: string;
  baseRevisionId: string;
  proposedTitle: string;
  proposedContentMarkdown: string;
  rationale: string;
}) {
  const now = new Date();
  const nextProposal: AgentPatchProposal = {
    id: randomUUID(),
    assistantMessageId: input.assistantMessageId,
    targetPageId: input.targetPageId,
    baseRevisionId: input.baseRevisionId,
    proposedTitle: input.proposedTitle,
    proposedContentMarkdown: input.proposedContentMarkdown,
    rationale: input.rationale,
    status: "pending",
    appliedRevisionId: null,
    createdAt: now,
    updatedAt: now,
  };

  if (!db) {
    fallbackStore.patchProposals.push(nextProposal);
    return nextProposal;
  }

  await db.insert(agentPatchProposals).values(nextProposal);
  return nextProposal;
}

async function createAction(input: {
  messageId: string;
  actionType: "apply_page_patch" | "discard_page_patch";
  label: string;
  payload: Record<string, unknown>;
  targetEntityType: "page" | null;
  targetEntityId: string | null;
}) {
  const nextAction: AgentAction = {
    id: randomUUID(),
    messageId: input.messageId,
    actionType: input.actionType,
    label: input.label,
    payload: input.payload,
    status: "pending",
    targetEntityType: input.targetEntityType,
    targetEntityId: input.targetEntityId,
    actedByUserId: null,
    outcomeMessage: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  if (!db) {
    fallbackStore.actions.push(nextAction);
    return nextAction;
  }

  await db.insert(agentActions).values(nextAction);
  return nextAction;
}

async function updatePatchProposalStatus(
  proposalId: string,
  status: "discarded",
) {
  if (!db) {
    const proposal = fallbackStore.patchProposals.find((candidate) => candidate.id === proposalId);

    if (proposal) {
      proposal.status = status;
      proposal.updatedAt = new Date();
    }
    return;
  }

  await db
    .update(agentPatchProposals)
    .set({ status, updatedAt: new Date() })
    .where(eq(agentPatchProposals.id, proposalId));
}

async function updatePatchProposalApplied(proposalId: string, appliedRevisionId: string) {
  if (!db) {
    const proposal = fallbackStore.patchProposals.find((candidate) => candidate.id === proposalId);

    if (proposal) {
      proposal.status = "applied";
      proposal.appliedRevisionId = appliedRevisionId;
      proposal.updatedAt = new Date();
    }
    return;
  }

  await db
    .update(agentPatchProposals)
    .set({
      status: "applied",
      appliedRevisionId,
      updatedAt: new Date(),
    })
    .where(eq(agentPatchProposals.id, proposalId));
}

async function updateActionStatus(
  actionId: string,
  status: "completed" | "dismissed",
  actedByUserId: string,
  outcomeMessage: string,
) {
  if (!db) {
    const action = fallbackStore.actions.find((candidate) => candidate.id === actionId);

    if (action) {
      action.status = status;
      action.actedByUserId = actedByUserId;
      action.outcomeMessage = outcomeMessage;
      action.updatedAt = new Date();
    }
    return;
  }

  await db
    .update(agentActions)
    .set({
      status,
      actedByUserId,
      outcomeMessage,
      updatedAt: new Date(),
    })
    .where(eq(agentActions.id, actionId));
}


function getProposalId(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const value = (payload as { proposalId?: unknown }).proposalId;
  return typeof value === "string" ? value : null;
}

async function generateAgentReply(input: {
  currentUser: User;
  history: AgentMessage[];
  messageContent: string;
  attachments: Array<EntityReference & { sortOrder: number }>;
  visiblePages: VisiblePage[];
}): Promise<AgentReply> {
  const openAiReply = await tryGenerateOpenAiReply(input);

  if (openAiReply) {
    return openAiReply;
  }

  return generateDeterministicReply(input);
}

async function tryGenerateOpenAiReply(input: {
  currentUser: User;
  history: AgentMessage[];
  messageContent: string;
  attachments: Array<EntityReference & { sortOrder: number }>;
  visiblePages: VisiblePage[];
}): Promise<AgentReply | null> {
  if (!openaiClient) {
    return null;
  }

  const attachmentPages = input.attachments
    .filter((attachment) => attachment.entityType === "page")
    .map((attachment) =>
      input.visiblePages.find((page) => page.id === attachment.entityId) ?? null,
    )
    .filter((page): page is VisiblePage => page !== null);
  const attachmentScopePages = getAttachmentScopePages({
    attachedPages: attachmentPages,
    visiblePages: input.visiblePages,
  });
  const candidatePages = rankCandidatePages({
    attachments: input.attachments,
    messageContent: input.messageContent,
    scopedAttachmentPages: attachmentScopePages,
    visiblePages: input.visiblePages,
  }).slice(0, 6);
  const writableTargets = attachmentPages.filter((page) =>
    canWritePage(input.currentUser, page.workspace, page),
  );

  try {
    const response = await openaiClient.responses.create({
      model: OPENAI_MODEL,
      input: buildOpenAiPrompt({
        attachmentPages,
        attachmentScopePages,
        candidatePages,
        currentUser: input.currentUser,
        history: input.history,
        messageContent: input.messageContent,
        writableTargets,
      }),
      text: {
        format: {
          type: "json_schema",
          name: "agent_reply",
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["message", "citationPageIds", "patchProposal"],
            properties: {
              message: { type: "string" },
              citationPageIds: {
                type: "array",
                items: { type: "string" },
                maxItems: 4,
              },
              patchProposal: {
                anyOf: [
                  {
                    type: "object",
                    additionalProperties: false,
                    required: [
                      "targetPageId",
                      "proposedTitle",
                      "proposedContentMarkdown",
                      "rationale",
                    ],
                    properties: {
                      targetPageId: { type: "string" },
                      proposedTitle: { type: "string" },
                      proposedContentMarkdown: { type: "string" },
                      rationale: { type: "string" },
                    },
                  },
                  { type: "null" },
                ],
              },
            },
          },
          strict: true,
        },
      },
    });

    const parsed = openAiReplySchema.parse(JSON.parse(response.output_text));
    const citationMap = new Map(candidatePages.map((page) => [page.id, page]));
    const citations = parsed.citationPageIds
      .map((pageId) => citationMap.get(pageId) ?? null)
      .filter((page): page is VisiblePage => page !== null)
      .slice(0, 4);
    const patchProposal =
      parsed.patchProposal &&
      writableTargets.some((page) => page.id === parsed.patchProposal?.targetPageId)
        ? {
            targetPage: writableTargets.find(
              (page) => page.id === parsed.patchProposal?.targetPageId,
            )!,
            proposedTitle: parsed.patchProposal.proposedTitle,
            proposedContentMarkdown: parsed.patchProposal.proposedContentMarkdown,
            rationale: parsed.patchProposal.rationale,
          }
        : null;

    return {
      content: parsed.message,
      citations,
      patchProposal,
    };
  } catch (error) {
    console.error("OpenAI agent generation failed. Falling back to local generator.", error);
    return null;
  }
}

function generateDeterministicReply(input: {
  currentUser: User;
  history: AgentMessage[];
  messageContent: string;
  attachments: Array<EntityReference & { sortOrder: number }>;
  visiblePages: VisiblePage[];
}): AgentReply {
  const attachedPages = input.attachments
    .filter((attachment) => attachment.entityType === "page")
    .map((attachment) =>
      input.visiblePages.find((page) => page.id === attachment.entityId) ?? null,
    )
    .filter((page): page is VisiblePage => page !== null);
  const attachmentScopePages = getAttachmentScopePages({
    attachedPages,
    visiblePages: input.visiblePages,
  });

  const rankedPages = rankCandidatePages({
    attachments: input.attachments,
    messageContent: input.messageContent,
    scopedAttachmentPages: attachmentScopePages,
    visiblePages: input.visiblePages,
  }).slice(0, 4);

  const citations = rankedPages.length > 0 ? rankedPages : attachedPages.slice(0, 3);
  const shouldProposePatch =
    attachedPages.length > 0 &&
    /(?:update|edit|rewrite|improve|add|expand|patch|revise|change)/i.test(input.messageContent);
  const writableTarget =
    attachedPages.find((page) => canWritePage(input.currentUser, page.workspace, page)) ?? null;
  const patchProposal =
    shouldProposePatch && writableTarget
      ? {
          targetPage: writableTarget,
          proposedTitle: writableTarget.title,
          proposedContentMarkdown: buildPatchedContent(
            writableTarget.currentContentMarkdown,
            input.messageContent,
            citations,
          ),
          rationale:
            "Drafted from the attached page context and the most relevant visible pages for this request.",
        }
      : null;

  const content = buildAssistantContent({
    citations,
    currentUserName: input.currentUser.name,
    messageContent: input.messageContent,
    patchProposal,
  });

  return { content, citations, patchProposal };
}

function rankCandidatePages(input: {
  attachments: Array<EntityReference & { sortOrder: number }>;
  messageContent: string;
  scopedAttachmentPages: VisiblePage[];
  visiblePages: VisiblePage[];
}) {
  const normalizedQuery = normalizeSearchText(input.messageContent);
  const attachedIds = new Set(
    input.attachments
      .filter((attachment) => attachment.entityType === "page")
      .map((attachment) => attachment.entityId),
  );
  const scopedAttachmentIds = new Set(input.scopedAttachmentPages.map((page) => page.id));

  return input.visiblePages
    .map((page) => {
      const body = normalizeSearchText(page.currentContentMarkdown);
      let score = 0;

      if (attachedIds.has(page.id)) {
        score += 500;
      }

      if (!attachedIds.has(page.id) && scopedAttachmentIds.has(page.id)) {
        score += 220;
      }

      if (normalizedQuery.length > 0 && normalizeSearchText(page.title).includes(normalizedQuery)) {
        score += 160;
      }

      if (normalizedQuery.length > 0 && body.includes(normalizedQuery)) {
        score += 70;
      }

      for (const token of normalizedQuery.split(" ").filter(Boolean)) {
        if (token.length < 3) {
          continue;
        }

        if (normalizeSearchText(page.title).includes(token)) {
          score += 25;
        }

        if (body.includes(token)) {
          score += 12;
        }
      }

      return { page, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.page.title.localeCompare(b.page.title))
    .map((entry) => entry.page);
}

function buildOpenAiPrompt(input: {
  attachmentPages: VisiblePage[];
  attachmentScopePages: VisiblePage[];
  candidatePages: VisiblePage[];
  currentUser: User;
  history: AgentMessage[];
  messageContent: string;
  writableTargets: VisiblePage[];
}) {
  const historySection = input.history
    .slice(-8)
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join("\n");
  const attachmentSection =
    input.attachmentPages.length > 0
      ? input.attachmentPages
          .map(
            (page) =>
              `- ${page.id} | ${page.title} | workspace=${page.workspace.type} | excerpt=${getExcerpt(page.currentContentMarkdown, input.messageContent)}`,
          )
          .join("\n")
      : "None";
  const attachmentScopeSection =
    input.attachmentScopePages.length > 0
      ? input.attachmentScopePages
          .map(
            (page) =>
              `- ${page.id} | ${page.title} | parent=${page.parentPageId ?? "root"} | depth=${page.depth}`,
          )
          .join("\n")
      : "None";
  const candidateSection =
    input.candidatePages.length > 0
      ? input.candidatePages
          .map(
            (page) =>
              [
                `Page ID: ${page.id}`,
                `Title: ${page.title}`,
                `Workspace: ${page.workspace.type}`,
                `Readable by user: yes`,
                `Writable by user: ${canWritePage(input.currentUser, page.workspace, page) ? "yes" : "no"}`,
                `Content: ${page.currentContentMarkdown}`,
              ].join("\n"),
          )
          .join("\n\n---\n\n")
      : "No candidate pages found.";
  const writableSection =
    input.writableTargets.length > 0
      ? input.writableTargets.map((page) => `${page.id} | ${page.title}`).join("\n")
      : "None";

  return [
    "You are the SHVR Research Agent embedded inside a knowledge-base product.",
    "Respond with concise, company-grounded reasoning. Never claim you used knowledge that was not provided.",
    "Citations must only reference candidate page IDs provided below.",
    "Only return a patchProposal when the user is clearly asking to change knowledge content and the target page is writable.",
    "If you return a patchProposal, targetPageId must be one of the writable page IDs listed below.",
    "",
    `Active user: ${input.currentUser.name}`,
    `Current request: ${input.messageContent}`,
    "",
    "Recent conversation:",
    historySection || "None",
    "",
    "Attached pages:",
    attachmentSection,
    "",
    "Readable subtree scope derived from attached pages:",
    attachmentScopeSection,
    "",
    "Writable attached pages:",
    writableSection,
    "",
    "Candidate source pages:",
    candidateSection,
  ].join("\n");
}

function getAttachmentScopePages(input: {
  attachedPages: VisiblePage[];
  visiblePages: VisiblePage[];
}) {
  if (input.attachedPages.length === 0) {
    return [];
  }

  const attachedById = new Map(input.attachedPages.map((page) => [page.id, page]));
  const visibleById = new Map(input.visiblePages.map((page) => [page.id, page]));
  const scopedPages = new Map<string, VisiblePage>();

  for (const attachedPage of input.attachedPages) {
    scopedPages.set(attachedPage.id, attachedPage);
  }

  for (const page of input.visiblePages) {
    let currentParentId = page.parentPageId;
    let distance = 1;

    while (currentParentId && distance <= ATTACHED_SUBTREE_MAX_DEPTH) {
      if (attachedById.has(currentParentId)) {
        scopedPages.set(page.id, page);
        break;
      }

      currentParentId = visibleById.get(currentParentId)?.parentPageId ?? null;
      distance += 1;
    }

    if (scopedPages.size >= ATTACHED_SUBTREE_MAX_PAGES) {
      break;
    }
  }

  return Array.from(scopedPages.values()).slice(0, ATTACHED_SUBTREE_MAX_PAGES);
}

function buildAssistantContent(input: {
  citations: VisiblePage[];
  currentUserName: string;
  messageContent: string;
  patchProposal: AgentReply["patchProposal"];
}) {
  if (input.citations.length === 0) {
    return [
      `I couldn't find strong supporting context for "${input.messageContent.trim()}".`,
      "Try attaching a page or using more SHVR-specific terms so I can ground the response in the current knowledge base.",
    ].join("\n\n");
  }

  const summaryLines = input.citations.map((page) => {
    const excerpt = getExcerpt(page.currentContentMarkdown, input.messageContent);
    return `- **${page.title}**: ${excerpt}`;
  });

  const closing = input.patchProposal
    ? "I also prepared a proposed page patch for the attached page. Review the action buttons below if you want to apply or discard it."
    : "If you want, attach a page and ask me to revise it, and I can prepare a patch proposal for approval.";

  return [
    `Grounded response for ${input.currentUserName}:`,
    summaryLines.join("\n"),
    closing,
  ].join("\n\n");
}

function buildPatchedContent(
  currentContentMarkdown: string,
  userPrompt: string,
  citations: VisiblePage[],
) {
  const evidence = citations
    .map((page) => `- ${page.title}: ${getExcerpt(page.currentContentMarkdown, userPrompt)}`)
    .join("\n");

  return [
    currentContentMarkdown.trim(),
    "",
    "## Agent proposal",
    `Request: ${userPrompt.trim()}`,
    "",
    "### Supporting context",
    evidence || "- No additional supporting context found.",
    "",
    "### Suggested update",
    "Refine this page using the supporting context above. Adjust the wording before applying if you want a more opinionated version.",
  ]
    .filter(Boolean)
    .join("\n");
}

function getExcerpt(contentMarkdown: string, query: string) {
  const normalizedContent = stripMarkdown(contentMarkdown);
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedContent) {
    return "No excerpt available.";
  }

  const loweredContent = normalizedContent.toLowerCase();
  const loweredQuery = normalizedQuery.toLowerCase();
  const startIndex = loweredQuery ? loweredContent.indexOf(loweredQuery) : -1;

  if (startIndex === -1) {
    return normalizedContent.slice(0, 180).trim();
  }

  const start = Math.max(0, startIndex - 60);
  const end = Math.min(normalizedContent.length, startIndex + loweredQuery.length + 120);
  return `${start > 0 ? "..." : ""}${normalizedContent.slice(start, end).trim()}${end < normalizedContent.length ? "..." : ""}`;
}

function normalizeSearchText(value: string) {
  return stripMarkdown(value).toLowerCase().replace(/\s+/g, " ").trim();
}

function stripMarkdown(value: string) {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/[*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
