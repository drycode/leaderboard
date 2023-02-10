import { useEffect, useState, forwardRef } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import Container from 'react-bootstrap/Container';
import players1 from './data1.json';
import players2 from './data2.json';
import './App.css';
import ScoreCard from './ScoreCard';
import FlipMove from 'react-flip-move';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const setPlayers = async (callback) => {
  callback(players1);
  await sleep(2500);
  callback(players2);
  setTimeout(() => setPlayers(callback), 2500);
};

const FunctionalScoreCard = forwardRef((props, ref) => (
  <ScoreCard key={props.key} innerRef={ref} player={props.player} />
));

function App() {
  const [players, setPlayersState] = useState([players1]);

  useEffect(() => {
    setPlayers(setPlayersState);
  }, []);

  return (
    <div className='App vh-100'>
      <Container
        id='main-container'
        className='mx-auto d-flex justify-content-center'
      >
        <div className='flex-col align-items-center'>
          <h1 id='page-title' title='GO BIRDS!'>
            Leaderboard
          </h1>
          <div id='results'>
            <FlipMove>
              {players.map((player, i) => {
                console.log('player:');
                return (
                  <FunctionalScoreCard player={player} {...player} key={i} />
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
