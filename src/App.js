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

function App() {
  const [players, setPlayers] = useState([]);
  const [trends, setTrends] = useState({});
  const [latestQuestions, setQuestions] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [displayCount, setDisplayCount] = useState(20);
  const [searchQuery, setSearchQuery] = useState("");

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

  // Filter and paginate players
  const filteredPlayers = searchQuery
    ? players.filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : players;
  const displayedPlayers = filteredPlayers.slice(0, displayCount);
  const hasMore = displayCount < filteredPlayers.length;

  // Find selected player and their rank
  const selectedPlayer = players.find((p) => p.email === selectedEmail);
  const selectedRank = selectedPlayer
    ? players.findIndex((p) => p.email === selectedEmail) + 1
    : null;
  const selectedTrend = selectedEmail ? trends[selectedEmail] : null;

  // Sort questions by most recent
  const sortedQuestions = [...latestQuestions]
    .sort((a, b) => parseInt(b.updated) - parseInt(a.updated))
    .slice(0, 10);

  return (
    <div className="focused-app">
      <div className="focused-container">
        {/* Header */}
        <div className="focused-header">
          <span className="focused-title">Super Bowl LIX</span>
          <div className={`focused-live ${isConnected ? "" : "disconnected"}`}>
            <span className="focused-live-dot"></span>
            {isConnected ? "Live" : "Reconnecting..."}
          </div>
        </div>

        {error && <div className="focused-error">{error}</div>}

        {loading ? (
          <div className="focused-loading">Loading leaderboard...</div>
        ) : (
          <>
            {/* Hero Score - Primary Focus */}
            {selectedPlayer ? (
              <div className="focused-hero">
                <div className="focused-hero-name">{selectedPlayer.name}</div>
                <div className="focused-hero-score">{selectedPlayer.score}</div>
                <div className="focused-hero-label">points</div>
                <div className="focused-hero-rank">
                  <span>
                    Rank <strong>#{selectedRank}</strong> of {players.length}
                  </span>
                  <TrendIndicator
                    trend={selectedTrend}
                    className="focused-hero-trend"
                  />
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
                    // Scroll to leaderboard section or expand it
                    document
                      .querySelector(".focused-section")
                      ?.scrollIntoView({ behavior: "smooth" });
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
              defaultExpanded={!selectedPlayer}
            >
              <div className="focused-search">
                <input
                  type="text"
                  placeholder="Search players..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="focused-rows">
                {displayedPlayers.map((player, idx) => {
                  const rank = players.findIndex((p) => p.email === player.email) + 1;
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
                      <span className="focused-rank">{rank}</span>
                      <span className="focused-name">{player.name}</span>
                      <TrendIndicator trend={playerTrend} />
                      <span className="focused-score">{player.score}</span>
                    </div>
                  );
                })}
              </div>
              {hasMore && (
                <div className="focused-pagination">
                  <button
                    className="focused-show-more"
                    onClick={() => setDisplayCount((prev) => prev + 20)}
                  >
                    Show more ({filteredPlayers.length - displayCount} remaining)
                  </button>
                </div>
              )}
            </ExpandableSection>

            {/* Questions Section */}
            <ExpandableSection
              title="📋 Latest Questions"
              meta={`${sortedQuestions.length} answered`}
            >
              <div className="focused-questions">
                {sortedQuestions.map((q, idx) => (
                  <div key={idx} className="focused-question">
                    <div className="focused-question-text">{q.question}</div>
                    <div className="focused-answer">{q.answer || "TBD"}</div>
                    <div className="focused-time">{formatTimeAgo(q.updated)}</div>
                  </div>
                ))}
              </div>
            </ExpandableSection>
          </>
        )}
      </div>
    </div>
  );
}

export default App;
