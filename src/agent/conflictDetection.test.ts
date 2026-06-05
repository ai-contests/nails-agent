import { expect, test } from 'bun:test';
import {
  detectProposalConflicts,
  type ConflictProposalSummary,
} from './operationRules.ts';

const status = (
  proposalId: string,
  changes: { styleId: string; newStatus: 'listed' | 'candidate' }[],
): ConflictProposalSummary => ({
  proposalId,
  proposalType: changes[0]?.newStatus === 'listed' ? 'list_candidate' : 'unlist_to_candidate',
  statusChanges: changes,
});

const adj = (
  proposalId: string,
  changes: { styleId: string; action: 'promote' | 'demote'; targetRank?: number }[],
): ConflictProposalSummary => ({
  proposalId,
  proposalType: 'adjust_recommendation',
  recommendationChanges: changes.map(c => ({ ...c, reason: 'test' })),
});

test('no conflicts → empty result', () => {
  const result = detectProposalConflicts([
    status('P1', [{ styleId: 'A', newStatus: 'listed' }]),
    adj('P2', [{ styleId: 'B', action: 'promote' }]),
  ]);
  expect(result.conflicts).toEqual([]);
  expect(result.rejectedProposalIds.size).toBe(0);
});

test('list + unlist same style → rejected, later one rejected', () => {
  const result = detectProposalConflicts([
    status('P1', [{ styleId: 'A', newStatus: 'listed' }]),
    status('P2', [{ styleId: 'A', newStatus: 'candidate' }]),
  ]);
  expect(result.conflicts.length).toBe(1);
  expect(result.conflicts[0]!.type).toBe('status_self_contradiction');
  expect(result.rejectedProposalIds.has('P2')).toBe(true);
  expect(result.rejectedProposalIds.has('P1')).toBe(false);
});

test('unlist + promote same style → promote rejected', () => {
  const result = detectProposalConflicts([
    status('P1', [{ styleId: 'A', newStatus: 'candidate' }]),
    adj('P2', [{ styleId: 'A', action: 'promote', targetRank: 3 }]),
  ]);
  expect(result.conflicts[0]!.type).toBe('status_vs_recommendation');
  expect(result.rejectedProposalIds.has('P2')).toBe(true);
  expect(result.rejectedProposalIds.has('P1')).toBe(false);
});

test('promote + demote same style across proposals → later rejected', () => {
  const result = detectProposalConflicts([
    adj('P1', [{ styleId: 'A', action: 'promote' }]),
    adj('P2', [{ styleId: 'A', action: 'demote' }]),
  ]);
  expect(result.conflicts[0]!.type).toBe('rank_direction_clash');
  expect(result.rejectedProposalIds.has('P2')).toBe(true);
});

test('duplicate list_candidate proposals for same style → all but first rejected', () => {
  const result = detectProposalConflicts([
    status('P1', [{ styleId: 'A', newStatus: 'listed' }]),
    status('P2', [{ styleId: 'A', newStatus: 'listed' }]),
    status('P3', [{ styleId: 'A', newStatus: 'listed' }]),
  ]);
  expect(result.conflicts[0]!.type).toBe('duplicate_target');
  expect(result.rejectedProposalIds.size).toBe(2);
  expect(result.rejectedProposalIds.has('P1')).toBe(false);
  expect(result.rejectedProposalIds.has('P2')).toBe(true);
  expect(result.rejectedProposalIds.has('P3')).toBe(true);
});

test('multiple conflicts in one batch are all reported', () => {
  const result = detectProposalConflicts([
    status('P1', [{ styleId: 'A', newStatus: 'listed' }]),
    status('P2', [{ styleId: 'A', newStatus: 'candidate' }]),
    adj('P3', [{ styleId: 'B', action: 'promote' }]),
    adj('P4', [{ styleId: 'B', action: 'demote' }]),
  ]);
  expect(result.conflicts.length).toBe(2);
  expect(result.rejectedProposalIds.has('P2')).toBe(true);
  expect(result.rejectedProposalIds.has('P4')).toBe(true);
});

test('different styles → no conflict even if same direction', () => {
  const result = detectProposalConflicts([
    status('P1', [{ styleId: 'A', newStatus: 'listed' }]),
    status('P2', [{ styleId: 'B', newStatus: 'listed' }]),
  ]);
  expect(result.conflicts.length).toBe(0);
  expect(result.rejectedProposalIds.size).toBe(0);
});

test('multi-target proposal: one of its targets conflicts → entire proposal rejected', () => {
  const result = detectProposalConflicts([
    status('P1', [
      { styleId: 'A', newStatus: 'listed' },
      { styleId: 'B', newStatus: 'listed' },
    ]),
    status('P2', [{ styleId: 'A', newStatus: 'candidate' }]),
  ]);
  // Conflict on A → reject P2 (later)
  expect(result.rejectedProposalIds.has('P2')).toBe(true);
  expect(result.rejectedProposalIds.has('P1')).toBe(false);
});
