import { calculateWhatIf } from './calculateWhatIf';

describe('calculateWhatIf', () => {
  // Helper to create a player
  const player = (email, score) => ({ email, score, name: email });

  // Helper to create an answer
  const answered = (official, user) => ({ official_answer: official, user_answer: user });
  const unanswered = (user) => ({ official_answer: null, user_answer: user });

  describe('returns null for invalid inputs', () => {
    it('returns null when selectedPlayer is null', () => {
      const players = [player('a@test.com', 10)];
      const answers = [unanswered('Yes')];
      expect(calculateWhatIf(null, players, answers)).toBeNull();
    });

    it('returns null when myAnswers is null', () => {
      const selectedPlayer = player('a@test.com', 10);
      const players = [selectedPlayer];
      expect(calculateWhatIf(selectedPlayer, players, null)).toBeNull();
    });

    it('returns null when players array is empty', () => {
      const selectedPlayer = player('a@test.com', 10);
      const answers = [unanswered('Yes')];
      expect(calculateWhatIf(selectedPlayer, [], answers)).toBeNull();
    });

    it('returns null when all questions are answered', () => {
      const selectedPlayer = player('a@test.com', 10);
      const players = [selectedPlayer];
      const answers = [answered('Yes', 'Yes'), answered('No', 'No')];
      expect(calculateWhatIf(selectedPlayer, players, answers)).toBeNull();
    });
  });

  describe('calculates unanswered questions correctly', () => {
    it('counts only questions with user answer but no official answer', () => {
      const selectedPlayer = player('a@test.com', 5);
      const players = [selectedPlayer];
      const answers = [
        answered('Yes', 'Yes'),      // answered - not counted
        unanswered('No'),             // unanswered - counted
        unanswered('Maybe'),          // unanswered - counted
        { official_answer: null, user_answer: null }, // no user answer - not counted
      ];

      const result = calculateWhatIf(selectedPlayer, players, answers);
      expect(result.unansweredCount).toBe(2);
      expect(result.potentialPoints).toBe(2);
    });
  });

  describe('best case rank calculation', () => {
    it('returns rank 1 when best case score beats everyone', () => {
      const selectedPlayer = player('me@test.com', 5);
      const players = [
        selectedPlayer,
        player('other1@test.com', 10),
        player('other2@test.com', 8),
      ];
      const answers = [
        unanswered('Yes'),
        unanswered('Yes'),
        unanswered('Yes'),
        unanswered('Yes'),
        unanswered('Yes'),
        unanswered('Yes'), // 6 unanswered = 6 potential points
      ];

      const result = calculateWhatIf(selectedPlayer, players, answers);
      // Best case: 5 + 6 = 11, beats 10 and 8
      expect(result.bestCaseScore).toBe(11);
      expect(result.bestCaseRank).toBe(1);
    });

    it('returns correct rank when some players still ahead in best case', () => {
      const selectedPlayer = player('me@test.com', 5);
      const players = [
        selectedPlayer,
        player('leader@test.com', 20), // Will still be ahead
        player('other@test.com', 8),   // Also still ahead
      ];
      const answers = [unanswered('Yes'), unanswered('Yes')]; // 2 potential points

      const result = calculateWhatIf(selectedPlayer, players, answers);
      // Best case: 5 + 2 = 7, still behind 20 AND 8, so rank 3
      expect(result.bestCaseScore).toBe(7);
      expect(result.bestCaseRank).toBe(3);
    });
  });

  describe('current rank calculation', () => {
    it('calculates current rank correctly', () => {
      const selectedPlayer = player('me@test.com', 5);
      const players = [
        player('leader@test.com', 10),
        player('second@test.com', 8),
        selectedPlayer,
        player('behind@test.com', 3),
      ];
      const answers = [unanswered('Yes')];

      const result = calculateWhatIf(selectedPlayer, players, answers);
      // Current: 5 pts, behind 10 and 8, so rank 3
      expect(result.currentRank).toBe(3);
    });
  });

  describe('worst case rank calculation', () => {
    it('assumes all other players gain max points', () => {
      const selectedPlayer = player('me@test.com', 10);
      const players = [
        selectedPlayer,
        player('other1@test.com', 5),
        player('other2@test.com', 3),
      ];
      const answers = [unanswered('Yes'), unanswered('Yes')]; // 2 potential points

      const result = calculateWhatIf(selectedPlayer, players, answers);
      // Worst case: I stay at 10, others get +2 each
      // other1: 5 + 2 = 7 (still behind me)
      // other2: 3 + 2 = 5 (still behind me)
      // So I'm still rank 1 in this case
      expect(result.worstCaseRank).toBe(1);
    });

    it('drops to last place when others can all surpass', () => {
      const selectedPlayer = player('me@test.com', 2);
      const players = [
        selectedPlayer,
        player('other1@test.com', 1),
        player('other2@test.com', 1),
        player('other3@test.com', 1),
      ];
      const answers = Array(10).fill(null).map(() => unanswered('Yes')); // 10 potential points

      const result = calculateWhatIf(selectedPlayer, players, answers);
      // Worst case: I stay at 2, others each get +10 = 11
      // All 3 others beat my 2, so I'm rank 4 (last)
      expect(result.worstCaseRank).toBe(4);
      expect(result.totalPlayers).toBe(4);
    });

    it('calculates correct rank with mixed outcomes', () => {
      const selectedPlayer = player('me@test.com', 5);
      const players = [
        selectedPlayer,
        player('way_ahead@test.com', 50),  // Already ahead, will stay ahead
        player('slightly_behind@test.com', 4), // Behind, but will pass me
        player('way_behind@test.com', 1),      // Behind, will pass me
      ];
      const answers = Array(5).fill(null).map(() => unanswered('Yes')); // 5 potential points

      const result = calculateWhatIf(selectedPlayer, players, answers);
      // Worst case: I stay at 5
      // way_ahead: 50 + 5 = 55 > 5, rank++
      // slightly_behind: 4 + 5 = 9 > 5, rank++
      // way_behind: 1 + 5 = 6 > 5, rank++
      // All 3 others beat me, so I'm rank 4
      expect(result.worstCaseRank).toBe(4);
    });
  });

  describe('edge cases', () => {
    it('handles single player correctly', () => {
      const selectedPlayer = player('only@test.com', 5);
      const players = [selectedPlayer];
      const answers = [unanswered('Yes')];

      const result = calculateWhatIf(selectedPlayer, players, answers);
      expect(result.bestCaseRank).toBe(1);
      expect(result.currentRank).toBe(1);
      expect(result.worstCaseRank).toBe(1);
    });

    it('handles tied scores correctly for current rank', () => {
      const selectedPlayer = player('me@test.com', 5);
      const players = [
        selectedPlayer,
        player('tied@test.com', 5),
        player('also_tied@test.com', 5),
      ];
      const answers = [unanswered('Yes')];

      const result = calculateWhatIf(selectedPlayer, players, answers);
      // All at 5 points - current rank should be 1 (no one ahead)
      expect(result.currentRank).toBe(1);
    });

    it('handles single unanswered question', () => {
      const selectedPlayer = player('me@test.com', 10);
      const players = [
        selectedPlayer,
        player('other@test.com', 10),
      ];
      const answers = [unanswered('Yes')];

      const result = calculateWhatIf(selectedPlayer, players, answers);
      expect(result.unansweredCount).toBe(1);
      expect(result.potentialPoints).toBe(1);
      expect(result.bestCaseScore).toBe(11);
    });

    it('treats empty string official_answer as unanswered', () => {
      const selectedPlayer = player('me@test.com', 5);
      const players = [selectedPlayer];
      const answers = [
        { official_answer: '', user_answer: 'Yes' },  // empty string = unanswered
        { official_answer: null, user_answer: 'No' }, // null = unanswered
      ];

      const result = calculateWhatIf(selectedPlayer, players, answers);
      expect(result.unansweredCount).toBe(2);
    });

    it('ignores questions where user has not answered', () => {
      const selectedPlayer = player('me@test.com', 5);
      const players = [selectedPlayer];
      const answers = [
        { official_answer: null, user_answer: '' },    // empty user answer
        { official_answer: null, user_answer: null },  // null user answer
        { official_answer: null, user_answer: 'Yes' }, // valid unanswered
      ];

      const result = calculateWhatIf(selectedPlayer, players, answers);
      // Only the last one should count
      expect(result.unansweredCount).toBe(1);
    });

    it('handles worst case ties (others can only tie, not beat)', () => {
      const selectedPlayer = player('me@test.com', 5);
      const players = [
        selectedPlayer,
        player('other@test.com', 4),
      ];
      const answers = [unanswered('Yes')]; // 1 potential point

      const result = calculateWhatIf(selectedPlayer, players, answers);
      // Worst case: I stay at 5, other gets 4+1=5 (ties me)
      // Tie doesn't beat me, so I stay rank 1
      expect(result.worstCaseRank).toBe(1);
    });

    it('handles best case ties with others', () => {
      const selectedPlayer = player('me@test.com', 5);
      const players = [
        selectedPlayer,
        player('other@test.com', 7),
      ];
      const answers = [unanswered('Yes'), unanswered('Yes')]; // 2 potential points

      const result = calculateWhatIf(selectedPlayer, players, answers);
      // Best case: 5 + 2 = 7, ties with other's 7
      // Tie doesn't put me ahead, so other still counts as "not behind"
      // But rank calculation uses >, so tie means I'm rank 1 (tied)
      expect(result.bestCaseRank).toBe(1);
    });

    it('handles selected player not found in players array', () => {
      const selectedPlayer = player('ghost@test.com', 5);
      const players = [
        player('other1@test.com', 10),
        player('other2@test.com', 8),
      ];
      const answers = [unanswered('Yes')];

      // Function should still calculate, treating selected player as separate
      const result = calculateWhatIf(selectedPlayer, players, answers);
      expect(result.currentRank).toBe(3); // Behind both others
      expect(result.worstCaseRank).toBe(3); // Still behind when others gain
    });
  });
});
