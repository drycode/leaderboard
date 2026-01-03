/**
 * Calculate what-if scenarios for a player's potential final ranking.
 *
 * @param {Object} selectedPlayer - The player to calculate for { email, score, name }
 * @param {Array} players - All players [{ email, score, name }, ...]
 * @param {Array} myAnswers - Player's answers [{ official_answer, user_answer }, ...]
 * @returns {Object|null} What-if calculation results or null if not applicable
 */
export const calculateWhatIf = (selectedPlayer, players, myAnswers) => {
  if (!selectedPlayer || !myAnswers || !players.length) {
    return null;
  }

  // Find unanswered questions (where official_answer is empty/null but user has answered)
  const unansweredQuestions = myAnswers.filter(a => !a.official_answer && a.user_answer);

  if (unansweredQuestions.length === 0) {
    return null; // All questions answered, no predictions to make
  }

  // Calculate potential points from unanswered questions
  // Assume 1 point per question (since we don't know the multipliers yet)
  const potentialPoints = unansweredQuestions.length;

  const currentScore = selectedPlayer.score;
  const bestCaseScore = currentScore + potentialPoints;
  const worstCaseScore = currentScore; // No more points

  // BEST CASE: I get all points, others get none
  // My rank = 1 + count of players with score > my best score
  let bestCaseRank = 1;
  for (const p of players) {
    if (p.email !== selectedPlayer.email && p.score > bestCaseScore) {
      bestCaseRank++;
    }
  }

  // CURRENT: My rank in current standings
  let currentRank = 1;
  for (const p of players) {
    if (p.email !== selectedPlayer.email && p.score > currentScore) {
      currentRank++;
    }
  }

  // WORST CASE: I get 0 points, others ALL get max points
  // Assume every other player could gain potentialPoints
  let worstCaseRank = 1;
  for (const p of players) {
    if (p.email !== selectedPlayer.email) {
      const otherBestScore = p.score + potentialPoints;
      if (otherBestScore > worstCaseScore) {
        worstCaseRank++;
      }
    }
  }

  return {
    unansweredCount: unansweredQuestions.length,
    potentialPoints,
    currentScore,
    bestCaseScore,
    worstCaseScore,
    currentRank,
    bestCaseRank,
    worstCaseRank,
    totalPlayers: players.length,
  };
};
