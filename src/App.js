import { useEffect, useState, useRef, useCallback } from "react";
import "./FocusedDesign.css";
import React from "react";

// API endpoints
const API_BASE_URL =
  process.env.REACT_APP_API_URL ||
  "https://ghqw1wy2td.execute-api.us-east-1.amazonaws.com/prod";
const WEBSOCKET_URL =
  process.env.REACT_APP_WS_URL ||
  "wss://pg0vf88roi.execute-api.us-east-1.amazonaws.com/prod";

// Fetch initial scores via REST API
const fetchInitialData = async () => {
  const response = await fetch(`${API_BASE_URL}/scores`);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
};

// Fetch user's answers
const fetchUserAnswers = async (email) => {
  const response = await fetch(`${API_BASE_URL}/answers?email=${encodeURIComponent(email)}`);
  if (!response.ok) {
    if (response.status === 404) {
      return null; // User not found
    }
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
};

// WebSocket connection hook
const useWebSocket = (url, onMessage) => {
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    console.log("Connecting to WebSocket...");
    const ws = new WebSocket(url);

    ws.onopen = () => {
      console.log("WebSocket connected");
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "update") {
          onMessage(data);
        }
      } catch (err) {
        console.error("Failed to parse WebSocket message:", err);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    ws.onclose = (event) => {
      console.log("WebSocket closed:", event.code, event.reason);
      setIsConnected(false);
      wsRef.current = null;

      // Reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log("Attempting to reconnect...");
        connect();
      }, 3000);
    };

    wsRef.current = ws;
  }, [url, onMessage]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { isConnected, ws: wsRef.current };
};

// Compute standard competition ranks with tie counts
// Example: scores [10, 8, 8, 5] -> Map { 10 => {rank: 1, tieCount: 1}, 8 => {rank: 2, tieCount: 2}, 5 => {rank: 4, tieCount: 1} }
const computeRanks = (players) => {
  const scoreCounts = {};
  players.forEach((p) => {
    scoreCounts[p.score] = (scoreCounts[p.score] || 0) + 1;
  });

  const uniqueScores = [...new Set(players.map((p) => p.score))].sort(
    (a, b) => b - a
  );

  const rankMap = new Map();
  let currentRank = 1;
  uniqueScores.forEach((score) => {
    const count = scoreCounts[score];
    rankMap.set(score, { rank: currentRank, tieCount: count });
    currentRank += count; // Skip ranks for ties
  });

  return rankMap;
};

// Format time ago for questions
const formatTimeAgo = (timestamp) => {
  if (!timestamp) return "";
  const now = Date.now();
  const diff = Math.floor((now - parseInt(timestamp)) / 1000);

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

// Trend indicator component
const TrendIndicator = ({ trend, className = "" }) => {
  if (!trend) return <span className={`focused-trend same ${className}`}>—</span>;

  const { direction, change } = trend;

  if (direction === "up") {
    return <span className={`focused-trend up ${className}`}>▲{change}</span>;
  }
  if (direction === "down") {
    return <span className={`focused-trend down ${className}`}>▼{change}</span>;
  }
  return <span className={`focused-trend same ${className}`}>—</span>;
};

// Expandable Section component
const ExpandableSection = ({ title, meta, children, defaultExpanded = false }) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className={`focused-section ${expanded ? "expanded" : ""}`}>
      <div
        className="focused-section-header"
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
        onKeyPress={(e) => {
          if (e.key === "Enter" || e.key === " ") setExpanded(!expanded);
        }}
      >
        <span className="focused-section-title">{title}</span>
        {meta && <span className="focused-section-meta">{meta}</span>}
        <span className="focused-section-arrow">▼</span>
      </div>
      <div className="focused-section-content">{children}</div>
    </div>
  );
};

// Check if on mobile (matches CSS breakpoint)
const isMobile = () => window.innerWidth <= 480;

