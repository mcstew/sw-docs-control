/**
 * Proposal storage — persists edit proposals to a JSON file.
 */

import fs from 'fs/promises';
import path from 'path';
import type { EditProposal } from './improve-agent';

const PROPOSALS_FILE = path.join(process.cwd(), 'data', 'proposals.json');

async function loadProposals(): Promise<EditProposal[]> {
  try {
    const data = await fs.readFile(PROPOSALS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function saveProposals(proposals: EditProposal[]): Promise<void> {
  const dir = path.dirname(PROPOSALS_FILE);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(PROPOSALS_FILE, JSON.stringify(proposals, null, 2), 'utf-8');
}

export async function addProposals(newProposals: EditProposal[]): Promise<void> {
  const existing = await loadProposals();
  existing.push(...newProposals);
  await saveProposals(existing);
}

export async function getProposals(status?: string): Promise<EditProposal[]> {
  const proposals = await loadProposals();
  if (status) return proposals.filter((p) => p.status === status);
  return proposals;
}

export async function updateProposalStatus(
  id: string,
  status: 'approved' | 'rejected' | 'applied'
): Promise<EditProposal | null> {
  const proposals = await loadProposals();
  const proposal = proposals.find((p) => p.id === id);
  if (!proposal) return null;
  proposal.status = status;
  await saveProposals(proposals);
  return proposal;
}
