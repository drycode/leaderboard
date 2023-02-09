import { useEffect, useState, forwardRef } from 'react';
import FlipMove from 'react-flip-move';
import 'bootstrap/dist/css/bootstrap.min.css';
import Container from 'react-bootstrap/Container';
import players1 from './data1.json';
import players2 from './data2.json';
import './App.css';
import './ScoreCard.css';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const setPlayers = async (callback) => {
	callback(players1);
	await sleep(2500);
	callback(players2);
	setTimeout(() => setPlayers(callback), 2500);
};

const ScoreCard = forwardRef(({ player, ref }) => {
	return (
		<div className='score-card' key={player.email} ref={ref}>
			<div className='d-flex justify-content-between'>
				<div className='sc-name'>{player.name}</div>
				<div className='sc-score align-self-end'>{player.score}</div>
			</div>
		</div>
	);
});

function App() {
	const [players, setPlayersState] = useState([players1]);

	useEffect(() => {
		setPlayers(setPlayersState);
	}, []);

	return (
		<div className='App vh-100'>
			<Container id='main-container' className='mx-auto d-flex justify-content-center'>
				<div id='main-col' className='flex-col align-items-center'>
					<div id='page-title' title='GO BIRDS'>
						<h2>Super Bowl LVII</h2>
						<h1>Leaderboard</h1>
					</div>
					<div class='items'>
						{/* <FlipMove> */}
						{players.map((player) => {
							return <ScoreCard player={player} />;
						})}
						{/* </FlipMove> */}
					</div>
				</div>
			</Container>
		</div>
	);
}

export default App;
