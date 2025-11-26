import { useEffect, useState, useRef, useCallback } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import Container from "react-bootstrap/Container";
import "./App.css";
import "./ScoreCard.css";
import FlipMove from "react-flip-move";
import React from "react";

// API endpoints
const API_BASE_URL =
  process.env.REACT_APP_API_URL ||
  "https://ghqw1wy2td.execute-api.us-east-1.amazonaws.com/prod";
const WEBSOCKET_URL =
  process.env.REACT_APP_WS_URL ||
  "wss://pg0vf88roi.execute-api.us-east-1.amazonaws.com/prod";

const Ticker = ({ items, speed = 7 }) => {
  const totalChars = items.reduce(
    (acc, item) => acc + item.question.length + item.answer.length,
    0
  );
  const animationDuration = totalChars / speed;

  return (
    <div className="ticker-container">
      <div
        className="ticker-track"
        style={{ animationDuration: `${animationDuration}s` }}
      >
        {items.map((item, index) => (
          <div key={index} className="ticker-item">
            {item.question} - {item.answer}
          </div>
        ))}
      </div>
    </div>
  );
};

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

function App() {
  const [players, setPlayers] = useState([]);
  const [latestQuestions, setQuestions] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((data) => {
    if (data.scores) {
      setPlayers(data.scores);
    }
    if (data.questions) {
      setQuestions(data.questions);
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

  return (
    <div className="App vh-100">
      <Container
        id="main-container"
        className="mx-auto d-flex justify-content-center"
      >
        <div id="main-col" className="flex-col align-items-center w-100">
          <div id="page-title" title="GO BIRDS">
            <h2>Super Bowl LIX</h2>
            <h2 className="align-items-center">Leaderboard</h2>
          </div>

          {!isConnected && (
            <div className="connection-status disconnected">Reconnecting...</div>
          )}

          {error && <div className="error-message">{error}</div>}

          {loading ? (
            <div className="loading">Loading...</div>
          ) : (
            <>
              <h3>Latest Questions</h3>
              <div className="d-flex justify-content-center max-width">
                <Ticker
                  items={latestQuestions
                    .sort((a, b) => parseInt(b.updated) - parseInt(a.updated))
                    .slice(0, 5)}
                />
              </div>
              <div id="items">
                <FlipMove>
                  {players.map((player) => {
                    return (
                      <div className="score-card" key={player.email}>
                        <div className="d-flex justify-content-between">
                          <div className="sc-name">{player.name}</div>
                          <div className="sc-score align-self-center">
                            {player.score}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </FlipMove>
              </div>
            </>
          )}
        </div>
      </Container>
    </div>
  );
}

export default App;
