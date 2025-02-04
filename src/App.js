import { useEffect, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import Container from "react-bootstrap/Container";
import "./App.css";
import "./ScoreCard.css";
import FlipMove from "react-flip-move";
import React from "react";

const AWS = require("aws-sdk"); // We'll create a CSS file for the ticker styles

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

const BUCKET = "prop-sheet";
AWS.config.region = "us-east-1"; // Region
AWS.config.credentials = new AWS.CognitoIdentityCredentials({
  IdentityPoolId: "us-east-1:70e8bed7-eaf4-40e8-83fc-d03db725c61f",
});
const client = new AWS.S3();

const _getPropSheetScores = () => {
  const key = "current_scores.json";
  return new Promise((resolve, reject) => {
    client.getObject({ Bucket: BUCKET, Key: key }, (err, res) => {
      if (err) {
        reject(err);
      } else {
        const result = JSON.parse(res.Body.toString("utf-8"));
        resolve(result);
      }
    });
  });
};

const _getTopQuestions = () => {
  const key = "top-questions.json";
  return new Promise((resolve, reject) => {
    client.getObject({ Bucket: BUCKET, Key: key }, (err, res) => {
      if (err) {
        reject(err);
      } else {
        const result = JSON.parse(res.Body.toString("utf-8"));
        resolve(result);
      }
    });
  });
};

const getPropSheetScores = (callback) => {
  _getPropSheetScores().then((data) => {
    callback(data);
  });
  setTimeout(() => getPropSheetScores(callback), 15 * 1000);
};

const getTopQuestions = (callback) => {
  _getTopQuestions().then((data) => {
    callback(data);
  });
  setTimeout(() => getTopQuestions(callback), 15 * 1000);
};

function App() {
  const [players, setPlayers] = useState([]);
  const [latestQuestions, setQuestions] = useState([]);

  useEffect(() => {
    getPropSheetScores(setPlayers);
    getTopQuestions(setQuestions);
  }, []);

  return (
    <div className="App vh-100">
      <Container
        id="main-container"
        className="mx-auto d-flex justify-content-center"
      >
        <div id="main-col" className="flex-col align-items-center w-100">
          <div id="page-title" title="GO BIRDS">
            <h2>Super Bowl LVII</h2>
            <h2 className="align-items-center">Leaderboard</h2>
          </div>

          <h3>Latest Questions</h3>
          <div className="d-flex justify-content-center max-width">
            <Ticker
              items={latestQuestions
                .sort((a, b) => a.updated_at - b.updated_at)
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
        </div>
      </Container>
    </div>
  );
}

export default App;