function App() {
  const [players, setPlayers] = useState([]);
  const [trends, setTrends] = useState({});
  const [latestQuestions, setQuestions] = useState([]);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef(null);
  const [myAnswers, setMyAnswers] = useState(null);
  const [answersLoading, setAnswersLoading] = useState(false);

  // Selected player (persisted to localStorage)
  const [selectedEmail, setSelectedEmail] = useState(
    () => localStorage.getItem("selectedEmail")
  );

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((data) => {
    if (data.scores) {
      setPlayers(data.scores);
    }
    if (data.questions) {
      setQuestions(data.questions);
    }
    if (data.trends) {
      setTrends(data.trends);
    }
    if (data.events && data.events.length > 0) {
      // Prepend new events and keep last 20
      setEvents((prev) => [...data.events, ...prev].slice(0, 20));
    }
  }, []);

  // Connect to WebSocket
  const { isConnected } = useWebSocket(WEBSOCKET_URL, handleWebSocketMessage);

  // Fetch initial data on mount
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);
        const data = await fetchInitialData();
        setPlayers(data.scores || []);
        setQuestions(data.questions || []);
        setTrends(data.trends || {});
        setError(null);
      } catch (err) {
        console.error("Failed to fetch initial data:", err);
        setError("Failed to load leaderboard data");
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, []);

  // Handle player selection
  const handlePlayerSelect = (email) => {
    setSelectedEmail(email);
    localStorage.setItem("selectedEmail", email);
  };

  // Handle clearing selection
  const handleClearSelection = () => {
    setSelectedEmail(null);
    localStorage.removeItem("selectedEmail");
  };

  // Load answers when selected player changes
  useEffect(() => {
    if (!selectedEmail) {
      setMyAnswers(null);
      return;
    }

    const loadAnswers = async () => {
      setAnswersLoading(true);
      try {
        const data = await fetchUserAnswers(selectedEmail);
        setMyAnswers(data?.answers || null);
      } catch (err) {
        console.error("Failed to fetch answers:", err);
        setMyAnswers(null);
      } finally {
        setAnswersLoading(false);
      }
    };
    loadAnswers();
  }, [selectedEmail]);

  // Filter players by search query
  const filteredPlayers = searchQuery
    ? players.filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : players;

  // Compute ranks once for all players
  const rankMap = computeRanks(players);

  // Find selected player and their rank
  const selectedPlayer = players.find((p) => p.email === selectedEmail);
  const selectedRankInfo = selectedPlayer ? rankMap.get(selectedPlayer.score) : null;
  const selectedRank = selectedRankInfo?.rank ?? null;
  const selectedTieCount = selectedRankInfo?.tieCount ?? 1;
  const selectedTrend = selectedEmail ? trends[selectedEmail] : null;

  // Sort questions by most recent, filter out unanswered
  const sortedQuestions = [...latestQuestions]
    .filter((q) => q.answer)
    .sort((a, b) => parseInt(b.updated) - parseInt(a.updated))
    .slice(0, 10);

  return (
    <div className="focused-app">
      <div className="focused-container">
        {/* Header */}
        <div className="focused-header">
          <span className="focused-title">Super Bowl LIX</span>
          <div className="focused-header-right">
            <div className={`focused-live ${isConnected ? "" : "disconnected"}`}>
              <span className="focused-live-dot"></span>
              {isConnected ? "Live" : "Reconnecting..."}
            </div>
          </div>
        </div>

        {error && <div className="focused-error">{error}</div>}

        {loading ? (
          <div className="focused-loading">Loading leaderboard...</div>
        ) : (
          <>
            {/* Hero Rank - Primary Focus */}
            {selectedPlayer ? (
              <div className="focused-hero">
                <div className="focused-hero-name">{selectedPlayer.name}</div>
                <div className="focused-hero-rank-big">
                  {selectedTieCount > 1 ? `T-${selectedRank}` : `#${selectedRank}`}
                </div>
                <div className="focused-hero-label">
                  of {players.length} players
                  <TrendIndicator
                    trend={selectedTrend}
                    className="focused-hero-trend"
                  />
                </div>
                <div className="focused-hero-score-pill">
                  <span className="focused-hero-score-value">{selectedPlayer.score}</span>
                  <span className="focused-hero-score-label">pts</span>
                  {selectedTieCount > 1 && (
                    <span className="focused-tie-info">
                      tied with {selectedTieCount - 1} other{selectedTieCount > 2 ? "s" : ""}
                    </span>
                  )}
                </div>
                <button
                  className="focused-hero-clear"
                  onClick={handleClearSelection}
                >
                  Change player
                </button>
              </div>
            ) : (
              <div className="focused-no-selection">
                <div className="focused-no-selection-icon">🏈</div>
                <div className="focused-no-selection-text">
                  Select yourself from the leaderboard to track your score
                </div>
                <button
                  className="focused-find-btn"
                  onClick={() => {
                    // Scroll to leaderboard and focus search input
                    document
                      .querySelector(".focused-section")
                      ?.scrollIntoView({ behavior: "smooth" });
                    setTimeout(() => {
                      searchInputRef.current?.focus();
                    }, 300);
                  }}
                >
                  Find Me
                </button>
              </div>
            )}

            {/* Leaderboard Section */}
            <ExpandableSection
              title="🏆 Leaderboard"
              meta={`${players.length} players`}
              defaultExpanded={!isMobile()}
            >
              <div className="focused-search">
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search players..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="focused-rows">
                {filteredPlayers.map((player, idx) => {
                  const rankInfo = rankMap.get(player.score);
                  const rank = rankInfo?.rank ?? idx + 1;
                  const tieCount = rankInfo?.tieCount ?? 1;
                  const isMe = player.email === selectedEmail;
                  const playerTrend = trends[player.email];

                  return (
                    <div
                      key={player.email}
                      className={`focused-row ${isMe ? "me" : ""}`}
                      onClick={() => handlePlayerSelect(player.email)}
                      role="button"
                      tabIndex={0}
                      onKeyPress={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          handlePlayerSelect(player.email);
                        }
                      }}
                    >
                      <span className="focused-rank">
                        {tieCount > 1 ? `T-${rank}` : rank}
                      </span>
                      <span className="focused-name">{player.name}</span>
                      <TrendIndicator trend={playerTrend} />
                      <span className="focused-score">{player.score}</span>
                    </div>
                  );
                })}
              </div>
            </ExpandableSection>

            {/* Activity Feed Section */}
            {events.length > 0 && (
              <ExpandableSection
                title="⚡ Activity Feed"
                meta={`${events.length} events`}
                defaultExpanded={true}
              >
                <div className="focused-activity-feed">
                  {events.map((event, idx) => (
                    <div key={idx} className={`focused-activity-item ${event.type}`}>
                      {event.type === "new_leader" && (
                        <>
                          <span className="focused-activity-icon">👑</span>
                          <span className="focused-activity-text">
                            <strong>{event.player}</strong> just took the lead!
                          </span>
                        </>
                      )}
                      {event.type === "rank_surge" && (
                        <>
                          <span className="focused-activity-icon">🚀</span>
                          <span className="focused-activity-text">
                            <strong>{event.player}</strong> surged from #{event.from_rank} to #{event.to_rank}!
                          </span>
                        </>
                      )}
                      {event.type === "question_answered" && (
                        <>
                          <span className="focused-activity-icon">✅</span>
                          <span className="focused-activity-text">
                            <strong>{event.question}</strong>: {event.answer}
                          </span>
                        </>
                      )}
                      <span className="focused-activity-time">
                        {formatTimeAgo(event.timestamp)}
                      </span>
                    </div>
                  ))}
                </div>
              </ExpandableSection>
            )}

            {/* Questions Section */}
            <ExpandableSection
              title="📋 Latest Questions"
              meta={`${sortedQuestions.length} answered`}
            >
              <div className="focused-questions">
                {sortedQuestions.map((q, idx) => {
                  // Find user's answer for this question
                  const userAnswer = myAnswers?.find(a => a.question === q.question);
                  const points = q.points || 1;
                  const correctCount = q.correct_count || 0;
                  const totalAnswered = q.total_answered || 0;
                  const correctPct = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;
                  return (
                    <div key={idx} className="focused-question">
                      <div className="focused-question-text">{q.question}</div>
                      <div className="focused-answer-row">
                        <span className="focused-answer">{q.answer}</span>
                        <span className={`focused-points ${points > 1 ? "bonus" : ""}`}>
                          {points} pt{points !== 1 ? "s" : ""}
                        </span>
                      </div>
                      {totalAnswered > 0 && (
                        <div className="focused-question-stats">
                          <div className="focused-stats-bar">
                            <div
                              className="focused-stats-fill"
                              style={{ width: `${correctPct}%` }}
                            />
                          </div>
                          <span className="focused-stats-text">
                            {correctPct}% got this right ({correctCount}/{totalAnswered})
                          </span>
                        </div>
                      )}
                      {userAnswer && (
                        <div className={`focused-question-my-answer ${
                          userAnswer.is_correct ? "correct" : "incorrect"
                        }`}>
                          You picked: <strong>{userAnswer.user_answer || "—"}</strong>
                          {userAnswer.is_correct ? " ✓" : " ✗"}
                        </div>
                      )}
                      <div className="focused-time">{formatTimeAgo(q.updated)}</div>
                    </div>
                  );
                })}
              </div>
            </ExpandableSection>

            {/* Answers Section - Shows selected player's answers */}
            <ExpandableSection
              title={selectedPlayer ? `📝 ${selectedPlayer.name}'s Answers` : "📝 Answers"}
              meta={myAnswers ? `${myAnswers.filter(a => a.is_correct).length}/${myAnswers.filter(a => a.official_answer).length} correct` : ""}
            >
              {!selectedPlayer ? (
                <div className="focused-no-answers">
                  Select a player from the leaderboard to see their answers.
                </div>
              ) : answersLoading ? (
                <div className="focused-loading">Loading answers...</div>
              ) : myAnswers ? (
                <div className="focused-my-answers">
                  {myAnswers.map((answer, idx) => (
                    <div
                      key={idx}
                      className={`focused-answer-row ${
                        answer.official_answer
                          ? answer.is_correct
                            ? "correct"
                            : "incorrect"
                          : "pending"
                      }`}
                    >
                      <div className="focused-answer-question">{answer.question}</div>
                      <div className="focused-answer-details">
                        <span className="focused-answer-yours">
                          Pick: <strong>{answer.user_answer || "—"}</strong>
                        </span>
                        {answer.official_answer && (
                          <>
                            <span className="focused-answer-official">
                              Answer: <strong>{answer.official_answer}</strong>
                            </span>
                            <span className="focused-answer-result">
                              {answer.is_correct ? `✓ +${answer.points}` : "✗"}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="focused-no-answers">
                  No answers found for {selectedPlayer.name}.
                </div>
              )}
            </ExpandableSection>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
