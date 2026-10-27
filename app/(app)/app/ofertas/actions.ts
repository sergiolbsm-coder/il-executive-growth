"use server";

import { revalidatePath } from "next/cache";
import { checkGate, confirmGate, createOffer, recordSale, removeSale, setOfferStatus, uncheckGate, updateOffer } from "@/domains/offers/service";
import { ForbiddenError } from "@/lib/authorization";
import { requireUser, toContext } from "@/lib/auth/session";
import { ValidationError } from "@/lib/errors";
import { parseBRLToCents } from "@/lib/format";

export type OfferState = { error?: string; ok?: string } | undefined;

async function guard(fn: () => Promise<unknown>, ok?: string): Promise<OfferState> {
  try {
    await fn();
    return ok ? { ok } : undefined;
  } catch (e) {
    if (e instanceof ValidationError || e instanceof ForbiddenError) return { error: e.message };
    throw e;
  }
}

const s = (f: FormData, k: string) => String(f.get(k) ?? "");
const optInt = (v: string) => (v.trim() === "" ? null : Number(v));

function refresh(offerId: string, programId?: string) {
  revalidatePath(`/app/ofertas/${offerId}`);
  revalidatePath("/app/ofertas");
  if (programId) revalidatePath(`/app/programas/${programId}`);
}

export async function createOfferAction(programId: string, _: OfferState, f: FormData): Promise<OfferState> {
  const actor = toContext(await requireUser());
  const r = await guard(() =>
    createOffer(actor, programId, {
      revenueSlug: s(f, "revenueSlug"), name: s(f, "name"), problem: s(f, "problem"), audience: s(f, "audience"),
      priceNote: s(f, "priceNote"), wave: optInt(s(f, "wave")), dueDate: s(f, "dueDate") || null,
      targetStage: s(f, "targetStage") ? Number(s(f, "targetStage")) : undefined,
    }),
    "Oferta criada em Ideia.");
  revalidatePath(`/app/programas/${programId}`);
  revalidatePath("/app/ofertas");
  return r;
}

export async function updateOfferAction(offerId: string, _: OfferState, f: FormData): Promise<OfferState> {
  const actor = toContext(await requireUser());
  const r = await guard(() =>
    updateOffer(actor, offerId, {
      name: s(f, "name"), problem: s(f, "problem"), audience: s(f, "audience"), priceNote: s(f, "priceNote"),
      level: Number(s(f, "level")), wave: optInt(s(f, "wave")), dueDate: s(f, "dueDate") || null, targetStage: Number(s(f, "targetStage")),
    }),
    "Oferta atualizada.");
  refresh(offerId);
  return r;
}

export async function setStatusAction(offerId: string, _: OfferState, f: FormData): Promise<OfferState> {
  const actor = toContext(await requireUser());
  const r = await guard(() => setOfferStatus(actor, offerId, s(f, "status") as "ativa" | "pausada" | "descartada", s(f, "reason")), "Situação atualizada.");
  refresh(offerId);
  return r;
}

export async function checkGateAction(offerId: string, gateKey: string, _: OfferState, f: FormData): Promise<OfferState> {
  const actor = toContext(await requireUser());
  const r = await guard(() => checkGate(actor, offerId, gateKey, s(f, "evidence")));
  refresh(offerId);
  return r;
}

export async function confirmGateAction(offerId: string, gateKey: string): Promise<OfferState> {
  const actor = toContext(await requireUser());
  const r = await guard(() => confirmGate(actor, offerId, gateKey));
  refresh(offerId);
  return r;
}

export async function uncheckGateAction(offerId: string, gateKey: string): Promise<OfferState> {
  const actor = toContext(await requireUser());
  const r = await guard(() => uncheckGate(actor, offerId, gateKey));
  refresh(offerId);
  return r;
}

export async function recordSaleAction(offerId: string, _: OfferState, f: FormData): Promise<OfferState> {
  const actor = toContext(await requireUser());
  const cents = parseBRLToCents(s(f, "value"));
  if (cents === null) return { error: "Informe o valor em reais (ex.: 2.500,00)." };
  const r = await guard(() =>
    recordSale(actor, offerId, {
      clientName: s(f, "clientName"), valueCents: cents, soldAt: s(f, "soldAt"), channel: s(f, "channel"),
      originOfferId: s(f, "originOfferId") || null, notes: s(f, "notes"),
    }),
    "Venda registrada.");
  refresh(offerId);
  return r;
}

export async function removeSaleAction(offerId: string, saleId: string): Promise<OfferState> {
  const actor = toContext(await requireUser());
  const r = await guard(() => removeSale(actor, saleId));
  refresh(offerId);
  return r;
}
